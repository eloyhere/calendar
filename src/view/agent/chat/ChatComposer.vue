<script setup lang="ts">
/**
 * 输入区：草稿框 + 发送行。固定在消息流下方，不跟着滚。
 *
 * ## 回车键的取舍
 *
 * 默认 **Enter 发送、Shift + Enter 换行**（与常见聊天工具一致），但另给一个
 * 开关切到"Enter 换行"——本项目的对话经常要贴历表片段或 SQL，那种场景下
 * 误发一次比多按一次 Shift 烦人。开关状态是每个模式页自己的局部状态
 * （不放进 store）：它是"我怎么打字"的习惯，不是会话数据。
 *
 * `ElInput` 的 `keydown` 里判断 `event.isComposing` 是必须的：中文输入法选词时
 * 按 Enter 会先触发一次 `keydown`，不拦住就会把半个词发出去。
 *
 * ## 为什么草稿走 `update:draft` 而不是直接写 `chat.draft`
 *
 * 草稿的持有者是页面（`useChatPage` 的 `draft`），本组件只是它的一个输入口。
 * 直接写 `props.chat.draft.value` 能跑通，但 `vue/no-mutating-props` 会报错——
 * 而且报得对：子组件改父级状态，出问题时无从判断是谁改的。所以按 Vue 的双向绑定
 * 约定来：`modelValue` 式的 `draft` + `update:draft` 事件，由页面落笔。
 */

import { computed, ref } from "vue";
import { Promotion } from "@element-plus/icons-vue";

import type { ChatSessionApi } from "../../../state/use-chat-session";

interface Props {
    /**
     * 会话状态。
     *
     * 与 `ChatMessageList` 同理取 `ChatSessionApi` 而不是 `ChatPageApi`：
     * 输入区只用草稿、可否发送、在等回复这三样，而那三样对话页与助手抽屉都有。
     */
    chat: ChatSessionApi;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 草稿变化；由页面的 `chat.draft` 落笔 */
    "update:draft": [text: string];
}>();

/** Enter 发送；关掉则 Enter 换行、Ctrl / Cmd + Enter 发送。 */
const enterToSend = ref(true);

/**
 * 草稿的读写桥。
 *
 * 读走 props（页面持有真值），写走事件（页面负责落笔）——这样输入框既不会与页面
 * 的状态脱节，也不会有第二份真值。
 */
const draft = computed({
    get: (): string => props.chat.draft.value,
    set: (text: string): void => emit("update:draft", text)
});

/** 等回复时的提示文案。 */
const hint = computed((): string =>
    props.chat.pending.value
        ? "助手正在回复；此时再发会排到它后面"
        : "会话与消息只存在内存里，刷新即清空"
);

/** 键盘处理：中文输入法组词期间一律放行，不做发送。 */
function onKeydown(event: Event | KeyboardEvent): void {
    // `ElInput` 的 `keydown` 声明成 `Event | KeyboardEvent`，直接收窄
    if (!(event instanceof KeyboardEvent)) {
        return;
    }
    if (event.key !== "Enter" || event.isComposing) {
        return;
    }
    const withModifier = event.ctrlKey || event.metaKey;

    if (withModifier || (enterToSend.value && !event.shiftKey)) {
        event.preventDefault();
        if (props.chat.sendable.value) {
            props.chat.send();
        }
    }
}
</script>

<template>
    <div class="chat-composer">
        <ElInput
            v-model="draft"
            type="textarea"
            :rows="3"
            resize="none"
            :placeholder="props.chat.info.value.placeholder"
            @keydown="onKeydown" />

        <div class="chat-composer__actions">
            <div class="chat-composer__left">
                <ElTooltip
                    content="关掉后 Enter 换行，Ctrl / Cmd + Enter 发送"
                    placement="top"
                    effect="light">
                    <ElSwitch v-model="enterToSend" size="small" :active-text="'Enter 发送'" />
                </ElTooltip>
                <span class="xy-dim">{{ hint }}</span>
            </div>

            <ElButton
                type="primary"
                :disabled="!props.chat.sendable.value"
                @click="props.chat.send()">
                <ElIcon><Promotion /></ElIcon>
                <span>发送</span>
            </ElButton>
        </div>
    </div>
</template>

<style scoped>
.chat-composer {
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 12px 16px;
}

.chat-composer__actions {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-top: 8px;
}

.chat-composer__left {
    align-items: center;
    display: flex;
    gap: 12px;
    min-width: 0;
}

.chat-composer__left :deep(.el-switch__label) {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
</style>
