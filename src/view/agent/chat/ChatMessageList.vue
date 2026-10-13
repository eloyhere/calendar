<script setup lang="ts">
/**
 * 消息流：一列气泡 + 空态 + "正在输入"，自己滚。
 *
 * ## 为什么滚动条归这一块
 *
 * 聊天页最忌讳输入框跟着消息滚走。所以布局是「消息流 `flex: 1` 自己滚、输入区
 * 固定在底部」——`ElScrollbar` 承担滚动，`scrollTo` 由本组件在消息变化后调用。
 * 页面外层（`ElMain`）不滚。
 *
 * ## 空态分两种，不能合并
 *
 * - **空会话**（会话存在但没有发言）：显示助手问候 + `starters` 选题。这是最常见
 *   的入口，用户需要"第一句说什么"的提示，一个 `ElEmpty` 会把人晾在那里；
 * - **没有会话**：显示 `EmptyState` 说明为什么空。把某个模式的会话全删掉之后
 *   会走到这里。
 *
 * ## 自动滚到底的时机
 *
 * 看的是 `messages.length` 这个**数字**而不是数组本身：数组每次都是新引用，
 * 拿它当依赖会在每次父组件重渲染时都滚一次（比如左栏计数变化时），
 * 用户往上翻到一半会被拽回底部。
 */

import { computed, nextTick, ref, watch } from "vue";
import type { ScrollbarInstance } from "element-plus";

import EmptyState from "../../../component/state/EmptyState.vue";
import { resolveIconComponent } from "../../../plugin/dependencies";
import type { ChatSessionApi } from "../../../state/use-chat-session";
import ChatMessageBubble from "./ChatMessageBubble.vue";
import ChatTyping from "./ChatTyping.vue";

interface Props {
    /**
     * 会话状态。
     *
     * 类型取 `ChatSessionApi` 而不是 `ChatPageApi`：本组件只用消息流与"在等回复"
     * 这几样，而那几样**对话页与助手抽屉都有**（`state/use-chat-session.ts` 的分层）。
     * 收窄到 `ChatSessionApi` 之后，抽屉可以直接把它传进来，不必造一个假的
     * `ChatPageApi`——那种假对象正是"两个入口各写一套渲染"的开端。
     */
    chat: ChatSessionApi;
}

const props = defineProps<Props>();

/** `ElScrollbar` 实例；`setScrollTop` 由它提供。 */
const scroller = ref<ScrollbarInstance | null>(null);

/** 消息条数；自动滚动的依赖。 */
const count = computed((): number => props.chat.messages.value.length);

/** 是否停在空会话上（有会话、没发言）。 */
const blank = computed(
    (): boolean => props.chat.active.value !== null && props.chat.messages.value.length === 0
);

/** 滚到底部：等一帧，等新气泡进 DOM 之后才知道真实高度。 */
function scrollToEnd(): void {
    void nextTick((): void => {
        const inner = scroller.value?.wrapRef;
        if (inner) {
            scroller.value?.setScrollTop(inner.scrollHeight);
        }
    });
}

watch(count, scrollToEnd, { immediate: false });

/** 轮到我这一条时也滚——用户发言后自己的气泡要立刻可见。 */
watch(
    () => props.chat.pending.value,
    (waiting: boolean): void => {
        if (waiting) {
            scrollToEnd();
        }
    }
);
</script>

<template>
    <ElScrollbar ref="scroller" class="chat-stream">
        <div class="chat-stream__inner">
            <!-- 空会话：问候 + 开场选题 -->
            <div v-if="blank" class="chat-stream__welcome">
                <ElIcon :size="30" class="chat-stream__welcome-icon">
                    <component :is="resolveIconComponent(props.chat.info.value.icon)" />
                </ElIcon>
                <h3 class="chat-stream__welcome-title">{{ props.chat.info.value.title }}</h3>
                <p class="xy-note chat-stream__welcome-note">
                    {{ props.chat.info.value.description }}
                </p>

                <ul class="chat-stream__starters">
                    <li v-for="starter in props.chat.info.value.starters" :key="starter">
                        <ElButton
                            class="chat-stream__starter"
                            plain
                            @click="props.chat.submit(starter)">
                            {{ starter }}
                        </ElButton>
                    </li>
                </ul>

                <p class="xy-note chat-stream__welcome-foot">
                    消息流、工具调用与引用来源都还没接后端；接入点见
                    <code>src/state/use-chat-page.ts</code>
                    的说明。上面三条可直接点，会走一遍完整的发送与回复。
                </p>
            </div>

            <!-- 没有会话：交给统一空态块 -->
            <EmptyState
                v-else-if="count === 0"
                title="还没有会话"
                description="这个模式下还没有任何会话。点左上角的「新建」开一条，或直接在下面的输入框里说第一句话——会话会自动建好。"
                action-text="新建会话"
                source="对话"
                @action="props.chat.startSession()" />

            <!-- 消息 -->
            <template v-else>
                <ChatMessageBubble
                    v-for="entry in props.chat.messages.value"
                    :key="entry.id"
                    :message="entry" />
                <ChatTyping v-if="props.chat.pending.value" />
            </template>
        </div>
    </ElScrollbar>
</template>

<style scoped>
.chat-stream {
    flex: 1;
    min-height: 0;
}

.chat-stream__inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 18px 20px 8px;
}

.chat-stream__welcome {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 24px auto 0;
    max-width: 560px;
    text-align: center;
}

.chat-stream__welcome-icon {
    color: var(--el-color-primary);
}

.chat-stream__welcome-title {
    color: var(--el-text-color-primary);
    font-size: 16px;
    margin: 0;
}

.chat-stream__welcome-note {
    margin: 0;
}

.chat-stream__starters {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    width: 100%;
}

.chat-stream__starter {
    height: auto;
    justify-content: flex-start;
    padding: 8px 12px;
    text-align: left;
    white-space: normal;
    width: 100%;
}

.chat-stream__welcome-foot {
    margin-top: 14px;
}

.chat-stream__welcome-foot code {
    background: var(--el-fill-color-light);
    border-radius: 3px;
    padding: 0 4px;
}
</style>
