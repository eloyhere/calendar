/**
 * Markdown 解析器烟测：把 `parseMarkdown()` / `parseInline()` / `safeHref()` 的
 * 关键判定钉住。
 *
 * 运行（Node 24 能直接跑 `.ts`，靠类型擦除；**导入必须带 `.ts` 后缀**）：
 *
 *     node scripts/smoke/markdown-parse.smoke.ts
 *
 * 全部断言通过时退出码为 0；失败会列出断言名并以 1 退出。
 * 被测的是纯函数（不碰 DOM、不碰 Vue、不碰数据库），因此可脱离 Electron 单独跑。
 * 渲染链路（SFC 编译、模板分支、安全链接是否真的没变成 `<a>`）由
 * `markdown-render.smoke.ts` 单独验。
 *
 * 为什么值得单独测：解析器的两种错法都不会当场报错，只会在界面上「看着有点怪」——
 * 一是**多解析**（`a * b * c` 被当成斜体、`#标签` 被当成标题），二是**少拦**
 * （`javascript:` 链接被渲染成可点目标，这是安全问题）。两者都靠读代码看不出来，
 * 所以在这里逐条写成会失败的断言。
 */
import {
    parseInline,
    parseMarkdown,
    plainText,
    safeHref,
    summarizeMarkdown
} from "../../src/component/card/markdown-parse.ts";
import type { MarkdownNode } from "../../src/component/card/markdown-parse.ts";

const failures: Array<string> = [];

const check = (label: string, condition: boolean, detail?: string): void => {
    if (!condition) {
        failures.push(label);
    }
    console.log(
        `${condition ? "  ✓" : "  ✗"} ${label}${detail === undefined ? "" : `  ${detail}`}`
    );
};

/** 取第一个块的某个字段，省得每条断言都写一遍下标。 */
const first = (source: string, options?: Parameters<typeof parseMarkdown>[1]): MarkdownNode =>
    parseMarkdown(source, options)[0];

/** 一个节点压成的纯文本，用来比对「读出来是什么」。 */
const text = (node: MarkdownNode): string => plainText(node);

/** 解析一段行内文本后压平，用来测行内规则。 */
const inline = (source: string): string => parseInline(source).map(text).join("");

console.log("\n标题");
{
    const heading = first("# 简介");
    check("`# 标题` 是 heading", heading.kind === "heading", heading.kind);
    check("层级取井号个数", heading.depth === 1, String(heading.depth));
    check("headingBase 整体上移", first("# 简介", { headingBase: 2 }).depth === 2);
    check("层级封顶 h6", first("###### 深", { headingBase: 6 }).depth === 6);
    check("结尾井号是装饰", text(first("## 标题 ##")) === "标题", text(first("## 标题 ##")));
    check("`#标签` 不是标题", first("#标签").kind === "paragraph", first("#标签").kind);
    check("井号后必须有空格", first("####").kind === "paragraph", first("####").kind);
}

console.log("\n段落");
{
    check("单行段落", text(first("一行字")) === "一行字");
    check("相邻两行并成一个段落", parseMarkdown("第一行\n第二行").length === 1);
    check("段落内软换行保留成 \\n", first("第一行\n第二行").text === "第一行\n第二行");
    check(
        "softBreak:false 把软换行写成硬换行",
        first("第一行\n第二行", { softBreak: false }).text === "第一行  \n第二行",
        JSON.stringify(first("第一行\n第二行", { softBreak: false }).text)
    );
    check(
        "空行分段",
        parseMarkdown("甲\n\n乙").length === 2,
        String(parseMarkdown("甲\n\n乙").length)
    );
    check("连续空行只算一段", parseMarkdown("甲\n\n\n\n乙").length === 2);
    check(
        "空行数记在 trailingGaps",
        first("甲\n\n\n乙").trailingGaps === 2,
        String(first("甲\n\n\n乙").trailingGaps)
    );
}

console.log("\n围栏代码块");
{
    const block = first("```ts\nconst a = 1;\n```");
    check("是 code 块", block.kind === "code", block.kind);
    check("语言标记取出", block.language === "ts", block.language);
    check("内容原样保留", block.text === "const a = 1;", JSON.stringify(block.text));
    check("块内标记不解析", first("```\n**不是粗体**\n```").text === "**不是粗体**");
    check(
        "未闭合吃到文末",
        first("```\n甲\n乙").text === "甲\n乙",
        JSON.stringify(first("```\n甲\n乙").text)
    );
    check("~~~ 也是围栏", first("~~~\nx\n~~~").kind === "code");
    check("围栏下的普通行不再算代码", parseMarkdown("```\nx\n```\n正文").length === 2);
}

console.log("\n列表");
{
    const list = first("- 甲\n- 乙");
    check("是无序列表", list.kind === "list" && list.ordered === false);
    check("两项", (list.items ?? []).length === 2, String((list.items ?? []).length));
    check("项内容", text((list.items ?? [])[0][0]) === "甲");
    check("空行后同类项继续", (first("- 甲\n\n- 乙").items ?? []).length === 2);
    check("有序列表", first("1. 甲\n2. 乙").ordered === true);
    check("起始序号以文中为准", first("3. 丙").start === 3, String(first("3. 丙").start));
    check("`1)` 也是有序标记", first("1) 甲").ordered === true);
    check("有序与无序不相邻合并", parseMarkdown("- 甲\n1. 乙").length === 2);

    const nested = first("- 甲\n  - 甲一");
    check(
        "两级缩进成嵌套列表",
        (nested.items ?? [])[0].some((node) => node.kind === "list")
    );
    check("嵌套列表能压平", plainText(nested) === "甲 甲一", JSON.stringify(plainText(nested)));
    const tasks = first("- [x] 做完\n- [ ] 没做");
    check(
        "任务项勾选状态",
        JSON.stringify(tasks.checks) === "[true,false]",
        JSON.stringify(tasks.checks)
    );
    check("任务项文字去掉勾选框", text((tasks.items ?? [])[0][0]) === "做完");

    check("`-1` 不是列表项", first("-1 度").kind === "paragraph", first("-1 度").kind);
    check("`-` 后必须有空格", first("-甲").kind === "paragraph", first("-甲").kind);
}

console.log("\n引用与分隔线");
{
    const quote = first("> 引用一句");
    check("是 blockquote", quote.kind === "blockquote", quote.kind);
    check("引用内解析成段落", text((quote.children ?? [])[0]) === "引用一句");
    check("引用里能放列表", (first("> - 甲")?.children ?? [])[0].kind === "list");
    check("懒续行还属引用", text((first("> 甲\n乙").children ?? [])[0]) === "甲 乙");

    check("`---` 是分隔线", first("---").kind === "divider", first("---").kind);
    check("`***` 是分隔线", first("***").kind === "divider");
    check("`--` 不是分隔线", first("--").kind === "paragraph");
}

console.log("\n表格");
{
    const table = first("| 名 | 值 |\n| --- | ---: |\n| 甲 | 1 |");
    check("是 table", table.kind === "table", table.kind);
    check("表头两列", (table.header ?? []).length === 2, String((table.header ?? []).length));
    check("一行数据", (table.rows ?? []).length === 1, String((table.rows ?? []).length));
    check(
        "对齐按分隔行",
        JSON.stringify(table.aligns) === '[null,"right"]',
        JSON.stringify(table.aligns)
    );
    check(
        "单元格文字",
        plainText((table.rows ?? [])[0][0]) === "甲",
        plainText((table.rows ?? [])[0][0])
    );

    const centered = first("| 中 |\n| :-: |\n| x |");
    check(
        "居中写法",
        JSON.stringify(centered.aligns) === '["center"]',
        JSON.stringify(centered.aligns)
    );

    const left = first("a | b\n-- | --\nx | y");
    check("无首尾竖线也成立", left.kind === "table" && (left.header ?? []).length === 2);

    check("没有分隔行就不是表格", first("a | b").kind === "paragraph", first("a | b").kind);
    check(
        "`\\|` 不当列分隔",
        (first("| a \\| b | c |\n| - | - |").header ?? []).length === 2,
        String((first("| a \\| b | c |\n| - | - |").header ?? []).length)
    );
    check(
        "多写的列被截掉",
        ((first("| a | b |\n| - | - |\n| 1 | 2 | 3 |").rows ?? [])[0] ?? []).length === 2
    );
}

console.log("\n行内");
{
    check("粗体", inline("**粗**") === "粗", inline("**粗**"));
    check("斜体", inline("*斜*") === "斜");
    check("下划线斜体", inline("_斜_") === "斜");
    check("删除线", inline("~~删~~") === "删");
    check("行内代码", inline("`码`") === "码");
    check("代码里的星号不解析", inline("`**不是粗体**`") === "**不是粗体**");
    check("嵌套：粗体里有代码", inline("**粗 `码`**") === "粗 码", inline("**粗 `码`**"));
    check("转义星号", inline("\\*不是斜体\\*") === "*不是斜体*", inline("\\*不是斜体\\*"));
    check("链接", inline("[文字](https://example.com)") === "文字");
    check("链接文字里的粗体", inline("[**粗**](https://example.com)") === "粗");

    check("乘号不被当斜体", inline("a * b * c") === "a * b * c", inline("a * b * c"));
    check("两个乘号不被当粗体", inline("2 ** 3 ** 4") === "2 ** 3 ** 4", inline("2 ** 3 ** 4"));
    check("空格包着的星号不是斜体", inline("** 粗 **") === "** 粗 **", inline("** 粗 **"));
    check("中文紧跟星号不误伤", inline("5*3*2") === "5*3*2", inline("5*3*2"));
    check("未闭合的标记原样显示", inline("**粗") === "**粗", inline("**粗"));
    check("不配对的单个反引号原样显示", inline("`码") === "`码", inline("`码"));
    check("软换行连成空格", inline("甲\n乙") === "甲 乙", inline("甲 乙"));
    check("自动链接", inline("<https://example.com>") === "https://example.com");
    check("裸网址不变链接", inline("见 https://example.com") === "见 https://example.com");
}

console.log("\n链接协议白名单（安全边界）");
{
    check("https 放行", safeHref("https://example.com") === "https://example.com");
    check("http 放行", safeHref("http://example.com") === "http://example.com");
    check("mailto 放行", safeHref("mailto:a@b.com") === "mailto:a@b.com");
    check("站内锚点放行", safeHref("#section") === "#section");
    check("相对路径放行", safeHref("./page") === "./page");
    check("上级相对路径放行", safeHref("../page") === "../page");
    check("根路径放行", safeHref("/page") === "/page");

    check("javascript: 拦下", safeHref("javascript:alert(1)") === "");
    check("大写混写也拦下", safeHref("JaVaScRiPt:alert(1)") === "");
    check("控制字符绕过被拦下", safeHref("java\tscript:alert(1)") === "");
    check("换行绕过被拦下", safeHref("java\nscript:alert(1)") === "");
    check("前导空白绕过被拦下", safeHref("  javascript:alert(1)") === "");
    check("data: 拦下", safeHref("data:text/html,<script>alert(1)</script>") === "");
    check("vbscript: 拦下", safeHref("vbscript:msgbox") === "");
    check("file: 拦下", safeHref("file:///C:/Windows") === "");
    check("认不出的协议拦下", safeHref("custom-scheme:x") === "");
    check("空目标拦下", safeHref("") === "");

    // 拦下之后节点怎么变：链接降级成带 `verbatim` 的纯文本，文字保留、点不动
    const blocked = parseInline("[点我](javascript:alert(1))")[0];
    check("被拦下的链接变成文本节点", blocked.kind === "text", blocked.kind);
    check("被拦下的链接带 verbatim", blocked.verbatim === true);
    check("被拦下的链接文字保留", blocked.text === "点我", blocked.text ?? "");

    const allowed = parseInline("[文字](https://example.com)")[0];
    check("放行的链接是 link 节点", allowed.kind === "link", allowed.kind);
    check("放行的链接带 href", allowed.href === "https://example.com");
}

console.log("\nHTML 与畸形输入");
{
    check("<div> 当文本显示", inline("<div>a</div>") === "<div>a</div>", inline("<div>a</div>"));
    check("onerror 只是文本", inline("<img onerror=alert(1)>") === "<img onerror=alert(1)>");
    check("标签开头的行是段落", first("<script>alert(1)</script>").kind === "paragraph");

    const weird = [
        "",
        "\n\n\n",
        "#".repeat(200),
        "*".repeat(200),
        "[".repeat(200),
        "`".repeat(200),
        ">".repeat(200),
        "|" + "-|".repeat(100),
        "- ".repeat(200),
        "  ".repeat(200),
        "\t---\t",
        "```",
        "![图",
        "[](",
        "<",
        "\\"
    ];

    let crashed = "";
    for (const source of weird) {
        try {
            parseMarkdown(source);
            parseInline(source);
        } catch (error) {
            crashed = `${JSON.stringify(source.slice(0, 20))} -> ${String(error)}`;
            break;
        }
    }
    check("畸形输入不抛异常", crashed === "", crashed);

    // 深层嵌套不能把调用栈打穿：引用、列表与强调各自递归
    const deep = "> ".repeat(60) + "底";
    let deepFailed = "";
    try {
        parseMarkdown(deep);
        parseInline("*".repeat(2) + "a".repeat(50) + "*".repeat(2));
    } catch (error) {
        deepFailed = String(error);
    }
    check("深层嵌套不抛异常", deepFailed === "", deepFailed);
}

console.log("\n摘要");
{
    check("摘要压平标记", plainText(first("## 标题")) === "标题", plainText(first("## 标题")));
    check(
        "列表压平成一行",
        plainText(first("- 甲\n- 乙")) === "甲 乙",
        JSON.stringify(plainText(first("- 甲\n- 乙")))
    );

    // 容器节点同时带 `text` 与 `children`（`text` 是纯文本那一份，`children` 只装
    // 标记出来的那几段）。两处都读就会把同一句话数两遍，这一组把「只走一条路」钉住
    check(
        "纯文本段落不重复",
        plainText(first("一行字")) === "一行字",
        JSON.stringify(plainText(first("一行字")))
    );
    check(
        "带标记的段落不重复",
        plainText(first("依据 `码` 与 **粗**")) === "依据 码 与 粗",
        JSON.stringify(plainText(first("依据 `码` 与 **粗**")))
    );
    check(
        "标题不重复",
        plainText(first("## 标题")) === "标题",
        JSON.stringify(plainText(first("## 标题")))
    );
    check(
        "引用里的段落不重复",
        plainText(first("> 引用一句")) === "引用一句",
        JSON.stringify(plainText(first("> 引用一句")))
    );
    check(
        "表格单元格不重复",
        plainText(first("| 甲 | 乙 |\n| - | - |\n| 一 | 二 |")) === "甲 乙 一 二",
        JSON.stringify(plainText(first("| 甲 | 乙 |\n| - | - |\n| 一 | 二 |")))
    );

    // 混排一遍：真拿一段有标题、列表、代码、表格、引用的正文走完整条路，
    // 只查「压平后读起来是不是那句话」——这一步能兜住跨块粘连这类错
    const mixed = [
        "## 口径",
        "",
        "依据 `docs/design.md`：",
        "",
        "- 第一条",
        "- 第二条",
        "",
        "> 引用一句",
        "",
        "```sql",
        "SELECT 1;",
        "```",
        ""
    ].join("\n");
    const mixedNodes = parseMarkdown(mixed, { headingBase: 2 });
    check("混排块数与预期一致", mixedNodes.length === 5, String(mixedNodes.length));
    check(
        "混排每块都能压出文字",
        mixedNodes.every((node) => plainText(node).length > 0),
        JSON.stringify(mixedNodes.map((node) => plainText(node)))
    );
    check(
        "混排首块是 h3（headingBase=2 且文中是 ##）",
        mixedNodes[0].kind === "heading" && mixedNodes[0].depth === 3,
        `${mixedNodes[0].kind}/${String(mixedNodes[0].depth)}`
    );
}

console.log("\n摘要");
{
    check(
        "摘要不带标记符号",
        summarizeMarkdown("## 标题\n\n正文一句") === "标题 正文一句",
        JSON.stringify(summarizeMarkdown("## 标题\n\n正文一句"))
    );
    check(
        "摘要会截断",
        summarizeMarkdown("一二三四五六七八九十", 4) === "一二三四…",
        JSON.stringify(summarizeMarkdown("一二三四五六七八九十", 4))
    );
    check(
        "limit 为 0 时不截断",
        summarizeMarkdown("一二三四五六七八九十", 0) === "一二三四五六七八九十"
    );
    check("空输入的摘要是空串", summarizeMarkdown("") === "");
    check(
        "摘要不含标记字符",
        !/[#*`[\]]/.test(summarizeMarkdown("## **粗** 与 `码` 与 [链](https://e.com)")),
        JSON.stringify(summarizeMarkdown("## **粗** 与 `码` 与 [链](https://e.com)"))
    );
}

console.log(
    failures.length === 0
        ? "\n全部通过。\n"
        : `\n${failures.length} 条未通过：\n  - ${failures.join("\n  - ")}\n`
);

process.exit(failures.length === 0 ? 0 : 1);
