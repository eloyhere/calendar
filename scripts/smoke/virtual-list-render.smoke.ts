/**
 * 虚拟列表渲染烟测：把 `VirtualList.vue` 真的渲染一遍（SSR），核对窗口结构与插槽参数。
 *
 * 运行（Node 24 能直接跑 `.ts`，靠类型擦除；**导入必须带 `.ts` 后缀**）：
 *
 *     node scripts/smoke/virtual-list-render.smoke.ts
 *
 * 旧版 Node 不认识 `.ts`，先打包再跑，效果一样：
 *
 *     node node_modules/esbuild/bin/esbuild scripts/smoke/virtual-list-render.smoke.ts --bundle --platform=node --format=esm --external:vue --external:vue/server-renderer --outfile=virtual-list-render.smoke.mjs
 *     node virtual-list-render.smoke.mjs
 *
 * 全部断言通过时退出码为 0；失败会列出具体断言名并以 1 退出。
 *
 * Node 会打一条 `MODULE_TYPELESS_PACKAGE_JSON` 提示（`.ts` 里写了 `import`，它按 ESM
 * 重新解析一次），不影响结果，也不必为此给 `package.json` 加 `"type": "module"`。
 *
 * 为什么走 SSR：这个仓库里没有 DOM 测试环境（没装 jsdom / vitest / test-utils），
 * 而 SSR 已经能证明最容易写错的三件事——SFC 能否编译、`#item` / `#empty` 插槽
 * 是否按契约拿到 `{ item, index }`、占位高度与平移量算得对不对。
 * 真实布局与滚动行为由应用本身验证；滚动算术由 `virtual-list.smoke.ts` 的纯函数断言覆盖。
 *
 * 实现上没有引入打包插件：用 `@vue/compiler-sfc` 把 SFC 编成 TS，交给 `esbuild`
 * 把 `./virtual-range` 这类无扩展名引用收拢成一个 ESM 文件；临时文件必须写在项目内，
 * 因为 `vue` 要从项目的 node_modules 解析，跑完即删。
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createSSRApp, h } from "vue";
import type { Component, VNode } from "vue";
import { renderToString } from "vue/server-renderer";

/** `@vue/compiler-sfc` 里用到的两个函数，只声明用到的那部分签名。 */
interface CompilerSfc {
    parse: (
        source: string,
        options: { filename: string }
    ) => { descriptor: unknown; errors: Array<{ message: string }> };
    compileScript: (
        descriptor: unknown,
        options: { id: string; inlineTemplate: boolean }
    ) => { content: string };
}

/** `esbuild.build()` 的入参，同上。 */
interface BundleOptions {
    stdin: { contents: string; loader: string; resolveDir: string; sourcefile: string };
    outfile: string;
    bundle: boolean;
    define: Record<string, string>;
    format: string;
    platform: string;
    target: string;
    external: Array<string>;
    resolveExtensions: Array<string>;
    logLevel: string;
}

/** 两个包都是 CJS，用 `createRequire` 取最稳（也不参与 esbuild 打包）。 */
const nodeRequire = createRequire(import.meta.url);
const { parse, compileScript } = nodeRequire("@vue/compiler-sfc") as CompilerSfc;
const esbuild = nodeRequire("esbuild") as { build: (options: BundleOptions) => Promise<unknown> };

/**
 * 项目根：从本文件往上找到最近的 `package.json` 所在目录。
 *
 * 不能写死「上两级」：这份脚本要先被 esbuild 打成单个 `.mjs` 再跑，
 * 打包产物放在哪儿由调用方决定（项目根、`.tmp-verify/` 都行），
 * `import.meta.url` 指向的是**产物**，不是本文件。
 */
const findRoot = (from: string): string => {
    let current = from;
    while (current !== dirname(current)) {
        if (existsSync(join(current, "package.json"))) {
            return current;
        }
        current = dirname(current);
    }
    throw new Error(`找不到项目根：从 ${from} 往上没有 package.json`);
};

/** 项目根。 */
const Root = findRoot(dirname(fileURLToPath(import.meta.url)));

/** 被测组件。 */
const ComponentPath = join(Root, "src", "component", "list", "virtual", "VirtualList.vue");

/** 一行数据；`name` 里带上行号，便于断言插槽拿到的下标对不对。 */
interface Row {
    identity: number;
    name: string;
}

const failures: Array<string> = [];

const check = (label: string, condition: boolean, detail?: string): void => {
    if (!condition) {
        failures.push(label);
    }
    console.log(
        `${condition ? "  ✓" : "  ✗"} ${label}${detail === undefined ? "" : `  ${detail}`}`
    );
};

/** 子串出现次数；用来数渲染了几行。 */
const countOf = (html: string, needle: string): number => html.split(needle).length - 1;

/** 把 SFC 编成一个可以直接 `import` 的 ESM 文件，返回它的路径。 */
const buildComponent = async (workDir: string): Promise<string> => {
    const source = readFileSync(ComponentPath, "utf8");
    const { descriptor, errors } = parse(source, { filename: ComponentPath });
    if (errors.length > 0) {
        throw new Error(`SFC 解析失败：${errors.map((error) => error.message).join("；")}`);
    }

    // inlineTemplate：把模板编进 setup，省掉手工拼 render 函数这一步。
    const compiled = compileScript(descriptor, { id: "virtual-list-smoke", inlineTemplate: true });

    const outfile = join(workDir, "VirtualList.mjs");
    await esbuild.build({
        stdin: {
            contents: compiled.content,
            loader: "ts",
            resolveDir: dirname(ComponentPath),
            sourcefile: "VirtualList.ts"
        },
        outfile: outfile,
        bundle: true,
        // `import.meta.env` 是 Vite 的约定，Node 里并不存在；按生产构建的口径
        // 把它定成 `DEV: false`，组件里那些开发期自检才会走和打包后一样的分支。
        define: { "import.meta.env.DEV": "false" },
        format: "esm",
        platform: "node",
        target: "node22",
        // `vue` 留在外面：临时文件与运行时必须共用同一份 Vue 实例。
        external: ["vue"],
        resolveExtensions: [".ts", ".mjs", ".js"],
        logLevel: "warning"
    });

    return outfile;
};

/** 渲染一批数据，返回 HTML。插槽内容故意带上真实下标，便于断言。 */
const renderList = async (component: Component, items: Array<Row>): Promise<string> => {
    const app = createSSRApp({
        render: (): VNode =>
            h(
                component,
                { items: items, itemHeight: 36, overscan: 4, height: 360 },
                {
                    item: (slot: { item: Row; index: number }): VNode =>
                        h("div", { class: "cell" }, `${slot.index}:${slot.item.name}`),
                    empty: (): VNode => h("div", { class: "none" }, "没有数据")
                }
            )
    });
    return await renderToString(app);
};

const main = async (): Promise<void> => {
    const workDir = mkdtempSync(join(Root, ".virtual-list-smoke-"));

    try {
        const outfile = await buildComponent(workDir);
        const component = (await import(pathToFileURL(outfile).href)).default as Component;

        const rows: Array<Row> = Array.from({ length: 1000 }, (_value, index) => ({
            identity: index + 1,
            name: `第 ${index + 1} 行`
        }));

        const html = await renderList(component, rows);

        console.log("— 滚动容器与占位 —");
        check("渲染出滚动容器", html.includes('class="virtual-list"'));
        check("容器声明为 list", html.includes('role="list"'));
        check("视口高度按 height 落到样式", html.includes("height:360px"));
        check("占位高度 = 1000 × 36", html.includes("height:36000px"));
        check("窗口平移 0px", html.includes("translateY(0px)"));

        console.log("— 只渲染可视行 + 缓冲 —");
        check(
            "首帧渲染 1 + overscan 行",
            countOf(html, "virtual-list__row") === 5,
            `rows=${countOf(html, "virtual-list__row")}`
        );
        check("第 6 行没进 DOM", !html.includes("5:第 6 行"));
        check("每行都是 36px", countOf(html, "height:36px") === 5);

        console.log("— 插槽拿到真实下标与数据 —");
        check("第 1 行内容正确（下标从 0 起）", html.includes("0:第 1 行"));
        check("第 5 行内容正确（下标从 0 起）", html.includes("4:第 5 行"));
        check("行下标从 1 数的 aria-posinset", html.includes('aria-posinset="1"'));
        check("总行数 aria-setsize", html.includes('aria-setsize="1000"'));
        check("行是 listitem", html.includes('role="listitem"'));

        console.log("— 空列表 —");
        const emptyHtml = await renderList(component, []);
        check("没有行", countOf(emptyHtml, "virtual-list__row") === 0);
        check("占位高度为 0", emptyHtml.includes("height:0px"));
        check("渲染 empty 插槽", emptyHtml.includes("没有数据"));
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }

    console.log("");
    if (failures.length > 0) {
        console.log(`失败 ${failures.length} 项：\n  - ${failures.join("\n  - ")}`);
        process.exitCode = 1;
        return;
    }
    console.log("SSR 渲染通过：窗口结构、插槽参数与空态均按契约渲染");
};

await main();
