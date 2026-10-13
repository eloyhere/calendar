<script setup lang="ts">
/**
 * 消息气泡：一条消息的全部渲染分支。
 *
 * 四种形态（`ChatMessageKind`）在这里收口，消息流那边只管 `v-for`：
 *
 * | 形态 | 长相 | 出现的模式 |
 * | ---- | ---- | ---------- |
 * | `text` | 头像 + 气泡正文 | 五个模式 |
 * | `note` | 灰底小字，没有头像 | 新建对话（一句口径说明） |
 * | `citation` | 正文 + 可点的资料条目 | 深度研究 / 课题研究 |
 * | `todo` | 勾选列表，没有正文气泡 | 数据调研 / 课题研究 |
 *
 * ## 切分与对齐
 *
 * 自己发的消息靠右、助手靠左——这是聊天界面唯一不能含糊的一条：两边长得一样时，
 * 用户要逐条读才能分清谁说的。
 *
 * 气泡宽度上限 76%：再宽则长段落一行排到 100 多字，回行时容易串行；再窄则
 * 表格化的内容（引用出处、提纲）会被挤散。
 *
 * ## 正文为什么按空行切成段落
 *
 * 消息正文是纯文本（Markdown 只用来写"加粗"这类约定），所以这里按空行切段、
 * 段内保留换行（`white-space: pre-wrap`）。不引 Markdown 渲染器是**有意的**：
 * 多一个渲染器就多一处 XSS 面，而助手的正文最终来自模型输出。
 * 等真要渲染表格与代码块时，应当引一个白名单式的渲染器，而不是在这里手写正则。
 */

import { computed } from "vue";
import type { Component } from "vue";

import type { ChatMessage } from "../../../entity/chat";
import { clockOf } from "../../../entity/chat";
import { ConfidenceLabels, StanceLabels } from "../../../entity/research";
import { resolveIconComponent } from "../../../plugin/dependencies";

interface Props {
    /** 要渲染的消息 */
    message: ChatMessage;
}

const props = defineProps<Props>();

/** 是不是自己发的。 */
const mine = computed((): boolean => props.message.role === "user");

/** 说话人名字。 */
const speaker = computed((): string => (mine.value ? "我" : "助手"));

/** 头像图标：用户用 `User`，助手用 `MagicStick`。 */
const avatar = computed((): Component | null =>
    resolveIconComponent(mine.value ? "User" : "MagicStick")
);

/** 时刻，气泡下方那行小字。 */
const clock = computed((): string => clockOf(props.message.time));

/** 正文段落：按空行切开，去掉首尾空白行。 */
const paragraphs = computed((): string[] =>
    props.message.text
        .split(/\n{2,}/)
        .map((part: string): string => part.trim())
        .filter((part: string): boolean => part.length > 0)
);

/** 根节点的类：`role` 与 `kind` 都参与，样式里因此不必层层嵌套选择器。 */
const rootClass = computed((): string[] => [
    "chat-bubble",
    `is-${props.message.role}`,
    `is-${props.message.kind ?? "text"}`
]);
</script>

<template>
    <article :class="rootClass">
        <div class="chat-bubble__avatar">
            <ElIcon :size="16">
                <component :is="avatar" />
            </ElIcon>
        </div>

        <div class="chat-bubble__body">
            <div class="chat-bubble__head">
                <span class="chat-bubble__speaker">{{ speaker }}</span>
                <span class="chat-bubble__clock numeral">{{ clock }}</span>
            </div>

            <!-- 提纲：勾选列表，没有正文气泡 -->
            <ul v-if="props.message.kind === 'todo'" class="chat-bubble__todos">
                <li
                    v-for="(todo, order) in props.message.todos ?? []"
                    :key="order"
                    :class="['chat-bubble__todo', { 'is-done': todo.done }]">
                    <ElIcon class="chat-bubble__todo-mark">
                        <component
                            :is="resolveIconComponent(todo.done ? 'CircleCheckFilled' : 'Clock')" />
                    </ElIcon>
                    <span>{{ todo.text }}</span>
                </li>
            </ul>

            <!-- 正文：段落 + 引用条目 -->
            <div v-else class="chat-bubble__content">
                <p v-for="(part, order) in paragraphs" :key="order" class="chat-bubble__text">
                    {{ part }}
                </p>

                <ul
                    v-if="(props.message.citations ?? []).length > 0"
                    class="chat-bubble__citations">
                    <li
                        v-for="citation in props.message.citations ?? []"
                        :key="citation.source"
                        class="chat-bubble__citation">
                        <div class="chat-bubble__citation-head">
                            <span class="chat-bubble__citation-title">{{ citation.title }}</span>

                            <!-- 立场与置信度：证据卡片上最先要读到的两个字段 -->
                            <ElTag
                                v-if="citation.stance"
                                :type="StanceLabels[citation.stance].type"
                                size="small"
                                effect="plain">
                                {{ StanceLabels[citation.stance].text }}
                            </ElTag>
                            <ElTag
                                v-if="citation.confidence"
                                type="warning"
                                size="small"
                                effect="plain">
                                置信 {{ ConfidenceLabels[citation.confidence].text }}
                            </ElTag>

                            <span class="xy-chip">{{ citation.source }}</span>
                        </div>
                        <span v-if="citation.note" class="xy-note chat-bubble__citation-note">
                            {{ citation.note }}
                        </span>
                        <span
                            v-if="(citation.elapsedSeconds ?? 0) > 0"
                            class="xy-dim chat-bubble__citation-cost numeral">
                            取证耗时 {{ citation.elapsedSeconds }} 秒
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    </article>
</template>

<style scoped>
.chat-bubble {
    display: flex;
    gap: 10px;
    max-width: 76%;
}

/* 自己发的靠右：头像转到右边，整块 `flex-direction: row-reverse` 一次搞定 */
.chat-bubble.is-user {
    align-self: flex-end;
    flex-direction: row-reverse;
}

.chat-bubble__avatar {
    align-items: center;
    background: var(--el-fill-color);
    border-radius: 50%;
    color: var(--el-text-color-secondary);
    display: flex;
    flex-shrink: 0;
    height: 30px;
    justify-content: center;
    margin-top: 18px;
    width: 30px;
}

.chat-bubble.is-user .chat-bubble__avatar {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
}

.chat-bubble.is-assistant .chat-bubble__avatar {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
}

.chat-bubble__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.chat-bubble.is-user .chat-bubble__body {
    align-items: flex-end;
}

.chat-bubble__head {
    align-items: baseline;
    display: flex;
    gap: 8px;
}

.chat-bubble.is-user .chat-bubble__head {
    flex-direction: row-reverse;
}

.chat-bubble__speaker {
    color: var(--el-text-color-regular);
    font-size: 12px;
    font-weight: 600;
}

.chat-bubble__clock {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
}

.chat-bubble__content,
.chat-bubble__todos {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 10px 14px;
}

.chat-bubble.is-user .chat-bubble__content {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-8);
}

/* 说明：灰底、无边框，视觉上比正文轻一档 */
.chat-bubble.is-note .chat-bubble__content {
    background: var(--el-fill-color-light);
    border-style: dashed;
}

.chat-bubble.is-note .chat-bubble__content,
.chat-bubble.is-note .chat-bubble__text {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}

.chat-bubble__text {
    color: var(--el-text-color-primary);
    font-size: 14px;
    line-height: 1.75;
    margin: 0;
    overflow-wrap: break-word;
    white-space: pre-wrap;
}

.chat-bubble__citations {
    border-top: 1px dashed var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 10px 0 0;
}

.chat-bubble__citation-head {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chat-bubble__citation-title {
    color: var(--el-color-primary);
    font-size: 13px;
    font-weight: 600;
}

.chat-bubble__citation-note {
    display: block;
    margin-top: 2px;
}

/* 取证耗时：证据卡片最弱的一行，不与出处、说明抢注意力 */
.chat-bubble__citation-cost {
    display: block;
    margin-top: 2px;
}

.chat-bubble__todo {
    align-items: flex-start;
    color: var(--el-text-color-primary);
    display: flex;
    font-size: 14px;
    gap: 8px;
    line-height: 1.7;
}

.chat-bubble__todo.is-done {
    color: var(--el-text-color-secondary);
    text-decoration: line-through;
    text-decoration-color: var(--el-border-color);
}

.chat-bubble__todo-mark {
    color: var(--el-color-primary);
    flex-shrink: 0;
    margin-top: 4px;
}

.chat-bubble__todo.is-done .chat-bubble__todo-mark {
    color: var(--el-color-success);
}
</style>
