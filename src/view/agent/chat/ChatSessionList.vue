<script setup lang="ts">
/**
 * 会话列表：左栏。每个模式各有自己的列表（由 `useChatPage(channel)` 决定）。
 *
 * ## 三件事
 *
 * 1. **检索**：按标题与摘要模糊过滤。历史对话页的用途就是"翻旧账"，没有检索
 *    就只能靠滚动；
 * 2. **倒序**：最近说过的排最前（`sessionsOf` 已按 `updatedAt` 倒序）；
 * 3. **删除**：带确认的悬浮按钮。删的是当前会话时由 store 自动落到下一条，
 *    列表不会因此空掉一块。
 *
 * ## 时间是相对的
 *
 * 条目上显示"3 分钟前"而不是"14:05"：判断要不要接着聊，看的是隔了多久。
 * 超过一周才退回日期（见 `relativeTime()`）。
 *
 * 相对时间的"现在"取自一个每分钟自增的 `tick`，而不是在模板里直接调
 * `Date.now()`——后者不会随时间重渲染，"刚刚"会一直挂着不动。
 */

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Plus, Search } from "@element-plus/icons-vue";

import type { ChatSession } from "../../../entity/chat";
import { relativeTime } from "../../../entity/chat";
import type { ChatPageApi } from "../../../state/use-chat-page";

interface Props {
    /** `useChatPage()` 的返回值 */
    chat: ChatPageApi;
}

const props = defineProps<Props>();

/** 检索关键词。 */
const keyword = ref("");

/** 每分钟自增一次，相对时间才会跟着走。 */
const tick = ref(Date.now());

let ticker: ReturnType<typeof setInterval> | null = null;

onMounted((): void => {
    ticker = setInterval((): void => {
        tick.value = Date.now();
    }, 60_000);
});

onBeforeUnmount((): void => {
    if (ticker !== null) {
        clearInterval(ticker);
        ticker = null;
    }
});

/** 过滤后的会话。 */
const list = computed((): ChatSession[] => {
    const needle = keyword.value.trim().toLowerCase();
    if (needle.length === 0) {
        return props.chat.sessions.value;
    }

    return props.chat.sessions.value.filter(
        (session: ChatSession): boolean =>
            session.title.toLowerCase().includes(needle) ||
            session.summary.toLowerCase().includes(needle)
    );
});

/** 空列表的原因不同，文案也不同：一条会话都没有 vs 检索没命中。 */
const emptyText = computed((): string =>
    keyword.value.trim().length > 0 ? "没有匹配的会话" : "还没有会话"
);

/** 会话状态的色调。 */
function toneOf(session: ChatSession): "primary" | "success" | "info" {
    if (session.status === "replying") {
        return "primary";
    }

    return session.messageCount > 0 ? "success" : "info";
}

/** 会话状态的短标签。 */
function statusOf(session: ChatSession): string {
    if (session.status === "replying") {
        return "回复中";
    }

    return session.messageCount > 0 ? `${session.messageCount} 条` : "空的";
}

/** 相对时间。 */
function timeOf(session: ChatSession): string {
    return relativeTime(session.updatedAt, tick.value);
}
</script>

<template>
    <aside class="chat-sessions">
        <div class="chat-sessions__head">
            <ElText tag="strong" size="small">会话</ElText>
            <ElButton text size="small" @click="props.chat.startSession()">
                <ElIcon><Plus /></ElIcon>
                <span>新建</span>
            </ElButton>
        </div>

        <div class="chat-sessions__search">
            <ElInput v-model="keyword" size="small" placeholder="搜索标题或摘要" clearable>
                <template #prefix>
                    <ElIcon><Search /></ElIcon>
                </template>
            </ElInput>
        </div>

        <ElScrollbar class="chat-sessions__list">
            <ElEmpty v-if="list.length === 0" :description="emptyText" :image-size="50" />

            <ul v-else class="chat-sessions__items">
                <li
                    v-for="session in list"
                    :key="session.id"
                    :class="[
                        'chat-sessions__item',
                        { 'is-active': session.id === props.chat.active.value?.id }
                    ]"
                    @click="props.chat.openSession(session.id)">
                    <div class="chat-sessions__item-head">
                        <span class="chat-sessions__title is-truncated">{{ session.title }}</span>
                        <ElTag :type="toneOf(session)" size="small" effect="plain" class="numeral">
                            {{ statusOf(session) }}
                        </ElTag>
                    </div>

                    <span class="chat-sessions__summary">{{ session.summary }}</span>

                    <div class="chat-sessions__item-foot">
                        <span class="xy-dim numeral">{{ timeOf(session) }}</span>

                        <ElPopconfirm
                            title="删除这条会话？"
                            confirm-button-text="删除"
                            cancel-button-text="取消"
                            width="200"
                            @confirm="props.chat.dropSession(session.id)">
                            <template #reference>
                                <ElButton
                                    text
                                    size="small"
                                    class="chat-sessions__drop"
                                    @click.stop>
                                    <ElIcon><Delete /></ElIcon>
                                </ElButton>
                            </template>
                        </ElPopconfirm>
                    </div>
                </li>
            </ul>
        </ElScrollbar>
    </aside>
</template>

<style scoped>
.chat-sessions {
    background: var(--el-fill-color-blank);
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
    width: 244px;
}

.chat-sessions__head {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    justify-content: space-between;
    padding: 8px 10px 8px 12px;
}

.chat-sessions__search {
    border-bottom: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 8px 10px;
}

.chat-sessions__list {
    flex: 1;
    min-height: 0;
}

.chat-sessions__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 8px;
}

.chat-sessions__item {
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
}

.chat-sessions__item:hover {
    background: var(--el-fill-color-light);
}

.chat-sessions__item.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-8);
}

.chat-sessions__item-head {
    align-items: center;
    display: flex;
    gap: 6px;
    justify-content: space-between;
}

.chat-sessions__title {
    color: var(--el-text-color-primary);
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    min-width: 0;
}

.chat-sessions__summary {
    color: var(--el-text-color-secondary);
    display: -webkit-box;
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.chat-sessions__item-foot {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
}

/* 删除按钮平时不露面：一列会话里挂满垃圾桶图标太吵 */
.chat-sessions__drop {
    color: var(--el-text-color-placeholder);
    height: 20px;
    opacity: 0;
    padding: 0 4px;
    transition: opacity 0.15s;
}

.chat-sessions__item:hover .chat-sessions__drop,
.chat-sessions__item.is-active .chat-sessions__drop {
    opacity: 1;
}
</style>
