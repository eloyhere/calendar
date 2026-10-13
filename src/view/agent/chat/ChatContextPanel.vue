<script setup lang="ts">
/**
 * 右栏：会话信息 + 各模式自己的内容。
 *
 * ## 为什么把"当前会话的元信息"放这里
 *
 * 会话标题、条数、创建时间这些信息在中间的消息流里没有位置（气泡上只有时刻），
 * 但对话时问得最多的一句恰恰是"这条会话聊了多久、多少条"。放右栏是固定的，
 * 不需要用户去翻。
 *
 * ## 插槽的用意
 *
 * 六个模式右栏的差异很大：新建对话放提示卡片，历史对话放检索统计，数据调研
 * 放分库行数。公共部分（会话元信息）在这里，差异部分由各模式页通过默认插槽
 * 塞进来——于是六个页面里的右栏不会各写一遍 `ElDescriptions`。
 */

import { computed } from "vue";

import type { ChatPageApi } from "../../../state/use-chat-page";

interface Props {
    /** `useChatPage()` 的返回值 */
    chat: ChatPageApi;
}

const props = defineProps<Props>();

/** 有当前会话时才渲染元信息。 */
const session = computed(() => props.chat.active.value);

/** 创建时刻：`2026-02-14 14:05`。 */
const created = computed((): string => {
    const target = session.value;
    if (target === null) {
        return "";
    }
    const date = new Date(target.createdAt);
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
});

/** 会话状态的中文说法。 */
const statusText = computed((): string => {
    const status = session.value?.status;
    if (status === "replying") {
        return "助手正在回复";
    }

    return (session.value?.messageCount ?? 0) > 0 ? "空闲" : "还没有发言";
});
</script>

<template>
    <aside class="chat-context">
        <section class="xy-panel">
            <h4 class="xy-panel-title">当前会话</h4>

            <ElDescriptions v-if="session" :column="1" size="small" border>
                <ElDescriptionsItem label="标题">
                    <span class="chat-context__title">{{ session.title }}</span>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="消息">
                    <span class="numeral">{{ session.messageCount }} 条</span>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="状态">{{ statusText }}</ElDescriptionsItem>
                <ElDescriptionsItem label="创建">
                    <span class="numeral">{{ created }}</span>
                </ElDescriptionsItem>
            </ElDescriptions>

            <ElEmpty v-else description="还没有打开会话" :image-size="50" />

            <p class="xy-note">
                会话与消息都只在这个进程的内存里（`src/store/chat.store.ts`），
                <strong>刷新即清空</strong>：对话还没有对应的表。
            </p>
        </section>

        <slot />
    </aside>
</template>

<style scoped>
.chat-context {
    background: var(--el-fill-color-light);
    border-left: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 12px;
    overflow-y: auto;
    padding: 14px;
    width: 300px;
}

.chat-context__title {
    word-break: break-all;
}

.chat-context :deep(.el-descriptions__label) {
    width: 62px;
}

.chat-context :deep(.el-empty) {
    padding: 12px 0;
}
</style>
