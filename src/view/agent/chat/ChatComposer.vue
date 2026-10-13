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
 * ## 为什么按钮文案随状态变
 *
 * 等回复时按钮变"停止"，点了清掉未落地的占位回复。这一版没有真正的流式生成可停，
 * 但按钮的位置与语义先立住——加流式时只改 `use-chat-page.ts` 里的定时器。
 */

import { computed, ref } from "vue";
import { Promotion } from "@element-plus/icons-vue";

import type { ChatPageApi } from "../../../state/use-chat-page";

interface Props {
    /** `useChatPage()` 的返回值 */
    chat: ChatPageApi;
}

const props = defineProps<Props>();

/** Enter 发送；关掉则 Enter 换行、Ctrl / Cmd + Enter 发送。 */
const enterToSend = ref(true);

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
            v-model="props.chat.draft.value"
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
