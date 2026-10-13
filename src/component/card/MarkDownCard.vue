<script setup lang="ts">
/**
 * Markdown 卡片：`ElCard` + header / body / footer 三块插槽。
 *
 * ## 与 `ElCard` 的关系
 *
 * 根节点**就是** `ElCard`，不是另画一个长得像的盒子。所以 `ElCard` 自己的
 * 三块插槽在这里逐个透出：
 *
 * | 插槽 | 落到 `ElCard` 的 | 默认内容 | `ElCard` 的 props 等价物 |
 * | ---- | --------------- | -------- | ----------------------- |
 * | `header` | `#header` | `title`，没有就给 `MarkdownBlock` 压出的纯文本标题 | `header` |
 * | 默认插槽 | 默认插槽（`body`） | 由 `markdown` 解析出的正文 | —（`ElCard` 的默认插槽没有 props） |
 * | `footer` | `#footer` | 无；`footer` prop 可直接给一行字 | `footer` |
 *
 * 三个插槽的作用域参数：默认插槽给 `{ nodes }`（解析出的节点树，想自己排版时用），
 * `header` 与 `footer` 没有参数。
 *
 * `bodyStyle` / `bodyClass` 直接透给 `ElCard` 的 `body-style` / `body-class`；
 * 其余落在根节点上的属性（`class` / `style` / `id` / 事件）由 `inheritAttrs: false`
 * 之后的 `v-bind="$attrs"` 原样带上，与 `ElCard` 自己的行为一致。这些名字都刻意
 * 与 `ElCard` 对齐，从 `ElCard` 换过来不用改调用处。
 *
 * ## 三块插槽负责什么
 *
 * - **header** 是标题区：`ElCard` 已经给了下边框与内边距，默认内容只写一行字，
 *   图标、标签、按钮这些交给调用方从 `#header` 里自己排；
 * - **body** 是正文：Markdown 渲染的**唯一**落点。滚动、留白都由 `ElCard` 的正文区
 *   决定，本组件不额外套滚动容器，免得出现「卡片里还有一个滚动条」；
 * - **footer** 是脚注区：来源、口径、时间这类附注。默认不渲染任何东西，
 *   `footer` prop 给一行字或 `#footer` 插槽给一段 DOM 都行。
 *
 * ## 正文怎么来的
 *
 * `markdown-parse.ts` 把 `markdown` 解析成节点树，`MarkdownBlock.vue` 递归渲染。
 * 全程没有 `v-html`，语法白名单外的写法一律按纯文本显示——理由与取舍写在
 * `markdown-parse.ts` 的文件头。
 *
 * `ast` 与 `markdown` 二选一：给了 `ast` 就不再解析（用于把一段正文解析一次、
 * 渲染到多张卡片上）。两者都没有时显示 `emptyText`，而不是一张空卡片。
 *
 * ## 与 `ChatMessageBubble` 的重合部分先不动
 *
 * 聊天气泡现在是「按空行切段 + `pre-wrap`」，够用且已经验证过。本卡片是给
 * 「真正要渲染表格与代码块」的地方准备的（例如知识库条目、报告、说明页）；
 * 等哪天要把气泡也换成它，把气泡的四种形态收口到本组件即可，现在不做。
 */

import { computed } from "vue";

import MarkdownBlock from "./MarkdownBlock.vue";
import { parseMarkdown, plainText } from "./markdown-parse";
import type { MarkdownNode, ParseOptions } from "./markdown-parse";

interface Props {
    /** 卡片标题；`#header` 插槽优先于它 */
    title?: string;
    /** Markdown 原文；与 `ast` 二选一 */
    markdown?: string;
    /** 已解析好的节点树；给了就不再解析 `markdown` */
    ast?: MarkdownNode[];
    /** 外观：`raw` 直接渲染原文，用于排查解析结果 */
    display?: "markdown" | "raw";
    /** 标题层级向上偏移几级：`headingBase` 是几，正文里的 `#` 就渲染成 `h几` */
    headingBase?: number;
    /** 段落内换行怎么处理：`true` 连成一行（Markdown 语义），`false` 保留成换行 */
    softBreak?: boolean;
    /** 解析选项；给了就整体覆盖 `headingBase`，两者同时给时以本项为准 */
    parseOptions?: ParseOptions;
    /** 是否渲染图片；默认关，远程图片会把「读一张卡片」变成一次对外请求 */
    allowImage?: boolean;
    /** 正文为空时的提示；给 `""` 就不渲染正文区 */
    emptyText?: string;
    /** 卡片阴影，同 `ElCard` */
    shadow?: "always" | "hover" | "never";
    /** 脚注纯文本，等价于 `ElCard` 的 `footer` prop */
    footer?: string;
    /** 传给 `ElCard` 的正文区行内样式 */
    bodyStyle?: string;
    /** 传给 `ElCard` 的正文区类名 */
    bodyClass?: string;
    /** 传给 `ElCard` 的标题区类名 */
    headerClass?: string;
    /** 传给 `ElCard` 的脚注区类名 */
    footerClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    title: "",
    markdown: "",
    ast: undefined,
    display: "markdown",
    // 3 而不是 2：卡片自己的标题是 `h2`，正文里的 `#` 若也渲染成 `h2`，页面上会出现
    // 两个同级标题，页面大纲读起来就是「两个标题」。所以正文从 `h3` 起。
    headingBase: 3,
    softBreak: true,
    parseOptions: undefined,
    allowImage: false,
    emptyText: "这张卡片还没有内容。",
    shadow: undefined,
    footer: "",
    bodyStyle: undefined,
    bodyClass: undefined,
    headerClass: undefined,
    footerClass: undefined
});

defineSlots<{
    /** 标题区内容；给了就不再渲染 `title` */
    header?: () => unknown;
    /** 正文区内容；作用域参数是解析出的节点树 */
    default?: (props: { nodes: MarkdownNode[] }) => unknown;
    /** 脚注区内容；给了就不再渲染 `footer` prop */
    footer?: () => unknown;
}>();

defineOptions({ inheritAttrs: false });

/** 实际生效的解析选项：`parseOptions` 优先，否则用 `headingBase` 与 `softBreak`。 */
const resolvedOptions = computed(
    (): ParseOptions =>
        props.parseOptions ?? { headingBase: props.headingBase, softBreak: props.softBreak }
);

/** 正文的节点树：`ast` 优先，其次解析 `markdown`。 */
const nodes = computed((): MarkdownNode[] =>
    props.ast !== undefined && props.ast !== null
        ? props.ast
        : parseMarkdown(props.markdown, resolvedOptions.value)
);

/** 正文源码；`display: "raw"` 时显示它。 */
const source = computed((): string => props.markdown);

/** 有没有可渲染的正文。 */
const hasBody = computed((): boolean => nodes.value.length > 0);

/**
 * 标题的兜底：没给 `title` 时取正文第一个标题块压出的文字。
 *
 * 只取 `heading`：拿第一段正文当标题会把一整段话塞进标题栏。压平走
 * `plainText`，因此标题里写 `**粗**`、`` `码` `` 也不会把标记符号带出来。
 */
const resolvedTitle = computed((): string => {
    if (props.title.length > 0) {
        return props.title;
    }

    const heading = nodes.value.find((node): boolean => node.kind === "heading");
    return heading === undefined ? "" : plainText(heading);
});

defineExpose({ nodes, markdown: source });
</script>

<template>
    <ElCard
        v-bind="$attrs"
        class="markdown-card"
        :shadow="props.shadow"
        :body-style="props.bodyStyle"
        :body-class="props.bodyClass"
        :header-class="props.headerClass"
        :footer-class="props.footerClass">
        <!-- 标题区：`ElCard` 只在下边框与内边距上做文章，默认内容就是一行字 -->
        <template v-if="$slots.header || resolvedTitle" #header>
            <slot name="header">
                <h2 class="markdown-card__title">{{ resolvedTitle }}</h2>
            </slot>
        </template>

        <!-- 正文区：Markdown 的唯一落点。
             `heading-base` 传 1 是**恒等**：解析时已经把本组件的 `headingBase` 算进
             `depth` 了，这里再偏移一次就是重复上移（`MarkdownBlock` 的公式是
             `depth + headingBase - 1`，传 0 会反而把标题压到 h1）。 -->
        <div class="markdown-card__body" :class="{ 'is-raw': props.display === 'raw' }">
            <slot :nodes="nodes">
                <pre
                    v-if="props.display === 'raw'"
                    class="markdown-card__raw"><code>{{ source }}</code></pre>

                <template v-else-if="hasBody">
                    <MarkdownBlock
                        v-for="node in nodes"
                        :key="node.key"
                        :node="node"
                        :heading-base="1"
                        :allow-image="props.allowImage"
                        :gap="0" />
                </template>

                <p v-else-if="props.emptyText.length > 0" class="markdown-card__empty">
                    {{ props.emptyText }}
                </p>
            </slot>
        </div>

        <!-- 脚注区：来源、口径、时间这类附注；默认什么都不渲染 -->
        <template v-if="$slots.footer || props.footer" #footer>
            <slot name="footer">
                <span class="markdown-card__footer">{{ props.footer }}</span>
            </slot>
        </template>
    </ElCard>
</template>

<style scoped>
/**
 * 正文排版的口径变量。
 *
 * 字号与行高对齐 `src/view/agent/chat/ChatMessageBubble.vue`（14px / 1.75）：
 * 全站说明性正文只有一套尺寸，卡片不该是例外。
 */
.markdown-card {
    --md-font-size: 14px;
    --md-font-mono:
        "Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo,
        monospace;
    --md-line-height: 1.75;

    /* 正文自带内边距：`ElCard` 的默认值（--el-card-padding）是为表单准备的，读文字偏松 */
    --el-card-padding: 16px 18px;
}

.markdown-card__title {
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
    margin: 0;
}

/**
 * 正文：只负责内边距与最小高度，排版细则在 `MarkdownBlock.vue` 里。
 *
 * `min-width: 0` 让宽表格能在自己的滚动容器里横向滚动，而不是把卡片撑宽。
 */
.markdown-card__body {
    min-width: 0;
}

.markdown-card__empty {
    color: var(--el-text-color-placeholder);
    font-size: var(--md-font-size);
    line-height: var(--md-line-height);
    margin: 0;
    text-align: center;
}

/* 原文视图：等宽、可横向滚动，不做任何 Markdown 解释 */
.markdown-card__raw {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    color: var(--el-text-color-regular);
    font-family: var(--md-font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    margin: 0;
    overflow-x: auto;
    padding: 10px 12px;
    white-space: pre-wrap;
}

.markdown-card__raw::-webkit-scrollbar,
.markdown-card::-webkit-scrollbar {
    height: 8px;
    width: 8px;
}

.markdown-card__raw::-webkit-scrollbar-thumb,
.markdown-card::-webkit-scrollbar-thumb {
    background: var(--el-border-color-darker);
    border-radius: 4px;
}

.markdown-card__footer {
    color: var(--el-text-color-secondary);
    display: block;
    font-size: 12px;
    line-height: 1.7;
}
</style>
