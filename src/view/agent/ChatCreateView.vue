<script setup lang="ts">
/**
 * 智能体 · 新建对话
 *
 * 空会话入口：与助手自由对话，快速开始任务。
 *
 * ## 这一页承担什么
 *
 * 三栏对话壳由 `chat/ChatPage.vue` 提供（会话列表 / 消息流 + 输入区 / 右栏），
 * 本文件只声明"新建对话"这一模式的**右栏内容**：
 *
 * - **可以这样问**：三条开场白，与空消息流里的那三条同源
 *   （`ChatChannels.create.starters`），点一下直接发出去；
 * - **还没接的部分**：把缺口逐条列出来，并写明落点在哪个文件。
 *
 * 为什么把"还没接什么"写在界面上而不是留在注释里：注释只有读代码的人看得到，
 * 而这件事**用户也该知道**——他会问"为什么刷新就没了"。
 *
 * ## 六个模式都是这个形状
 *
 * 每个模式一个 `.vue`（用户明确要求），各自决定右栏放什么，共用同一套壳与
 * 同一份 store。要看清六个模式的差异，依次读这六个文件即可。
 */

import { ChatChannels } from "../../entity/chat";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";
import ChatPromptPanel from "./chat/ChatPromptPanel.vue";

/**
 * 本模式的对话状态。
 *
 * 右栏的提示卡片要"点一下直接发出去"，所以页面必须自己持有一份 `useChatPage`；
 * 它和 `ChatPage` 内部调的那次读的是同一个 store，不会重复取数。
 */
const chat = useChatPage("create");

/** 缺口清单：每项都写明落点，接的时候不必再翻文档。 */
const Gaps = [
    {
        name: "会话持久化",
        place: "src/store/chat.store.ts",
        note: "会话与消息现在只在内存里；落在哪一层（复用 temporal 主键还是另起表）未定"
    },
    {
        name: "模型调用",
        place: "main/ipc.ts",
        note: "渲染进程不直连模型，要走主进程的 IPC 通道"
    },
    {
        name: "流式输出",
        place: "src/state/use-chat-page.ts",
        note: "现在是一次性返回；换流式只需替掉那里的占位 loader"
    },
    {
        name: "附件与工具调用",
        place: "src/entity/chat.ts",
        note: "消息结构已留 kind 字段，加一个分支即可渲染"
    }
] as const;
</script>

<template>
    <ChatPage
        channel="create"
        hint="自由对话：会话、消息与回复都是本地占位，用来把界面形状先定下来。">
        <ChatPromptPanel
            :chat="chat"
            :items="ChatChannels.create.starters"
            title="可以这样问"
            note="三条都取自本项目的既有内容，答案在 docs/ 里查得到。" />

        <section class="xy-panel">
            <h4 class="xy-panel-title">还没接的部分</h4>

            <ul class="create-gaps">
                <li v-for="gap in Gaps" :key="gap.name" class="create-gaps__item">
                    <span class="create-gaps__name">{{ gap.name }}</span>
                    <code class="create-gaps__place">{{ gap.place }}</code>
                    <span class="xy-dim">{{ gap.note }}</span>
                </li>
            </ul>
        </section>
    </ChatPage>
</template>

<style scoped>
.create-gaps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.create-gaps__item {
    border-left: 2px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-left: 10px;
}

.create-gaps__name {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}

.create-gaps__place {
    background: var(--el-fill-color-light);
    border-radius: 3px;
    color: var(--el-text-color-secondary);
    font-size: 11px;
    padding: 1px 5px;
    width: fit-content;
    word-break: break-all;
}
</style>
