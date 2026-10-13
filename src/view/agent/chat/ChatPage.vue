<script setup lang="ts">
/**
 * 对话页外壳：六个模式共用的三栏对话界面。
 *
 * ```
 * PageShell（标题 / 说明 / 四种状态）
 * └─ .chat-page                                 撑满内容区，纵向 Flex
 *    ├─ ElAlert                                模式提示（每个模式一句话）
 *    └─ .chat-page__body                       横向 Flex，不整页滚
 *       ├─ ChatSessionList    244px            会话列表（自己滚）
 *       ├─ .chat-page__main   flex:1           消息流（自己滚）+ 输入区（固定）
 *       └─ ChatContextPanel   300px            会话元信息 + 模式自己的内容
 * ```
 *
 * ## 为什么这一页要吃掉整屏高度
 *
 * 其余页面是"内容多长、页面多长"（`ElMain` 自己滚）。对话页不能这样：输入框必须
 * 永远在底部可见，消息流自己滚是聊天的基本要求。所以这里要做两件事：
 *
 * 1. `:deep(.el-main)` 去掉 20px 内边距、并把自己变成纵向 Flex 容器——只有这样
 *    子元素才能 `flex: 1` 拿到"剩下多少高度"。这是本页唯一一处穿透到外壳的样式，
 *    改的就是 `AppShell` 里那一个 `ElMain`，其余页面不受影响；
 * 2. 三栏各自 `overflow: hidden` / `auto`，**页面本身不出现滚动条**。
 *
 * 为什么不用 `height: calc(100vh - 176px)` 这种算式：那个数字要把页头、页脚、
 * 面包屑、内外边距全部算进去，改任何一处页头高度都会让输入框被挤到屏幕外，
 * 而算式不会报错。用 Flex 撑满则自适应。
 *
 * ## 六个模式页各自的样子
 *
 * 本组件只认 `channel` 一个参数，标题、图标、占位文案、开场白全部由
 * `ChatChannels[channel]` 决定（见 `src/entity/chat.ts`）。模式之间的差异通过
 * **默认插槽**注入右栏——数据调研放分库行数、历史对话放检索统计、新建对话放
 * 提示卡片，都不需要动这个文件。需要整页不同形状的（比如会话列表改成表格），
 * 那个模式页可以不引用本组件，自己写。
 */

import { computed } from "vue";

import PageShell from "../../../component/PageShell.vue";
import type { ChatChannel } from "../../../entity/chat";
import { useChatPage } from "../../../state/use-chat-page";
import ChatComposer from "./ChatComposer.vue";
import ChatContextPanel from "./ChatContextPanel.vue";
import ChatMessageList from "./ChatMessageList.vue";
import ChatSessionList from "./ChatSessionList.vue";

interface Props {
    /** 模式标识，取值见 `src/entity/chat.ts` 的 `ChatChannel` */
    channel: ChatChannel;
    /** 提示条文案；不传则由说明与状态拼一句 */
    hint?: string;
}

const props = withDefaults(defineProps<Props>(), { hint: "" });

/** 本模式的对话状态：会话、消息、草稿、动作。 */
const chat = useChatPage(props.channel);

/** 提示条：优先用页面给的，否则按模式说明与填充状态拼一句。 */
const alertText = computed((): string => {
    if (props.hint.length > 0) {
        return props.hint;
    }

    return `${chat.info.value.description}。当前 ${chat.sessions.value.length} 条会话、共 ${chat.info.value.starters.length} 条开场提示。`;
});
</script>

<template>
    <div class="chat-page-shell">
        <PageShell :state="'ready'" :card="false">
            <div class="chat-page">
                <ElAlert
                    :title="alertText"
                    type="info"
                    :closable="false"
                    show-icon
                    class="chat-page__hint" />

                <div class="chat-page__body">
                    <ChatSessionList :chat="chat" />

                    <div class="chat-page__main">
                        <ChatMessageList :chat="chat" />
                        <ChatComposer :chat="chat" />
                    </div>

                    <ChatContextPanel :chat="chat">
                        <slot />
                    </ChatContextPanel>
                </div>
            </div>
        </PageShell>
    </div>
</template>

<style scoped>
/**
 * 这一页要吃掉整屏高度，所以要把外壳 `ElMain` 的 20px 内边距去掉，
 * 并把自己变成纵向 Flex 容器，子元素才拿得到"剩余高度"。
 * 只影响本页：`AppShell` 里那个 `ElMain` 不会因此变形。
 */
.chat-page-shell {
    height: 100%;
}

.chat-page-shell :deep(.el-main) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
}

.chat-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 16px 20px;
}

.chat-page__hint {
    border-radius: 6px;
    flex-shrink: 0;
}

.chat-page__body {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.chat-page__main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

/* 窗口变窄时先收右栏，再收左栏：消息流是最后才让步的那一栏 */
@media (width <= 1280px) {
    .chat-page__body :deep(.chat-context) {
        display: none;
    }
}

@media (width <= 1000px) {
    .chat-page__body :deep(.chat-sessions) {
        display: none;
    }
}
</style>
