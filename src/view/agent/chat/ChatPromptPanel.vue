<script setup lang="ts">
/**
 * 提示面板：把"可以问什么"摊开成可点的卡片。
 *
 * 六个模式页都把它放在右栏顶部，`items` 通常取自 `ChatChannels[channel].starters`
 * ——于是"开场白"只有一个来源（`src/entity/chat.ts`），既能列在空消息流里，
 * 也能列成这里的卡片，不会两处写法不一致。
 *
 * 为什么值得做成卡片而不是普通按钮：这些提示是**被读的**，不是被点的。
 * 用户扫一眼就知道这个模式能干什么，点只是顺手；排成一列朴素的按钮，
 * 人会当成工具栏而略过。
 */

import type { ChatPageApi } from "../../../state/use-chat-page";

interface Props {
    /** `useChatPage()` 的返回值 */
    chat: ChatPageApi;
    /** 提示条目 */
    items: readonly string[];
    /** 面板标题 */
    title?: string;
    /** 面板下方的一句话说明 */
    note?: string;
}

const props = withDefaults(defineProps<Props>(), { title: "可以这样问", note: "" });
</script>

<template>
    <section class="chat-prompts">
        <h4 class="xy-panel-title">{{ props.title }}</h4>

        <ul class="chat-prompts__list">
            <li v-for="(item, order) in props.items" :key="item">
                <button
                    type="button"
                    class="chat-prompts__card"
                    @click="props.chat.sendStarter(item)">
                    <span class="chat-prompts__order numeral">{{ order + 1 }}</span>
                    <span class="chat-prompts__text">{{ item }}</span>
                </button>
            </li>
        </ul>

        <p v-if="props.note" class="xy-note">{{ props.note }}</p>
    </section>
</template>

<style scoped>
.chat-prompts {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 14px 16px;
}

.chat-prompts__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.chat-prompts__card {
    align-items: flex-start;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding: 8px 10px;
    text-align: left;
    transition:
        border-color 0.15s,
        background 0.15s;
    width: 100%;
}

.chat-prompts__card:hover {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
}

.chat-prompts__order {
    background: var(--el-fill-color);
    border-radius: 3px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 11px;
    line-height: 18px;
    text-align: center;
    width: 18px;
}

.chat-prompts__text {
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.6;
}
</style>
