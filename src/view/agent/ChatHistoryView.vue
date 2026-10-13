<script setup lang="ts">
/**
 * 智能体 · 历史对话
 *
 * 检索、继续或清理此前的会话。
 *
 * ## 这一页的重点在左栏
 *
 * 新建对话页的重点是"怎么开口"，深度研究页的重点是"给我资料"，而这一页的重点
 * 是**找到那一条旧会话**。所以右栏不放提示卡片，改放"检索统计 + 最近明细"：
 *
 * - 统计四格：会话数、消息总数、近七天的条数、空会话数（没说过话就被丢下的
 *   那些，通常可以直接删）；
 * - 最近五条明细：时间、标题、摘要，用来判断"哪条该清"。
 *
 * 左栏的检索框由 `chat/ChatSessionList.vue` 自带（六个模式都有），这里不重复实现。
 */

import { computed } from "vue";

import type { ChatSession } from "../../entity/chat";
import { relativeTime } from "../../entity/chat";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";

/** 本模式的对话状态；右栏统计要读它。 */
const chat = useChatPage("history");

/** 近七天：判定"最近聊过"的界线。 */
const Week = 7 * 24 * 60 * 60 * 1000;

/** 四格统计。 */
const Summary = computed(() => {
    const sessions = chat.sessions.value;
    const now = Date.now();

    return [
        { label: "会话", value: sessions.length, unit: "条" },
        {
            label: "消息",
            value: sessions.reduce((sum, item) => sum + item.messageCount, 0),
            unit: "条"
        },
        {
            label: "近七天",
            value: sessions.filter((item) => now - item.updatedAt < Week).length,
            unit: "条"
        },
        {
            label: "空会话",
            value: sessions.filter((item) => item.messageCount === 0).length,
            unit: "条"
        }
    ];
});

/** 最近五条明细；`sessionsOf` 已按最后活动时间倒序。 */
const recent = computed((): ChatSession[] => chat.sessions.value.slice(0, 5));

/** 明细里的时间：与左栏用同一套相对时间口径。 */
function timeOf(session: ChatSession): string {
    return relativeTime(session.updatedAt);
}
</script>

<template>
    <ChatPage
        channel="history"
        hint="左侧可检索与删除；这一页的会话是演示数据，删除只影响内存。">
        <section class="xy-panel">
            <h4 class="xy-panel-title">检索统计</h4>

            <div class="history-stats">
                <div v-for="item in Summary" :key="item.label" class="history-stats__cell">
                    <span class="xy-dim">{{ item.label }}</span>
                    <span class="history-stats__value numeral">
                        {{ item.value }}
                        <small>{{ item.unit }}</small>
                    </span>
                </div>
            </div>

            <p class="xy-note">
                「空会话」是开过但一句话没说的那些——没有内容可检索，清掉不影响任何结论。
            </p>
        </section>

        <section class="xy-panel">
            <h4 class="xy-panel-title">最近</h4>

            <ul v-if="recent.length > 0" class="history-recent">
                <li
                    v-for="session in recent"
                    :key="session.id"
                    class="history-recent__item"
                    @click="chat.openSession(session.id)">
                    <div class="history-recent__head">
                        <span class="history-recent__title is-truncated">{{ session.title }}</span>
                        <span class="xy-dim numeral">{{ timeOf(session) }}</span>
                    </div>
                    <span class="history-recent__summary">{{ session.summary }}</span>
                </li>
            </ul>

            <ElEmpty v-else description="还没有会话" :image-size="50" />
        </section>
    </ChatPage>
</template>

<style scoped>
.history-stats {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(2, 1fr);
}

.history-stats__cell {
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
}

.history-stats__value {
    color: var(--el-color-primary);
    font-size: 18px;
    font-weight: 600;
}

.history-stats__value small {
    color: var(--el-text-color-secondary);
    font-size: 11px;
    font-weight: 400;
    margin-left: 2px;
}

.history-recent {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.history-recent__item {
    border-left: 2px solid var(--el-border-color-lighter);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px 0 2px 10px;
}

.history-recent__item:hover {
    border-left-color: var(--el-color-primary);
}

.history-recent__head {
    align-items: baseline;
    display: flex;
    gap: 8px;
    justify-content: space-between;
}

.history-recent__title {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
    min-width: 0;
}

.history-recent__summary {
    color: var(--el-text-color-secondary);
    display: -webkit-box;
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
</style>
