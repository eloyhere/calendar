<script setup lang="ts">
/**
 * 对话页外壳：五个模式共用的三栏对话界面。
 *
 * ```
 * PageShell（四种状态，scroll=false）
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
 * 对话页不能"内容多长、页面多长"：输入框必须永远在底部可见，消息流自己滚是聊天的
 * 基本要求。所以这里给 `PageShell` 传 `scroll=false`——插槽内容不进 `ElScrollbar`，
 * 而是直接撑满卡片，滚动由三栏各自安排。
 *
 * 高度能一路传下来，是因为外壳 `ElMain` 本来就是纵向 Flex 宿主（见 `AppShell.vue`）：
 *
 * ```
 * .el-main > .chat-page-shell > .page-shell > 卡片 > .page-shell__inner.is-fill
 *          > .chat-page > .chat-page__body > 三栏
 * ```
 *
 * 每一层都是 `flex: 1` + `min-height: 0`，**没有一处用 `height: calc(100vh - …)`**：
 * 那种算式要把页头、页脚、内外边距全部算进去，改任何一处高度都会让输入框被挤到
 * 屏幕外，而算式不会报错。用 Flex 撑满则自适应。
 *
 * 撑满一律用 `flex: 1` 而不是 `height: 100%`——**这一条踩过**：弹性分配来的高度是
 * `auto`，百分比高度在里面解析不出确定值，浏览器按 `auto` 处理，页面于是又跟着
 * 内容长高（实测 3897px，输入框被顶到屏幕外）。
 *
 * 内边距由 `.page-shell` 统一给（16px 20px），所以 `.chat-page` 自己不再加，
 * 否则会叠成两圈。
 *
 * ## 五个模式页各自的样子
 *
 * 本组件只认 `channel` 一个参数，标题、图标、占位文案、开场白全部由
 * `ChatChannels[channel]` 决定（见 `src/entity/chat.ts`）。模式之间的差异通过
 * **默认插槽**注入右栏——数据调研放分库行数、深度研究放证据与未决问题、
 * 新建对话放提示卡片，都不需要动这个文件。需要整页不同形状的（比如会话列表
 * 改成表格），那个模式页可以不引用本组件，自己写。
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
        <PageShell :state="'ready'" :card="false" :scroll="false">
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
                        <ChatComposer
                            :chat="chat"
                            @update:draft="(text: string) => (chat.draft.value = text)" />
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
 * 这一页只负责"把高度一路传下去"：`.chat-page-shell` 撑满 `ElMain`，`.page-shell`
 * 再撑满它，三栏才拿得到剩余高度。内边距由 `.page-shell` 给，这里不再重复加。
 *
 * 撑满用的是 `flex: 1` 而不是 `height: 100%`——**这一条踩过**：弹性分配来的高度
 * 是 `auto`，百分比高度在里面解析不出确定值，浏览器按 `auto` 处理，页面又跟着
 * 内容长高（实测 3897px，输入框被顶到屏幕外）。
 */
.chat-page-shell {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.chat-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
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
