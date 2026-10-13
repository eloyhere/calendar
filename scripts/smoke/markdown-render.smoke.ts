/**
 * Markdown 卡片渲染烟测：把两个 `.vue` 编译出来、真的渲染一遍，再检查 HTML。
 *
 * 运行（Node 24 能直接跑 `.ts`，靠类型擦除）：
 *
 *     node scripts/smoke/markdown-render.smoke.ts
 *
 * 全部断言通过时退出码为 0；失败会列出具体断言名并以 1 退出。
 *
 * 解析结果由 `markdown-parse.smoke.ts` 负责（纯函数，不碰 Vue），这一份只管
 * **渲染链路**：模板里有没有写错分支、`v-for` 会不会漏节点、白名单拦下的链接
 * 是不是真的没变成 `<a>`。这些都属于「类型检查过了但界面不对」的错法，
 * 只有真渲染一次才看得见——本次开发中它一次就抓出了「段落的行内标记全部
 * 退化成纯文本」这种类型检查完全看不出来的错。
 *
 * 与 `virtual-list-render.smoke.ts` 同一套办法：这个仓库没有 DOM 测试环境
 * （没装 jsdom / vitest），SSR 是能拿到真实 HTML 的最轻路子。区别是那边用
 * `@vue/compiler-sfc` + `esbuild` 自己拼，这里直接用项目的 vite——
 * 组件的无扩展名引用（`./markdown-parse`）由 vite 解析，省掉一层手写装配。
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { createSSRApp } from "vue";
// 与 `virtual-list-render.smoke.ts` 取同一个入口：`vue/server-renderer` 是 vue 的
// 子路径，SSR 用到的就是它，不必再引 `@vue/server-renderer`
import { renderToString } from "vue/server-renderer";
import { build } from "vite";
import type { Component } from "vue";

/** 断言收集。 */
const failures: string[] = [];

const check = (label: string, condition: boolean, detail?: string): void => {
    if (!condition) {
        failures.push(label);
    }
    console.log(
        `${condition ? "  ✓" : "  ✗"} ${label}${detail === undefined ? "" : `  ${detail}`}`
    );
};

/** 编译入口：被测组件 + 它需要的两个 Element Plus 组件（应用里是全局注册的）。 */
const ENTRY = `
import MarkDownCard from "/src/component/card/MarkDownCard.vue";
import { parseMarkdown } from "/src/component/card/markdown-parse.ts";
import { ElCard, ElIcon } from "element-plus";

export { MarkDownCard, ElCard, ElIcon, parseMarkdown };
`;

/** 一段有代表性的正文：标题、强调、代码、两种列表、任务列表、引用、表格、代码块、链接。 */
const SAMPLE = [
    "# 口径",
    "",
    "依据 `docs/design.md`，**数据来源**是 *朔望年* 表，~~旧口径~~ 已作废。",
    "",
    "- 第一条",
    "- 第二条",
    "  - 嵌套项",
    "",
    "1. 甲",
    "2. 乙",
    "",
    "- [x] 做完的",
    "- [ ] 没做的",
    "",
    "> 引用一句",
    "",
    "| 列甲 | 列乙 |",
    "| --- | ---: |",
    "| 值一 | 1 |",
    "",
    "```sql",
    "SELECT 1;",
    "```",
    "",
    "见 [文档](https://example.com) 与 [危险](javascript:alert(1))。",
    "",
    "---",
    ""
].join("\n");

/** 诊断用：把 HTML 里带 strong/em 的片段摘出来，断言失败时能直接看出渲染成了什么。 */
const emphasisProbe = (html: string): string => {
    const at = html.search(/<(strong|em|del)[\s>]/);
    return at === -1
        ? "（HTML 里没有 strong/em/del 元素）"
        : html.slice(Math.max(0, at - 50), at + 70);
};

/**
 * 编译产物放在**项目里**的临时目录，不能放系统临时目录：产物里 `vue` 与
 * `element-plus` 是 external 的裸导入，Node 要从产物所在位置往上找
 * `node_modules`，放到 `%TEMP%` 下就找不到了。
 */
const WORKDIR = join(process.cwd(), ".tmp-verify", "markdown-render");

/** 把组件编译成一个 ESM 文件，返回它的路径。 */
async function compile(): Promise<string> {
    const entry = join(WORKDIR, "entry.js");
    await mkdir(WORKDIR, { recursive: true });
    await writeFile(entry, ENTRY, "utf8");

    await build({
        configFile: false,
        logLevel: "warn",
        plugins: [vue()],
        resolve: { alias: { "@": join(process.cwd(), "src") } },
        build: {
            emptyOutDir: true,
            minify: false,
            outDir: WORKDIR,
            rollupOptions: {
                external: ["vue", "element-plus"],
                input: entry,
                // 显式钉住产物文件名：交给默认命名规则时名字不好预判，
                // 后面按名字 import 会找不到文件
                output: { entryFileNames: "bundle.mjs", format: "es" }
            },
            ssr: true,
            target: "esnext"
        }
    });

    return join(WORKDIR, "bundle.mjs");
}

/**
 * 编译产物里我们用到的那几个导出。
 *
 * `Component` 是 vue 自己的组件类型，`createSSRApp` 与 `app.component()` 都收它；
 * 写 `as never` 也能过编译，但那样等于把类型检查关掉——这里如实声明。
 */
interface Bundle {
    MarkDownCard: Component;
    ElCard: Component;
    ElIcon: Component;
    parseMarkdown: (
        source: string
    ) => Array<{ kind: string; items?: unknown[]; children?: unknown[] }>;
}

/** 渲染一次，拿到 HTML 字符串。 */
async function render(bundle: string, props: Record<string, unknown>): Promise<string> {
    const module = (await import(pathToFileURL(bundle).href)) as Bundle;

    const app = createSSRApp(module.MarkDownCard, props);
    app.component("ElCard", module.ElCard);
    app.component("ElIcon", module.ElIcon);

    return renderToString(app);
}

try {
    const bundle = await compile();
    console.log("\n编译");
    check("SFC 编译通过", true);

    // 解析与渲染之间的接缝也要查：段落漏给 `children` 时，块级照样渲染得出来，
    // 只有行内标记会全部退化成纯文本——只渲染一次、不查解析结果是看不出来的
    const parse = ((await import(pathToFileURL(bundle).href)) as Bundle).parseMarkdown;
    const inlineKinds = (source: string): string[] =>
        (parse(source)[0].children ?? []).map((node) => (node as { kind: string }).kind);
    check(
        "段落带行内子节点",
        inlineKinds("**粗** 与 `码`").join(",") === "strong,text,code",
        inlineKinds("**粗** 与 `码`").join(",")
    );
    check("标题带行内子节点", (parse("# **粗**")[0].children ?? []).length === 1);
    check("链接解析成 link", inlineKinds("[文字](https://e.com)").join(",") === "link");
    check("列表项里的段落也带行内子节点", (parse("- **粗**")[0].items ?? []).length > 0);

    const plain = parse("依据 `码` 与 **粗** 和 *斜* 还有 [链](https://e.com)")[0];
    console.log("  · 段落的 children:", JSON.stringify(plain.children));
    console.log(
        "  · 标题的 depth:",
        JSON.stringify(parse("# 口径", { headingBase: 2 } as never)[0])
    );
    console.log("\n默认渲染（标题取自正文的第一个标题块）");
    const html = await render(bundle, { markdown: SAMPLE });
    if (process.argv.includes("--dump")) {
        console.log("\n===== HTML =====\n" + html + "\n===== /HTML =====\n");
    }
    check("根节点是 el-card", html.includes("el-card"), html.slice(0, 60));
    check("有标题区", html.includes("el-card__header"));
    check("标题取正文的标题块", html.includes(">口径<"));
    check("标题默认是 h2", html.includes("<h2"));
    check("正文区存在", html.includes("el-card__body"));
    check("没给 footer 就不渲染脚注区", !html.includes("el-card__footer"));

    console.log("\n块级渲染");
    // 注意两件事：
    // 1. 别写成 `<strong>`：SSR 会给每个元素加 scope 属性（`<strong data-v-…>`），
    //    拿闭合尖括号去比会永远不成立；
    // 2. 页面里第一个标题元素是**卡片标题栏**的 `h2`，正文的标题要从第二个开始数。
    const headingTags = (html.match(/<h[1-6][\s>]/g) ?? []).map((tag) => tag.slice(2, 3));
    check("卡片标题是 h2", headingTags[0] === "2", headingTags.join(","));
    check("正文标题从 h3 起", headingTags[1] === "3", `实际序列 h${headingTags.join(" h")}`);
    check("行内代码渲染成 code", html.includes("md-inline-code"));
    check("粗体渲染成 strong", /<strong[\s>]/.test(html), emphasisProbe(html));
    check("斜体渲染成 em", /<em[\s>]/.test(html), emphasisProbe(html));
    check("删除线渲染成 del", /<del[\s>]/.test(html), emphasisProbe(html));

    const depthHtml = await render(bundle, { markdown: "# 一\n\n## 二\n\n### 三" });
    const depthTags = (depthHtml.match(/<h[1-6][\s>]/g) ?? []).map((tag) => tag.slice(2, 3));
    check(
        "层级随井号数递增",
        depthTags.slice(1).join(",") === "3,4,5",
        `实际序列 h${depthTags.join(" h")}`
    );
    const shifted = await render(bundle, { markdown: "# 一", headingBase: 1 });
    check("headingBase 可改起始层级", /<h1[\s>]/.test(shifted), "传 1 时 # 应渲染成 h1");
    check("无序列表渲染成 ul", html.includes("<ul"));
    check("有序列表渲染成 ol", html.includes("<ol"));
    check("列表项渲染成 li", html.includes("<li"));
    check("嵌套列表落在项容器里", html.includes("md-block__item-body"));
    check("任务项带勾选标记", html.includes("md-block__check"));
    check("已完成项带 is-done", html.includes("is-done"));
    check("引用渲染成 blockquote", html.includes("<blockquote"));
    check("表格渲染成 table", html.includes("<table"));
    check("表头渲染成 th", html.includes("<th"));
    check("数据格渲染成 td", html.includes("<td"));
    check("右对齐写进 align", html.includes('align="right"'));
    check("代码块渲染成 pre", html.includes("md-block__pre"));
    check("代码块标出语言", html.includes("sql"));
    check("分隔线渲染成 hr", html.includes("<hr"));

    console.log("\n链接与安全");
    check("安全链接渲染成 a", html.includes('href="https://example.com"'));
    check("a 带 rel=noopener", html.includes("noopener"));
    // 被拦下的链接降级成纯文本，它的**文字**里当然还看得见 `javascript:alert(1)`
    // 这几个字。要证明「没落地成 URL」，就得保证它没有出现在任何属性值里。
    check("危险链接没有落进任何属性", !/=["'][^"']*javascript:/i.test(html));
    check("危险链接的文字仍在", html.includes("危险"));
    check("危险链接文字标成 is-verbatim", html.includes("is-verbatim"));

    console.log("\nraw 视图");
    const rawHtml = await render(bundle, { markdown: "# 标题", display: "raw" });
    check("raw 显示原文", rawHtml.includes("# 标题"));
    // 卡片标题本身就是一个 h2，所以判据取「正文区里没有标题元素」，
    // 不能拿整页的 `<h2` 去比——那个 h2 是标题栏，永远在
    const rawBody = /markdown-card__body[^>]*>([\s\S]*?)<\/div>/.exec(rawHtml)?.[1] ?? "";
    check("raw 的正文区没有标题元素", !/<h[1-6][\s>]/.test(rawBody), rawBody.slice(0, 120));
    check("raw 用 pre 呈现", rawHtml.includes("markdown-card__raw"));

    console.log("\n空正文");
    const emptyHtml = await render(bundle, { markdown: "" });
    check("空正文显示 emptyText", emptyHtml.includes("还没有内容"));
    check("空正文不渲染标题区", !emptyHtml.includes("el-card__header"));

    console.log("\n脚注与图片开关");
    const footHtml = await render(bundle, { markdown: "正文", footer: "来源：朔望年表" });
    check("footer prop 渲染脚注区", footHtml.includes("el-card__footer"));
    check("脚注文字出现", footHtml.includes("来源：朔望年表"));

    const imageHtml = await render(bundle, { markdown: "![图](https://e.com/a.png)" });
    check("默认不渲染图片", !imageHtml.includes("<img"));
    const imageOnHtml = await render(bundle, {
        markdown: "![图](https://e.com/a.png)",
        allowImage: true
    });
    check("allowImage 后渲染图片", imageOnHtml.includes("<img"));
    check("图片 alt 带说明", imageOnHtml.includes('alt="图"'));

    console.log("\n原文里的裸 HTML");
    const injection = await render(bundle, {
        markdown: "<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>"
    });
    check("尖括号被转义", injection.includes("&lt;img"), "不应出现真实标签");
    // 转义后的文本里本来就会出现 `onerror=` 这几个字，所以这里查的是「真属性」：
    // 属性只会在标签内部，而标签一旦出现，「<img」就不会是转义形式
    check("没有真实 img 标签落地", !/<img[\s>]/.test(injection));
    check("没有 onerror 属性落地", !/<[a-z]+[^>]*\sonerror=/.test(injection));
    check("没有 script 标签落地", !injection.includes("<script"));
} finally {
    // 产物是派生物，跑完就删；`--keep` 时可留着看编译结果。
    // 父目录 `.tmp-verify/` 也一并收掉——它是本测试专用的，留着只会变成一个空壳
    if (!process.argv.includes("--keep")) {
        await rm(WORKDIR, { recursive: true, force: true });
        await rm(dirname(WORKDIR), { recursive: true, force: true });
    }
}

console.log(
    failures.length === 0
        ? "\n全部通过。\n"
        : `\n${failures.length} 条未通过：\n  - ${failures.join("\n  - ")}\n`
);

process.exit(failures.length === 0 ? 0 : 1);
