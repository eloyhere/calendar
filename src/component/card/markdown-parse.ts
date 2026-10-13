/**
 * Markdown 子集解析器：把一段文本解析成**节点树**，供 `MarkDownCard.vue` 用
 * Vue 模板逐个渲染。
 *
 * ## 为什么是节点树而不是 HTML 字符串
 *
 * 渲染 Markdown 的常规做法是「解析成 HTML 字符串 + `v-html`」，那条路上
 * `<script>`、`onerror=`、`javascript:` 这些都得靠一个清洗库兜住，而清洗库
 * 一旦漏一条就是执行任意脚本。本模块**只输出节点树**，渲染在
 * `MarkDownCard.vue` 里全部由 Vue 模板完成——文本走 `{{ }}`（自动转义），
 * 属性走 `:href` 绑定。全链路没有 `innerHTML`，也就没有 XSS 面可漏。
 *
 * 这条策略不是本项目新立的：`src/view/agent/chat/ChatMessageBubble.vue` 顶部
 * 明确写着「不引 Markdown 渲染器是有意的……等真要渲染表格与代码块时，应当引一个
 * 白名单式的渲染器，而不是在这里手写正则」。本模块就是那个白名单：
 * **语法是枚举的，白名单之外的一律按纯文本原样显示**，不做任何猜测。
 *
 * ## 支持的语法
 *
 * | 块 | 写法 |
 * | -- | ---- |
 * | 标题 | `#` … `######` + 空格 |
 * | 段落 | 其余非空行；行内换行按空格处理（`softBreak` 可改） |
 * | 无序列表 | `-` / `*` / `+` + 空格；缩进 2 格成二级 |
 * | 有序列表 | `1.` / `1)`，序号以文中写的为准 |
 * | 任务列表 | `- [ ]` / `- [x]` |
 * | 引用 | `>` 开头，可嵌套 |
 * | 代码块 | 三个及以上 ``` 或 `~~~` 围栏，可带语言；未闭合吃到文末 |
 * | 表格 | 表头 + `---` 分隔行；`\|` 转义竖线，`:` 表示对齐 |
 * | 分隔线 | `---` / `***` / `___`（三个及以上） |
 *
 * 行内：`**粗**` `*斜*` `~~删~~` `` `代码` `` `[文字](链接)` `<https://…>`
 * `![说明](图片)` 与 `\` 转义。
 *
 * ## 有意不支持的
 *
 * - **HTML 原样透传**：`<div>` 这类标签在 CommonMark 里是块级 HTML，放进来就等于
 *   把「任意标签」重新引入渲染链路。这里一律显示成文本。
 * - **引用式链接** `[文字][1]` 与**脚注**：需要一个跨块的定义表，收益与复杂度不成比例。
 * - **四空格缩进代码块**：与二级列表的缩进写法相撞，且用户在聊天里更常是想缩进排版。
 * - **自动链接裸网址**：正文里出现的 `https://…` 只有写成 `<…>` 才变链接，避免把
 *   用户贴的数据里的网址一律变成可点目标。
 * - **图片**：`![…](…)` 解析出来，但渲染端默认不显示（见 `MarkDownCard` 的
 *   `allowImage`）。远程图片会把「读一张卡片」变成一次对外请求，等于一个追踪像素。
 *
 * ## 链接协议白名单
 *
 * `href` 只放行 `http:` / `https:` / `mailto:` 与站内相对路径（`#`、`/`、`./`、`../`）。
 * 判断前先剥掉 ASCII 控制字符与空白——`java\tscript:alert(1)` 这种写法正是靠
 * 浏览器忽略这些字符来绕过朴素的 `startsWith("javascript:")`。剥不掉、认不出的
 * 一律降级为纯文本，链接本身还会照常显示，只是点不动。
 *
 * ## 与 `docs/design.md` 的关系
 *
 * 本模块不碰任何数据层（`entity / store / service / repository / sql`），是纯函数，
 * 输入字符串、输出对象树，因此 `docs/design.md` 的分层约定不受影响。
 */

/* ------------------------------------------------------------------ 节点类型 */

/** 行内节点：段落、标题、表格单元格里的最小单位。 */
export type InlineKind = "text" | "strong" | "emphasis" | "strike" | "code" | "link" | "image" | "break";

/** 块级节点：正文里一个个独立的分段。 */
export type BlockKind =
    | "heading"
    | "paragraph"
    | "list"
    | "blockquote"
    | "code"
    | "table"
    | "divider";

/**
 * 一个节点。
 *
 * 块级与行内共用一张接口、用 `kind` 区分（与 `src/entity/chat.ts` 的
 * `ChatMessageKind` 同一套写法）：Vue 模板里的类型收窄按 `kind === "…"` 走，
 * 用联合类型反而会让模板中的字段访问变得别扭。哪些字段属于哪种节点，
 * 见每个字段的注释。
 */
export interface MarkdownNode {
    /** 节点类型 */
    kind: BlockKind | InlineKind;
    /** 在**本层**里的序号。仅供 Vue 的 `:key` 用，嵌套时会重号，故不叫 `id` */
    key: number;

    // ---- text / code / link / image ----
    /** `text` 的正文；`code` 的原始内容（行内单行、块级多行）；`image` 的说明文字 */
    text?: string;
    /** `link` / `image` 的目标；协议白名单外时为 `""` */
    href?: string;

    // ---- text ----
    /** 原样显示（协议白名单拦下的链接）：不带链接样式，提示可复制 */
    verbatim?: boolean;

    // ---- heading / table ----
    /** 标题层级；表格里表示「这是表头行」 */
    depth?: number;

    // ---- paragraph / heading / blockquote / list ----
    /** 行内子节点 */
    children?: MarkdownNode[];

    // ---- list ----
    /** 有序列表 */
    ordered?: boolean;
    /** 有序列表的起始序号（文中写 `3.` 就是 3） */
    start?: number;
    /** 列表项；每项是一个块级数组，项内可以有多个段落、子列表 */
    items?: MarkdownNode[][];
    /** 任务列表项是否勾选；与 `items` 一一对应，`null` 表示不是任务项 */
    checks?: Array<boolean | null>;

    // ---- code ----
    /** 代码块的语言标记（围栏后面的第一个词），没有就是 `""` */
    language?: string;

    // ---- table ----
    /** 表头行的单元格 */
    header?: MarkdownNode[];
    /** 数据行 */
    rows?: MarkdownNode[][];
    /** 每列对齐；`null` 表示不指定（按左对齐渲染） */
    aligns?: Array<"left" | "center" | "right" | null>;

    // ---- 所有块 ----
    /**
     * 这个块**后面**跟了几个空行。
     *
     * 空行本身不是内容（Markdown 里连续空行与一个空行等价），所以不生成节点，
     * 只在这里记个数：渲染端据此在块之间补一段竖向间距，否则「用空行分段」
     * 与「紧挨着两段」看起来会一模一样。最多记 2（够表达「空了一段」）。
     */
    trailingGaps?: number;
}

/** 解析选项。 */
export interface ParseOptions {
    /**
     * 段落内换行怎么处理：`true` 连接成空格（Markdown 语义），`false` 保留成
     * `<br>`。默认 `true`。
     */
    softBreak?: boolean;
    /**
     * 标题起始层级：`2` 表示文中 `#` 渲染成 `<h2>`。卡片标题若是 `<h2>`，
     * 正文就该从 `h3` 起，否则页面大纲会出现两个同级的「标题」。
     */
    headingBase?: number;
}

/* ------------------------------------------------------------------ 走查用到的正则 */

/** 无序列表项：缩进 + 标记 + 空格；`[^]` 与 `[\s\S]` 等价，这里用后者更好读。 */
const UNORDERED_ITEM = /^(\s*)([-*+])(?:[ \t]+([\s\S]*))?$/;

/** 有序列表项：缩进 + 数字 + `.` 或 `)` + 空格。 */
const ORDERED_ITEM = /^(\s*)(\d{1,9})[.)](?:[ \t]+([\s\S]*))?$/;

/** 任务列表项开头的勾选框。 */
const TASK_MARKER = /^\[([ xX])\][ \t]+([\s\S]*)$/;

/** 逐行扫描时先按行切分；末尾的空行由调用方 `trim` 掉，故这里不排 `\r`。 */
const LINE_BREAK = /\r\n|\r|\n/;

/* ------------------------------------------------------------------ 行内解析 */

/**
 * 该链接目标能不能渲染成可点的 `href`。
 *
 * 白名单见文件头「链接协议白名单」。识别不出协议的相对路径也放行——渲染的是
 * 本应用自己的页面（hash 路由与 `app://`），没有对外跳转的语义。
 *
 * @param raw 链接目标原文，可能带尖括号
 */
export function safeHref(raw: string): string {
    let href = raw.trim();

    // `[文字](<带 空格的 目标>)` 是 CommonMark 的写法，尖括号只是定界符
    if (href.startsWith("<") && href.endsWith(">")) {
        href = href.slice(1, -1).trim();
    }
    if (href.length === 0) {
        return "";
    }

    // 剥掉控制字符与空白：`java\tscript:` 这类写法靠它们绕过前缀判断
    let plain = "";
    for (const character of href) {
        const code = character.charCodeAt(0);
        if (code <= 0x20 || code === 0x7f) {
            continue;
        }
        plain += character;
    }

    const colon = plain.indexOf(":");
    const scheme = colon === -1 ? "" : plain.slice(0, colon).toLowerCase();
    const slashed = plain.startsWith("/") || plain.startsWith("#") || plain.startsWith("./") || plain.startsWith("../");

    if (scheme === "http" || scheme === "https" || scheme === "mailto") {
        return plain;
    }
    if (scheme.length === 0 && slashed) {
        return plain;
    }

    // 其余一律拦下：`javascript:` / `data:` / `vbscript:` / `file:` / 认不出的协议
    return "";
}

/**
 * 解析一行行内文本。
 *
 * 扫描是**单趟线性**的：`index` 一路向右，每个位置按固定的优先级试一遍
 * （见 `parseInlineAt`），命中就把节点塞进结果、跳过已消费的长度。因此不存在
 * 「正则嵌套正则」那种回溯，也不会有深层递归——嵌套只发生在真正成对的结构里
 * （`**…**` 里再有一个 `` `…` ``），深度由输入长度兜住。
 *
 * @param source 单行文本（不含换行）
 */
export function parseInline(source: string): MarkdownNode[] {
    return scanInline(source, 0, source.length, 0);
}

/**
 * 在 `[from, to)` 里扫描行内节点，并把结果直接推入 `out`。
 *
 * @param source 整段文本
 * @param from 起点（含）
 * @param to 终点（不含）
 * @param depth 当前嵌套深度；超过 `MAX_INLINE_DEPTH` 后不再解析标记
 * @param out 结果数组；省略时新建一个
 */
function scanInline(
    source: string,
    from: number,
    to: number,
    depth: number,
    out: MarkdownNode[] = []
): MarkdownNode[] {
    /** 一段连续纯文本的起点；遇到标记时先把 `[textFrom, index)` 交出去。 */
    let textFrom = from;
    let index = from;

    /** 把待定的纯文本收成一个节点。空白段丢掉——标记之间的空白没有意义。 */
    const flush = (upTo: number): void => {
        if (upTo > textFrom) {
            const text = source.slice(textFrom, upTo);
            if (text.trim().length > 0) {
                out.push({ kind: "text", key: out.length, text: text });
            }
        }
    };

    while (index < to) {
        const hit = depth < MAX_INLINE_DEPTH ? parseInlineAt(source, index, to, depth) : null;

        if (hit === null) {
            index += 1;
            continue;
        }

        flush(index);
        out.push(hit.node);
        index = hit.next;
        textFrom = index;
    }

    flush(to);
    return out;
}

/** 行内标记的最大嵌套深度：超出后标记按纯文本显示，避免构造畸形输入打深递归。 */
const MAX_INLINE_DEPTH = 6;

/** `parseInlineAt` 的返回值：一个节点 + 它消费到的位置。 */
interface InlineHit {
    node: MarkdownNode;
    next: number;
}

/**
 * 试在 `index` 处解析一个行内结构。
 *
 * 优先级即下面的书写顺序，越靠前越先命中：
 *
 * 1. **转义** `` \* `` —— 最高优先级，否则没法原样写出标记字符；
 * 2. **行内代码** `` ` `` —— 代码里面什么都不解析，所以必须早于强调；
 * 3. **图片 / 链接** —— `[` 开头，先于强调，免得 `[**粗**](…)` 被拆错；
 * 4. **自动链接** `<https://…>`；
 * 5. **硬换行**（行尾两空格 + 换行）；
 * 6. **删除线** `~~`，7. **粗体** `**`，8. **斜体** `*` / `_`；
 * 9. **纯文本**兜底永远返回 `null`，交给调用方继续扫。
 *
 * @param source 整段文本
 * @param index 当前扫描位置
 * @param to 本层扫描的终点（不含）
 * @param depth 当前嵌套深度
 */
function parseInlineAt(source: string, index: number, to: number, depth: number): InlineHit | null {
    const character = source[index];

    // 1. 转义：`\*` 显示成 `*`，不当标记
    if (character === "\\") {
        const next = source[index + 1];
        if (next !== undefined && index + 1 < to && isEscapable(next)) {
            return { node: { kind: "text", key: 0, text: next }, next: index + 2 };
        }
        return { node: { kind: "text", key: 0, text: "\\" }, next: index + 1 };
    }

    // 2. 行内代码：成对的等长反引号，内部不做任何解析
    if (character === "`") {
        return parseCodeSpan(source, index, to);
    }

    // 3. 图片与链接
    if (character === "[") {
        return parseLinkOrImage(source, index, to, depth);
    }

    // 4. 自动链接：`<https://example.com>`
    if (character === "<") {
        return parseAutolink(source, index, to);
    }

    // 5. 硬换行：行尾两个及以上空格再换行
    if (character === "\n" && index > 0 && / {2,}$/.test(source.slice(0, index))) {
        return { node: { kind: "break", key: 0 }, next: index + 1 };
    }

    // 6~8. 强调类标记
    if (character === "~" && source.startsWith("~~", index)) {
        return parseWrapped(source, index, to, depth, "~~", "strike");
    }
    if (character === "*" || character === "_") {
        const doubled = character + character;
        if (source.startsWith(doubled, index)) {
            return parseWrapped(source, index, to, depth, doubled, "strong");
        }

        // 单字符标记不能跨空白：`a * b * c` 里的两个星号是乘号，不是斜体。
        // 这是 Markdown 里最容易被误伤的写法，判定条件必须收在这一处。
        const inner = source.slice(index + 1, to);
        if (inner.length > 0 && !/^\s/.test(inner)) {
            return parseWrapped(source, index, to, depth, character, "emphasis");
        }
    }

    return null;
}

/** 转义表：只有这些字符前面的反斜杠有「原样显示」的含义。 */
function isEscapable(character: string): boolean {
    return "\\`*_{}[]()#+-.!>~|".includes(character);
}

/**
 * 行内代码：`` `x` `` 或 ``` ``a`b`` ```。
 *
 * 开头的反引号有几个，收尾就要求同样个数——否则 ``` `` ``` 里没法包含单个反引号。
 *
 * @param source 整段文本
 * @param index 反引号所在位置
 * @param to 本层终点
 */
function parseCodeSpan(source: string, index: number, to: number): InlineHit | null {
    let open = index;
    while (open < to && source[open] === "`") {
        open += 1;
    }
    const fence = source.slice(index, open);

    const close = source.indexOf(fence, open);
    if (close === -1 || close >= to) {
        // 没有收尾：按纯文本显示，不去猜用户想写什么
        return { node: { kind: "text", key: 0, text: fence }, next: open };
    }

    // CommonMark 规定：` x ` 两端各留一个空格时，空格是定界用的，不算内容
    let content = source.slice(open, close);
    if (content.length > 2 && content.startsWith(" ") && content.endsWith(" ") && content.trim().length > 0) {
        content = content.slice(1, -1);
    }

    return { node: { kind: "code", key: 0, text: content }, next: close + fence.length };
}

/**
 * 图片或链接：`[文字](目标)` / `![说明](目标)`。
 *
 * 链接文字递归解析（里面可以再放粗体、代码），目标只过白名单。
 *
 * @param source 整段文本
 * @param index `[` 或 `![` 的 `[` 所在位置
 * @param to 本层终点
 * @param depth 当前嵌套深度
 */
function parseLinkOrImage(source: string, index: number, to: number, depth: number): InlineHit | null {
    const isImage = index > 0 && source[index - 1] === "!";
    const labelFrom = index + 1;

    // 找配对的 `]`：`[` / `]` 成对计数，`\[` `\]` 不算
    let cursor = labelFrom;
    let level = 0;
    let labelTo = -1;
    while (cursor < to) {
        const character = source[cursor];
        if (character === "\\") {
            cursor += 2;
            continue;
        }
        if (character === "[") {
            level += 1;
        } else if (character === "]") {
            if (level === 0) {
                labelTo = cursor;
                break;
            }
            level -= 1;
        }
        cursor += 1;
    }

    if (labelTo === -1 || source[labelTo + 1] !== "(") {
        return null;
    }

    // 目标里可能带尖括号，尖括号里的 `)` 不算收尾
    let targetCursor = labelTo + 2;
    let inBrackets = false;
    let targetTo = -1;
    while (targetCursor < to) {
        const character = source[targetCursor];
        if (character === "<") {
            inBrackets = true;
        } else if (character === ">") {
            inBrackets = false;
        } else if (character === ")" && !inBrackets) {
            targetTo = targetCursor;
            break;
        }
        targetCursor += 1;
    }

    if (targetTo === -1) {
        return null;
    }

    const label = source.slice(labelFrom, labelTo);
    const href = safeHref(source.slice(labelTo + 2, targetTo));
    const next = targetTo + 1;

    if (isImage) {
        return { node: { kind: "image", key: 0, text: label, href: href }, next: next };
    }

    // 目标被白名单拦下（或本来就是空的）：文字照常显示，只是点不动。
    // `verbatim` 让渲染端知道这是「被拦下的链接」，可以给一个可复制的样式。
    const children = scanInline(label, 0, label.length, depth + 1);
    if (href.length === 0) {
        return {
            node: { kind: "text", key: 0, text: label, verbatim: true, children: children },
            next: next
        };
    }

    return { node: { kind: "link", key: 0, href: href, children: children }, next: next };
}

/**
 * 自动链接：`<https://example.com>`。
 *
 * 只认 `https:`。`http:` 与裸网址都留着不动：前者是明文跳转，后者会把用户贴的
 * 数据里所有网址变成可点目标。邮箱 `<a@b.com>` 也不认——这个项目里没有发信场景。
 *
 * @param source 整段文本
 * @param index `<` 所在位置
 * @param to 本层终点
 */
function parseAutolink(source: string, index: number, to: number): InlineHit | null {
    const close = source.indexOf(">", index + 1);
    if (close === -1 || close >= to) {
        return null;
    }

    const target = source.slice(index + 1, close);
    if (!target.startsWith("https://") || /[\s<]/.test(target)) {
        return null;
    }

    const href = safeHref(target);
    if (href.length === 0) {
        return null;
    }

    return { node: { kind: "link", key: 0, href: href, children: [{ kind: "text", key: 0, text: target }] }, next: close + 1 };
}

/**
 * 成对定界符包起来的一段：`**粗**`、`*斜*`、`~~删~~`。
 *
 * 三条判定，缺一就会把普通文本吃掉：
 *
 * - 内容不能为空，也不能以空白开头或结尾（`** 粗 **` 在 Markdown 里不是粗体）；
 * - 收尾标记必须能找到；
 * - 单字符标记（`*` `_`）的收尾后面不能紧跟字母数字，否则 `a * b * c` 的乘号
 *   会被当成斜体标记——中文正文里这种写法比真正的斜体常见。
 *
 * @param source 整段文本
 * @param index 起始标记位置
 * @param to 本层终点
 * @param depth 当前嵌套深度
 * @param token 定界符（`*` / `**` / `~~`）
 * @param kind 命中后生成的节点类型
 */
function parseWrapped(
    source: string,
    index: number,
    to: number,
    depth: number,
    token: string,
    kind: InlineKind
): InlineHit | null {
    const contentFrom = index + token.length;

    // 单字符标记的左边界：`**` 情况已在上游分流，这里只需要防 `***` 被拆成 `**` + `*`
    if (token.length === 1 && source.startsWith(token + token, index)) {
        return null;
    }

    const close = source.indexOf(token, contentFrom);
    if (close === -1 || close >= to) {
        return null;
    }

    const content = source.slice(contentFrom, close);
    if (content.length === 0 || /^\s/.test(content) || /\s$/.test(content)) {
        return null;
    }
    if (token.length === 1 && /[0-9A-Za-z\u4e00-\u9fff]/.test(source[close + 1] ?? "")) {
        return null;
    }

    return {
        node: { kind: kind, key: 0, children: scanInline(source, contentFrom, close, depth + 1) },
        next: close + token.length
    };
}

/* ------------------------------------------------------------------ 块级解析 */

/** 一行的定位：`start` 含、`end` 不含，都不带换行符。 */
interface LineSpan {
    start: number;
    end: number;
}

/**
 * 块的归并器：把「一行行喂进来」的状态收敛成一个地方。
 *
 * 每个解析函数只管认出自己那种行的开头，之后交给 `push` 继续吃同一类型的行，
 * 遇到别的类型就 `finish` 收尾。归并器负责三件杂事：
 *
 * 1. **空行归属**：空行先记在 `gaps` 里，等下一个块开始时才贴到**上一个**块的尾部，
 *    这样用它们做 `:key` 时不会随插入新块而整体位移；
 * 2. **连续的同类块合并**：段落、列表的后续行不需要重新开一个块；
 * 3. **跳过空行**：正文里连续几个空行与一个空行的效果相同。
 */
class BlockBuilder {
    /** 已经收好的块。 */
    public readonly nodes: MarkdownNode[] = [];

    /** 正在构造的块；`null` 表示还没开始。 */
    private open: MarkdownNode | null = null;

    /** 已读到、但还没决定归属的空行。 */
    private gaps: LineSpan[] = [];

    /** 正文里只允许一层引用块/列表嵌套的深度上限，防止畸形输入打深递归。 */
    public static readonly MAX_NEST = 6;

    /**
     * 喂一个块进来。
     *
     * @param node 要收的块
     * @param merge 是否并入正在构造的同类块（段落与列表的续行）
     */
    public push(node: MarkdownNode, merge = false): void {
        if (merge && this.open !== null) {
            this.merge(node);
            return;
        }

        this.flush();
        this.open = node;
    }

    /** 空行：先记下，归属由下一个块决定（见类注释）。 */
    public gap(span: LineSpan): void {
        this.gaps.push(span);
    }

    /** 收尾：把正在构造的块连同空行一起落盘，返回全部块。 */
    public done(): MarkdownNode[] {
        this.flush();
        return this.nodes;
    }

    /** 把一个块并进当前块。只有段落与列表会走到这里。 */
    private merge(node: MarkdownNode): void {
        const current = this.open;
        if (current === null) {
            return;
        }

        if (current.kind === "paragraph" && node.kind === "paragraph") {
            current.text = `${current.text ?? ""}\n${node.text ?? ""}`;
            return;
        }

        if (current.kind === "list" && node.kind === "list") {
            // 有序与无序相邻时不能合并：`- a` 后面跟 `1. b` 是两种列表
            if (current.ordered === node.ordered) {
                current.items = [...(current.items ?? []), ...(node.items ?? [])];
                current.checks = [...(current.checks ?? []), ...(node.checks ?? [])];
                return;
            }
        }

        // 合并不了：正常收尾，再开一块
        this.flush();
        this.open = node;
    }

    /** 收尾当前块：先把空行贴给它，再存进结果。 */
    private flush(): void {
        const current = this.open;
        if (current === null) {
            return;
        }

        // 尾随空行留几行：一行的容器是撑不开的，多行才有「空了一段」的视觉效果。
        // 渲染端只读前两个（`.md-block__gap`），多出来的不渲染。
        current.items = [...(current.items ?? []), ...this.gaps.map((span) => ({
            kind: "text" as InlineKind,
            key: 0,
            text: ""
        }))];

        this.gaps = [];
        this.nodes.push(current);
        this.open = null;
    }
}

/**
 * 把一段 Markdown 解析成块级节点树。
 *
 * 纯函数：同样的输入永远得到同样的输出，不改参数、不碰全局状态。
 *
 * @param source Markdown 原文
 * @param options 见 `ParseOptions`
 */
export function parseMarkdown(source: string, options: ParseOptions = {}): MarkdownNode[] {
    const softBreak = options.softBreak ?? true;
    const headingBase = Math.min(Math.max(options.headingBase ?? 1, 1), 6);

    const builder = new BlockBuilder();
    const lines = splitLines(source);
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const text = source.slice(line.start, line.end);

        if (text.trim().length === 0) {
            builder.gap(line);
            index += 1;
            continue;
        }

        // 每个解析函数返回它消费掉的**下一个**行号；原样返回 `index` 表示没认出这种行
        const next =
            parseFence(source, lines, index, builder) ??
            parseHeading(source, lines, index, builder, headingBase) ??
            parseDivider(text, lines, index, builder) ??
            parseTable(source, lines, index, builder) ??
            parseBlockquote(source, lines, index, builder, softBreak, headingBase) ??
            parseList(source, lines, index, builder, softBreak, headingBase) ??
            parseParagraph(source, lines, index, builder, softBreak);

        index = next > index ? next : index + 1;
    }

    return builder.done();
}

/** 按行切分，给出每行的区间（不含换行符与行尾 `\r`）。 */
function splitLines(source: string): LineSpan[] {
    const spans: LineSpan[] = [];
    let start = 0;

    while (start <= source.length) {
        const at = source.slice(start).search(LINE_BREAK);
        const stop = at === -1 ? source.length : start + at;

        if (stop > start && source[stop - 1] === "\r") {
            spans.push({ start: start, end: stop - 1 });
        } else {
            spans.push({ start: start, end: stop });
        }

        if (stop >= source.length) {
            break;
        }

        const jump = source.startsWith("\r\n", stop) ? 2 : 1;
        start = stop + jump;
    }

    return spans;
}

/** 取第 `index` 行的原文。 */
function lineAt(source: string, lines: LineSpan[], index: number): string {
    const line = lines[index];
    return line === undefined ? "" : source.slice(line.start, line.end);
}

/**
 * 围栏代码块：``` 或 ~~~。
 *
 * 一个反引号的行内代码已经在上游分走了，所以这里只认三个及以上。
 * 收尾围栏与开头同字符、且不短于开头。没有收尾就吃到文末——正在流式输出的
 * 代码块正是这个形态，不能因为没等到收尾就把它显示成普通段落。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 *
 * @returns 消费到的下一个行号；`null` 表示这一行不是围栏
 */
function parseFence(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder
): number | null {
    const opening = /^(`{3,}|~{3,})[ \t]*([^\s`]*)/.exec(lineAt(source, lines, index));
    if (opening === null) {
        return null;
    }

    const fence = opening[1];
    const character = fence[0];
    const closing = new RegExp(`^\\s*\\${character}{${fence.length},}\\s*$`);

    const body: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length && !closing.test(lineAt(source, lines, cursor))) {
        body.push(lineAt(source, lines, cursor));
        cursor += 1;
    }

    builder.push({
        kind: "code",
        key: builder.nodes.length,
        text: body.join("\n"),
        language: opening[2] ?? ""
    });

    return cursor < lines.length ? cursor + 1 : cursor;
}

/**
 * ATX 标题：`#` 到 `######`，井号后必须有空格（`#标签` 不是标题）。
 *
 * 结尾的井号是装饰（`## 标题 ##`），按 CommonMark 去掉。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 * @param headingBase 标题起始层级
 */
function parseHeading(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder,
    headingBase: number
): number | null {
    const matched = /^(#{1,6})[ \t]+(.*?)[ \t]*$/.exec(lineAt(source, lines, index));
    if (matched === null) {
        return null;
    }

    const raw = matched[2].replace(/[ \t]+#+[ \t]*$/, "");
    const depth = Math.min(matched[1].length + headingBase - 1, 6);

    builder.push({ kind: "heading", key: builder.nodes.length, depth: depth, children: parseInline(raw) });
    return index + 1;
}

/**
 * 分隔线：`---` / `***` / `___`（三个及以上，中间可有空格）。
 *
 * 必须排在表格之前判断，否则 `---` 会被表格的分隔行规则抢走。
 *
 * @param text 当前行原文
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 */
function parseDivider(
    text: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder
): number | null {
    if (!/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(text)) {
        return null;
    }

    builder.push({ kind: "divider", key: builder.nodes.length });
    return index + 1;
}

/**
 * 表格：表头行 + `---` 分隔行 + 若干数据行。
 *
 * 分隔行决定列数与每列对齐（`:--` 左、`:-:` 中、`--:` 右）。只有分隔行成立时
 * 才认，否则 `a | b` 这样的普通文本会被误吃成表格。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 */
function parseTable(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder
): number | null {
    const head = lineAt(source, lines, index);
    const rule = lineAt(source, lines, index + 1);

    if (!head.includes("|") || index + 1 >= lines.length) {
        return null;
    }

    const aligns = parseAligns(rule);
    if (aligns === null) {
        return null;
    }

    const header = splitCells(head).map(
        (cell): MarkdownNode => ({ kind: "table-cell", key: 0, depth: 1, children: parseInline(cell) })
    );

    // 表头列数为准：数据行多出来的列丢掉、少的列补空，渲染出来的表格才不会错位
    const rows: MarkdownNode[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length) {
        const row = lineAt(source, lines, cursor);
        if (row.trim().length === 0 || !row.includes("|")) {
            break;
        }

        const cells = splitCells(row);
        const filled: MarkdownNode[] = [];
        for (let column = 0; column < aligns.length; column += 1) {
            const cell = cells[column] ?? "";
            filled.push({ kind: "table-cell", key: column, children: parseInline(cell) });
        }
        rows.push(filled);
        cursor += 1;
    }

    builder.push({
        kind: "table",
        key: builder.nodes.length,
        aligns: aligns,
        header: header,
        rows: rows
    });

    return cursor;
}

/**
 * 读分隔行：返回每列对齐；不是分隔行时返回 `null`。
 *
 * @param rule 分隔行原文
 */
function parseAligns(rule: string): Array<"left" | "center" | "right" | null> | null {
    if (!rule.includes("|") && !/^[ \t]*:?-+:?[ \t]*$/.test(rule)) {
        return null;
    }

    const cells = splitCells(rule);
    if (cells.length === 0) {
        return null;
    }

    const aligns: Array<"left" | "center" | "right" | null> = [];
    for (const cell of cells) {
        const trimmed = cell.trim();
        if (!/^:?-+:?$/.test(trimmed)) {
            return null;
        }

        const left = trimmed.startsWith(":");
        const right = trimmed.endsWith(":");
        aligns.push(left && right ? "center" : right ? "right" : left ? "left" : null);
    }

    return aligns;
}

/**
 * 按竖线切单元格：跳过 `\|` 转义的竖线，去掉首尾那条界定用的竖线。
 *
 * @param row 表格行原文
 */
function splitCells(row: string): string[] {
    let text = row.trim();

    // 首尾竖线只是界定符，不是空列。转义的 `\|` 在别处，不受影响
    if (text.startsWith("|")) {
        text = text.slice(1);
    }
    if (text.endsWith("|") && !text.endsWith("\\|")) {
        text = text.slice(0, -1);
    }

    const cells: string[] = [];
    let current = "";
    let cursor = 0;
    while (cursor < text.length) {
        const character = text[cursor];
        if (character === "\\" && text[cursor + 1] === "|") {
            current += "\\|";
            cursor += 2;
            continue;
        }
        if (character === "|") {
            cells.push(current.trim());
            current = "";
            cursor += 1;
            continue;
        }
        current += character;
        cursor += 1;
    }
    cells.push(current.trim());

    return cells;
}

/**
 * 引用：`>` 开头，可嵌套。
 *
 * 把引号剥掉一层之后交给 `parseMarkdown` 递归——递归会自然处理「引用里有列表、
 * 列表里又有引用」的组合，不必在这里再写一遍块级规则。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 * @param softBreak 段落内换行策略
 * @param headingBase 标题起始层级
 */
function parseBlockquote(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder,
    softBreak: boolean,
    headingBase: number
): number | null {
    if (!/^ {0,3}>/.test(lineAt(source, lines, index))) {
        return null;
    }

    const body: string[] = [];
    let cursor = index;
    while (cursor < lines.length) {
        const line = lineAt(source, lines, cursor);
        if (line.trim().length === 0) {
            break;
        }
        if (!/^ {0,3}>/.test(line)) {
            // 「懒续行」：引用里不写 `>` 的续行，只要不是空行就还算引用
            if (body.length > 0) {
                body.push(line);
                cursor += 1;
                continue;
            }
            break;
        }
        body.push(line.replace(/^ {0,3}>[ \t]?/, ""));
        cursor += 1;
    }

    builder.push({
        kind: "blockquote",
        key: builder.nodes.length,
        children: parseMarkdown(body.join("\n"), { softBreak: softBreak, headingBase: headingBase })
    });

    return cursor;
}

/**
 * 列表：`-` / `*` / `+` / `1.` / `1)`，缩进 2 格算下一级。
 *
 * 只处理「一层列表的若干项」，每项内部再递归成块——因此项里可以放第二个段落、
 * 代码块或子列表，而缩进规则只有「2 格一级」一条。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 * @param softBreak 段落内换行策略
 * @param headingBase 标题起始层级
 *
 * @returns 消费到的下一个行号；`null` 表示这一行不是列表项
 */
function parseList(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder,
    softBreak: boolean,
    headingBase: number
): number | null {
    const first = readItem(lineAt(source, lines, index));
    if (first === null) {
        return null;
    }

    const items: MarkdownNode[][] = [];
    const checks: Array<boolean | null> = [];
    let cursor = index;

    while (cursor < lines.length) {
        const line = lineAt(source, lines, cursor);

        // 空行：可能是项与项之间的间隔，也可能是列表结束。往后看一行再决定
        if (line.trim().length === 0) {
            const following = readItem(lineAt(source, lines, cursor + 1));
            if (following === null || following.ordered !== first.ordered) {
                break;
            }
            cursor += 1;
            continue;
        }

        const item = readItem(line);
        if (item === null || item.ordered !== first.ordered || item.indent > first.indent) {
            break;
        }

        // 收集这一项的内容：本行余下的部分，加上后续的懒续行与更深缩进的行
        const body: string[] = [item.text];
        cursor += 1;
        while (cursor < lines.length) {
            const inner = lineAt(source, lines, cursor);
            if (inner.trim().length === 0) {
                // 项内空行：只有下一行还是这一项的内容（缩进更深）才留着
                const ahead = readItem(lineAt(source, lines, cursor + 1));
                const indented = /^\s{2,}/.test(lineAt(source, lines, cursor + 1));
                if (ahead !== null && ahead.indent > first.indent) {
                    body.push("");
                    cursor += 1;
                    continue;
                }
                if (indented) {
                    body.push("");
                    cursor += 1;
                    continue;
                }
                break;
            }

            const nested = readItem(inner);
            if (nested !== null && nested.indent <= first.indent) {
                break;
            }
            if (/^\s/.test(inner)) {
                // 缩进更深：这一项的一部分，剥掉本级的缩进再递归
                body.push(inner.slice(Math.min(item.indent + 2, inner.length - inner.trimStart().length)));
                cursor += 1;
                continue;
            }
            if (nested === null && !/^\s{0,3}(#{1,6}[ \t]|>|`{3,}|~{3,})/.test(inner)) {
                // 懒续行：不缩进也不算新块的普通文字，归到这一项
                body.push(inner);
                cursor += 1;
                continue;
            }
            break;
        }

        const task = TASK_MARKER.exec(body[0]);
        if (task !== null) {
            body[0] = task[2];
            checks.push(task[1].toLowerCase() === "x");
        } else {
            checks.push(null);
        }

        items.push(parseMarkdown(body.join("\n"), { softBreak: softBreak, headingBase: headingBase }));
    }

    builder.push({
        kind: "list",
        key: builder.nodes.length,
        ordered: first.ordered,
        start: first.start,
        items: items,
        checks: checks
    });

    return cursor;
}

/** `readItem` 的结果：缩进宽度、有序与否、起始序号、标记之后的内容。 */
interface ListItem {
    indent: number;
    ordered: boolean;
    start: number;
    text: string;
}

/**
 * 认一个列表项。
 *
 * 标记后必须有空格——`-1` 与 `*粗*` 都不是列表项，`- ` 才是。
 *
 * @param line 行原文
 */
function readItem(line: string): ListItem | null {
    const unordered = UNORDERED_ITEM.exec(line);
    if (unordered !== null && /[ \t]/.test(line.slice(unordered[1].length + 1, unordered[1].length + 2))) {
        return {
            indent: unordered[1].length,
            ordered: false,
            start: 1,
            text: unordered[3] ?? ""
        };
    }

    const ordered = ORDERED_ITEM.exec(line);
    if (ordered !== null && /[ \t]/.test(line.slice(ordered[1].length + ordered[2].length + 1, ordered[1].length + ordered[2].length + 2))) {
        return {
            indent: ordered[1].length,
            ordered: true,
            start: Number(ordered[2]),
            text: ordered[3] ?? ""
        };
    }

    return null;
}

/**
 * 段落：兜底。
 *
 * 收下所有「不像别的块、也不空」的行：它们本来就是普通文字。段落里的软换行
 * 由 `softBreak` 决定渲染成空格还是 `<br>`，拼接时统一保留成 `\n`，
 * 交给渲染端按需处理。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 当前行号
 * @param builder 归并器
 * @param softBreak 段落内换行策略
 */
function parseParagraph(
    source: string,
    lines: LineSpan[],
    index: number,
    builder: BlockBuilder,
    softBreak: boolean
): number {
    const body: string[] = [];
    let cursor = index;

    while (cursor < lines.length) {
        const line = lineAt(source, lines, cursor);
        if (line.trim().length === 0) {
            break;
        }

        // 只有一个「空行 + 下一行」的组合成表格/列表/标题时必须让位，
        // 否则 `文字\n| a | b |\n| - | - |` 会被整段吃成一个段落
        if (cursor > index && startsAnotherBlock(source, lines, cursor)) {
            break;
        }

        body.push(line.trim());
        cursor += 1;
    }

    // 软换行先统一存成 `\n`；要连成一行时在渲染端处理（`MarkDownCard` 的 display 样式）
    const text = body.join("\n");
    builder.push({ kind: "paragraph", key: builder.nodes.length, text: softBreak ? text : text.replace(/\n/g, "  \n") }, true);

    return cursor;
}

/**
 * 这一行是不是另一个块的开始（用于决定段落在哪里断开）。
 *
 * 只看「必须由当前行开头才算数」的那几种：表格需要两行所以单独判。
 *
 * @param source 整段文本
 * @param lines 行区间
 * @param index 待判断的行号
 */
function startsAnotherBlock(source: string, lines: LineSpan[], index: number): boolean {
    const line = lineAt(source, lines, index);

    if (/^ {0,3}(#{1,6}[ \t]|>|`{3,}|~{3,})/.test(line)) {
        return true;
    }
    if (/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line)) {
        return true;
    }
    if (readItem(line) !== null) {
        return true;
    }

    // 表格：本行有竖线，且下一行是合法的分隔行
    if (line.includes("|") && parseAligns(lineAt(source, lines, index + 1)) !== null) {
        return true;
    }

    return false;
}

/* ------------------------------------------------------------------ 渲染辅助 */

/**
 * 把一个节点（连同其子节点）压成纯文本。
 *
 * `MarkDownCard` 用它生成卡片的默认标题与 `aria-label`：给一个节点树配上
 * 「用眼睛看是什么」之外的一行字，屏幕阅读器与搜索都用得上。
 *
 * @param node 任意节点
 * @param softBreak 段落内换行是否保留为换行，默认 `false`（连成一行）
 */
export function plainText(node: MarkdownNode, softBreak = false): string {
    const parts: string[] = [];

    const walk = (current: MarkdownNode): void => {
        switch (current.kind) {
            case "text":
                parts.push(current.text ?? "");
                break;
            case "code":
                parts.push(current.text ?? "");
                break;
            case "break":
                parts.push(softBreak ? "\n" : " ");
                break;
            case "image":
                parts.push(current.text ?? "");
                break;
            case "list":
                for (const item of current.items ?? []) {
                    for (const child of item) {
                        walk(child);
                    }
                    parts.push(softBreak ? "\n" : " ");
                }
                break;
            case "table":
                for (const cell of [...(current.header ?? []), ...(current.rows ?? []).flat()]) {
                    walk(cell);
                    parts.push(" ");
                }
                break;
            default:
                for (const child of current.children ?? []) {
                    walk(child);
                }
        }
    };

    walk(node);

    const text = parts.join("");
    return softBreak ? text.trim() : text.replace(/\s+/g, " ").trim();
}

/**
 * 取一段 Markdown 的纯文本摘要。
 *
 * 卡片折叠、列表预览这类地方需要「正文前几十个字」，直接用原文会把标记符号也
 * 带出来（`## 标题` 显示成「## 标题」）。这里走一遍解析再压平。
 *
 * @param source Markdown 原文
 * @param limit 最多多少个字符；`0` 表示不截断
 */
export function summarizeMarkdown(source: string, limit = 80): string {
    const text = parseMarkdown(source)
        .map((node): string => plainText(node))
        .filter((part): boolean => part.length > 0)
        .join(" ");

    if (limit <= 0 || text.length <= limit) {
        return text;
    }

    return `${text.slice(0, limit)}…`;
}
