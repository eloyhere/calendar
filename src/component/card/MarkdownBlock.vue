<script setup lang="ts">
/**
 * 块渲染器：把一个**节点**（连同子树）渲染成 DOM。
 *
 * ## 为什么单独一个文件
 *
 * 正文是树：引用里有列表、列表项里又有段落与子列表。若把渲染写在
 * `MarkDownCard.vue` 里，就只能靠复制粘贴展开有限层，或者上 `v-html`——两条路都
 * 不要。这里让组件**递归引用自己**（`<MarkdownBlock>` 就是本组件），任意深度都
 * 有对应的 DOM，而模板只描述「一个节点长什么样」。
 *
 * ## 渲染纪律
 *
 * - 文本一律走 `{{ }}`（Vue 自动转义），属性一律走 `:href` 绑定；
 *   全组件没有 `innerHTML`，与 `markdown-parse.ts` 的「只出节点树」合起来，
 *   渲染链路上不存在能执行脚本的入口；
 * - `href` 的白名单在解析期就判完了（`safeHref`），这里只负责把 `""` 当成
 *   「不渲染成链接」。**不在这里补判**——判定只有一处，才不会两处慢慢跑偏。
 *
 * ## 与卡片的分工
 *
 * 本组件只管一个块自己以及它的缩进/间距（`gap`），不管卡片边框、标题、状态。
 * 那些是 `MarkDownCard.vue` 的事。
 */

import { computed } from "vue";

import type { MarkdownNode } from "./markdown-parse";

/** 本组件接受的节点类型：块级节点。行内节点由本组件内部直接渲染。 */
interface Props {
    /** 要渲染的节点；`paragraph` / `heading` / `list` / `table` / `code` 等 */
    node: MarkdownNode;
    /**
     * 这个节点后面有几个空行（0~2）。
     *
     * 空行在 Markdown 里不是内容，但「空一段」是作者写下来的意图，所以由解析器
     * 记数、这里落成 `margin-bottom`。块内的最后一个块不带间距（见样式）。
     */
    gap?: number;
    /** 标题层级偏移，与 `MarkDownCard` 的 `headingBase` 同一含义 */
    headingBase?: number;
    /** 是否渲染图片；默认关，理由见 `MarkDownCard.vue` 的 `allowImage` */
    allowImage?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    gap: 0,
    headingBase: 1,
    allowImage: false
});

/** 标题层级：解析出的层级 + 偏移，夹在 1~6（`h7` 不存在）。 */
const headingDepth = computed((): number =>
    Math.min(Math.max((props.node.depth ?? 1) + props.headingBase - 1, 1), 6)
);

/** 列表起始序号；非有序列表用不到。 */
const listStart = computed((): number => props.node.start ?? 1);

/** 每项是不是任务项、有没有勾上；与 `items` 一一对应，`null` 表示不是任务项。 */
const checks = computed((): Array<boolean | null> => props.node.checks ?? []);

/** 表格：表头单元格、数据行、每列对齐。 */
const headerCells = computed((): MarkdownNode[] => props.node.header ?? []);
const tableRows = computed((): MarkdownNode[][] => props.node.rows ?? []);

/**
 * 段落与标题按软换行切开。
 *
 * 解析器把软换行统一存成 `\n`：连成一行时是空格（Markdown 语义），保留换行时
 * 由 `softBreak: false` 在行尾补了两个空格、走行内解析的硬换行规则——两种写法
 * 到这里都只剩「`\n` 分段 + `<br>` 连接」一件事，渲染端不必再判配置。
 */
const textLines = computed((): string[] => (props.node.text ?? "").split("\n"));

/** 要渲染的块级子节点；`gap` 只落在最后一个上，避免块内处处留白。 */
const children = computed((): MarkdownNode[] => props.node.children ?? []);

/** 列表项：每项是一个块级数组。 */
const items = computed((): MarkdownNode[][] => props.node.items ?? []);

/** 表格列对齐：`<th>` / `<td>` 的 `align` 值。 */
const aligns = computed(
    (): Array<"left" | "center" | "right" | null | undefined> => props.node.aligns ?? []
);

/** 这个块的名字，只用来给模板分支和下文的注释对账。 */
const blockName = computed((): string => props.node.kind);

/**
 * 一列的渲染宽度：表格列数可能多于对齐声明（数据行多写的列已在上游截掉），
 * 这里按 `aligns` 的下标取值，越界就是「不指定」。
 *
 * @param order 列号
 */
function alignOf(order: number): "left" | "center" | "right" | undefined {
    return aligns.value[order] ?? undefined;
}

/**
 * 列表项里有没有可渲染的内容。
 *
 * 解析器为了留住「项内空一段」的写法，会往项里塞空段落；它们没有可见内容，
 * 渲染成 `<p>` 会白占一行，所以在列表项里滤掉。
 *
 * @param block 项内的一个块
 */
function hasContent(block: MarkdownNode): boolean {
    if (block.kind !== "paragraph") {
        return true;
    }

    const text = block.text ?? "";
    const inline = block.children ?? [];
    return text.trim().length > 0 || inline.length > 0;
}

/**
 * 列表项里要渲染的块。
 *
 * @param blocks 某一项的全部块
 */
function visibleBlocks(blocks: MarkdownNode[]): MarkdownNode[] {
    return blocks.filter(hasContent);
}

/**
 * 列表项里要渲染的块（不含末尾的嵌套列表）。
 *
 * 做成「按项取」的纯函数而不是预先算好的 computed：`v-for` 已经拿着项数组了，
 * 按项取就不必在渲染前把整棵子树再梳理一遍。
 *
 * @param blocks 某一项的全部块
 */
function itemBlocks(blocks: MarkdownNode[]): MarkdownNode[] {
    const rest = visibleBlocks(blocks);
    return nestedList(blocks) === null ? rest : rest.slice(0, -1);
}

/**
 * 项内末尾的嵌套列表；没有就返回 `null`。
 *
 * 嵌套列表必须留在 `<li>` 里才谈得上缩进：渲染成 `<li>` 的兄弟节点时，
 * 浏览器会为它另起一个列表标记，层级就散了。
 *
 * @param blocks 某一项的全部块
 */
function nestedList(blocks: MarkdownNode[]): MarkdownNode | null {
    const last = visibleBlocks(blocks).at(-1);
    return last !== undefined && last.kind === "list" ? last : null;
}
</script>

<template>
    <!-- 标题 -->
    <component
        :is="`h${headingDepth}`"
        v-if="blockName === 'heading'"
        class="md-block md-block--heading"
        :data-depth="headingDepth"
        :style="{ marginBottom: `${gap * 10}px` }">
        <template v-for="(line, order) in textLines" :key="order">
            <br v-if="order > 0" />
            {{ line }}
        </template>
    </component>

    <!-- 段落：软换行切出来的多行之间插 `<br>`，行内标记交给同一个渲染器递归 -->
    <p
        v-else-if="blockName === 'paragraph'"
        class="md-block md-block--paragraph"
        :style="{ marginBottom: `${gap * 10}px` }">
        <template v-for="(line, order) in textLines" :key="order">
            <br v-if="order > 0" />
            <span v-if="line.length > 0">{{ line }}</span>
        </template>

        <MarkdownBlock
            v-for="inline in props.node.children ?? []"
            :key="inline.key"
            :node="inline"
            :allow-image="props.allowImage" />
    </p>

    <!-- 列表：有序 / 无序 / 任务三种，靠有序标记与 checks 区分 -->
    <component
        :is="props.node.ordered ? 'ol' : 'ul'"
        v-else-if="blockName === 'list'"
        class="md-block md-block--list"
        :start="props.node.ordered ? listStart : undefined"
        :style="{ marginBottom: `${gap * 10}px` }">
        <li
            v-for="(blocks, order) in items"
            :key="order"
            :class="[
                'md-block__item',
                {
                    'is-task': checks[order] !== null && checks[order] !== undefined,
                    'is-done': checks[order] === true
                }
            ]">
            <span
                v-if="checks[order] !== null && checks[order] !== undefined"
                class="md-block__check">
                <ElIcon>
                    <component :is="checks[order] ? 'CircleCheckFilled' : 'Clock'" />
                </ElIcon>
            </span>

            <div class="md-block__item-body">
                <MarkdownBlock
                    v-for="(block, at) in itemBlocks(blocks)"
                    :key="block.key"
                    :node="block"
                    :heading-base="props.headingBase"
                    :allow-image="props.allowImage"
                    :gap="at === itemBlocks(blocks).length - 1 ? 0 : (block.trailingGaps ?? 0)" />

                <!-- 嵌套列表留在这一项里，`padding-left` 就是它的缩进 -->
                <MarkdownBlock
                    v-if="nestedList(blocks)"
                    :node="nestedList(blocks)!"
                    :heading-base="props.headingBase"
                    :allow-image="props.allowImage" />
            </div>
        </li>
    </component>

    <!-- 引用：子块递归渲染 -->
    <blockquote
        v-else-if="blockName === 'blockquote'"
        class="md-block md-block--quote"
        :style="{ marginBottom: `${gap * 10}px` }">
        <MarkdownBlock
            v-for="(child, order) in children"
            :key="child.key"
            :node="child"
            :heading-base="props.headingBase"
            :allow-image="props.allowImage"
            :gap="order === children.length - 1 ? 0 : (child.trailingGaps ?? 0)" />
    </blockquote>

    <!-- 代码块：内容整体走插值，不会被当成标记。
         `language` 是它与行内代码的唯一分界：块级一定有这个字段（没写语言就是空串），
         行内代码一定没有。靠它区分，两个分支才都真的走得到。 -->
    <div
        v-else-if="blockName === 'code' && props.node.language !== undefined"
        class="md-block md-block--code"
        :style="{ marginBottom: `${gap * 10}px` }">
        <div v-if="props.node.language" class="md-block__code-lang">{{ props.node.language }}</div>
        <pre class="md-block__pre"><code>{{ props.node.text }}</code></pre>
    </div>
    <!-- 表格：外层可横向滚动，列多时不会把卡片撑破 -->
    <div
        v-else-if="blockName === 'table'"
        class="md-block md-block--table"
        :style="{ marginBottom: `${gap * 10}px` }">
        <table class="md-block__table">
            <thead>
                <tr>
                    <th
                        v-for="(cell, order) in headerCells"
                        :key="cell.key"
                        :align="alignOf(order)">
                        <MarkdownBlock
                            v-for="inline in cell.children ?? []"
                            :key="inline.key"
                            :node="inline"
                            :allow-image="props.allowImage" />
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(row, order) in tableRows" :key="order">
                    <td v-for="(cell, column) in row" :key="cell.key" :align="alignOf(column)">
                        <MarkdownBlock
                            v-for="inline in cell.children ?? []"
                            :key="inline.key"
                            :node="inline"
                            :allow-image="props.allowImage" />
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- 分隔线 -->
    <hr
        v-else-if="blockName === 'divider'"
        class="md-block md-block--divider"
        :style="{ marginBottom: `${gap * 10}px` }" />

    <!-- 行内：粗体 / 斜体 / 删除线 / 行内代码 / 链接 / 图片 / 换行。
         注意块级代码那一支在前面——两者 `kind` 都是 `code`，块级必须排在前面，
         否则行内这一支会把代码块也接走（`vue/no-dupe-v-else-if` 会直接报出来）。 -->
    <strong v-else-if="blockName === 'strong'">
        <MarkdownBlock
            v-for="child in children"
            :key="child.key"
            :node="child"
            :allow-image="props.allowImage" />
    </strong>

    <em v-else-if="blockName === 'emphasis'">
        <MarkdownBlock
            v-for="child in children"
            :key="child.key"
            :node="child"
            :allow-image="props.allowImage" />
    </em>

    <del v-else-if="blockName === 'strike'">
        <MarkdownBlock
            v-for="child in children"
            :key="child.key"
            :node="child"
            :allow-image="props.allowImage" />
    </del>

    <!-- 行内代码：没有 `language` 字段，因此代码块不会被这一支接走 -->
    <code v-else-if="blockName === 'code'" class="md-inline-code">{{ props.node.text }}</code>

    <!-- 链接：href 为空表示解析期的白名单拦下了，退化成不可点的文字 -->
    <a
        v-else-if="blockName === 'link'"
        class="md-block__link"
        :href="props.node.href"
        rel="noreferrer noopener">
        <MarkdownBlock
            v-for="child in children"
            :key="child.key"
            :node="child"
            :allow-image="props.allowImage" />
    </a>

    <img
        v-else-if="blockName === 'image' && props.allowImage && props.node.href"
        class="md-block__image"
        :src="props.node.href"
        :alt="props.node.text ?? ''" />

    <br v-else-if="blockName === 'break'" />

    <!--
        纯文本：兜底。

        这一支也接走了表格单元格（`table-cell`）——单元格不会以节点的身份进到本组件：
        表格那一支直接遍历 `cell.children`，单元格只是装行内节点的容器。这里因此不为
        它单开分支（早先开过一个，被 `vue/no-dupe-v-else-if` 判为永远走不到，判得对）。
    -->
    <span v-else :class="['md-text', { 'is-verbatim': props.node.verbatim }]">
        <!-- 同一行里写：`verbatim` 节点可能带子节点（被拦下的链接保留其文字样式），
             分开写会让 Vue 在两者之间留一个空格 -->
        <template v-if="children.length > 0"
            >{{ props.node.text
            }}<MarkdownBlock
                v-for="child in children"
                :key="child.key"
                :node="child"
                :allow-image="props.allowImage"
        /></template>
        <template v-else>{{ props.node.text }}</template>
    </span>
</template>

<style scoped>
.md-block {
    margin-top: 0;
}

/* 块内最后一个不再留底部间距：间距由父级的 gap 统一给，免得多出一截 */
.md-block:last-child {
    margin-bottom: 0;
}

/* ---------------------------------------------------------------- 标题 */

.md-block--heading {
    color: var(--el-text-color-primary);
    font-weight: 600;
    line-height: 1.4;
}

.md-block--heading[data-depth="1"] {
    font-size: 20px;
    margin-top: 6px;
}

.md-block--heading[data-depth="2"] {
    font-size: 17px;
    margin-top: 6px;
}

.md-block--heading[data-depth="3"] {
    font-size: 15px;
    margin-top: 4px;
}

.md-block--heading[data-depth="4"],
.md-block--heading[data-depth="5"],
.md-block--heading[data-depth="6"] {
    color: var(--el-text-color-regular);
    font-size: 14px;
    margin-top: 4px;
}

/* 卡片正文的第一个块不留上边距，免得标题被顶下去一截 */
.md-block--heading:first-child {
    margin-top: 0;
}

/* ---------------------------------------------------------------- 段落与文字 */

.md-block--paragraph {
    color: var(--el-text-color-primary);
    font-size: var(--md-font-size);
    line-height: var(--md-line-height);
    margin-top: 0;
    overflow-wrap: break-word;

    /**
     * 软换行的落点：解析出的 `\n` 在这里变成真正的换行。
     *
     * 为什么不用 `<br>` 分段了事：`<br>` 只断行，**不会**消掉 Vue 为模板里行间空白
     * 保留的那个空格节点——写 `<br>{{ line }}` 时缩进与换行会被合成一个空格，
     * 于是每个换行开头都多出一个空格。`pre-line` 让换行符自己就是换行，又不会像
     * `pre-wrap` 那样把多余空格也留着。
     */
    white-space: pre-line;
}

.md-text.is-verbatim {
    /* 被白名单拦下的链接：告诉用户「这里本来是个链接」，但不做成可点的样子 */
    border-bottom: 1px dashed var(--el-border-color);
}

.md-inline-code {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 3px;
    color: var(--el-color-danger);
    font-family: var(--md-font-mono);
    font-size: 0.92em;
    padding: 0 4px;
}

.md-block__link {
    color: var(--el-color-primary);
    text-decoration: none;
}

.md-block__link:hover {
    text-decoration: underline;
}

.md-block__image {
    border-radius: var(--el-border-radius-base);
    max-width: 100%;
}

/* ---------------------------------------------------------------- 列表 */

.md-block--list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 0;
    padding-left: 22px;
}

.md-block--list:not([start]) {
    list-style: disc;
}

.md-block--list[start] {
    list-style: decimal;
}

.md-block__item {
    color: var(--el-text-color-primary);
    font-size: var(--md-font-size);
    line-height: var(--md-line-height);
}

/* 列表项里的子块（段落、引用、代码块）不再重复首行缩进 */
.md-block__item > .md-block__item-body > .md-block--paragraph {
    margin-top: 0;
}

.md-block__item-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

/* 任务项：勾选框在文字左侧，与 `chat-bubble__todo` 同一套观感 */
.md-block__item.is-task {
    display: flex;
    gap: 8px;
    list-style: none;
    margin-left: -22px;
}

.md-block__item.is-task .md-block__check {
    color: var(--el-color-primary);
    flex-shrink: 0;
    margin-top: 3px;
}

.md-block__item.is-done {
    color: var(--el-text-color-secondary);
}

.md-block__item.is-done .md-block__check {
    color: var(--el-color-success);
}

.md-block__item.is-done .md-block--paragraph {
    color: var(--el-text-color-secondary);
    text-decoration: line-through;
    text-decoration-color: var(--el-border-color);
}

/* 嵌套列表的缩进靠这一条，不再往模板里塞占位元素 */
.md-block__item-body > .md-block--list {
    margin-top: 4px;
    padding-left: 22px;
}

/* ---------------------------------------------------------------- 引用 */

.md-block--quote {
    background: var(--el-fill-color-lighter);
    border-left: 3px solid var(--el-color-primary-light-5);
    border-radius: 0 var(--el-border-radius-base) var(--el-border-radius-base) 0;
    color: var(--el-text-color-regular);
    margin-left: 0;
    margin-right: 0;
    padding: 8px 12px;
}

.md-block--quote > .md-block--paragraph {
    color: var(--el-text-color-regular);
}

/* ---------------------------------------------------------------- 代码块 */

.md-block--code {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);
    overflow: hidden;
    position: relative;
}

.md-block__code-lang {
    background: var(--el-fill-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-placeholder);
    font-family: var(--md-font-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 3px 10px;
    text-transform: uppercase;
}

.md-block__pre {
    margin: 0;
    overflow-x: auto;
    padding: 10px 12px;
}

.md-block__pre code {
    color: var(--el-text-color-primary);
    font-family: var(--md-font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre;
}

/* 滚动条与 .el-main / .el-scrollbar__wrap 保持一个粗细（见 src/assets/main.css） */
.md-block__pre::-webkit-scrollbar,
.md-block--table::-webkit-scrollbar {
    height: 8px;
    width: 8px;
}

.md-block__pre::-webkit-scrollbar-thumb,
.md-block--table::-webkit-scrollbar-thumb {
    background: var(--el-border-color-darker);
    border-radius: 4px;
}

/* ---------------------------------------------------------------- 表格 */

.md-block--table {
    overflow-x: auto;
}

.md-block__table {
    border-collapse: collapse;
    font-size: 13px;
    min-width: 100%;
}

.md-block__table th,
.md-block__table td {
    border: 1px solid var(--el-border-color-lighter);
    line-height: 1.6;
    padding: 5px 10px;
    text-align: left;
    vertical-align: top;
}

.md-block__table th {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-weight: 600;
    white-space: nowrap;
}

/* `align` 属性被浏览器映射成 text-align，但显式写一条更直观（也覆盖 align 失效的场景） */
.md-block__table [align="center"] {
    text-align: center;
}

.md-block__table [align="right"] {
    text-align: right;
}

/* ---------------------------------------------------------------- 分隔线 */

.md-block--divider {
    border: none;
    border-top: 1px solid var(--el-border-color-lighter);
    height: 0;
    margin-top: 4px;
}
</style>
