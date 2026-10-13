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
 * ## 两种内容形态：散装（默认插槽）与分组（`tabs`）
 *
 * 各模式右栏的东西数量差别很大：新建对话只有几张提示卡片，深度研究有九块
 * （进度、深度、证据、否证、边界、未决问题、自检、要点、资料）。九块自上而下
 * 排开会出现两个问题——面板被拉得比窗口还长，用户要一路滚到底才知道有没有
 * 别的；而且"哪几块是一件事"没有表达出来。
 *
 * 所以给一个可选的 `tabs`：传了就把插槽内容按分组装进 `ElTabs`，没传就保持
 * 原来的散装排布（新建对话这类不需要分组）。
 *
 * ## 高度：面板自己是弹性的，内容各自滚
 *
 * 右栏**不整块滚动**——整块滚起来时"当前会话"会跟着滚出视野，而这个面板的
 * 会话列表面板也做不到"滚到头才看见下一块"。改成：右栏是纵向 Flex，会话块
 * 固定在顶部，标签页区 `flex: 1`，**每个标签页自己滚**。这样无论窗口多高多矮，
 * 右栏都不会顶出父容器，内容也不会被裁掉。
 *
 * 标签页区用 `border-card` 型：它给内容区加一圈边框与内边距，滚动区因此有
 * 明确的边界，滚到头一眼能看出来。
 */

import { computed, ref, watch } from "vue";

import type { ChatPageApi } from "../../../state/use-chat-page";
import { useChatStore } from "../../../store/chat.store";
import { relativeTime } from "../../../entity/chat";

/** 一个标签页。 */
export interface ChatContextTab {
    /** 标签页标识，同时是插槽名 */
    name: string;
    /** 标签页标题 */
    label: string;
}

interface Props {
    /** `useChatPage()` 的返回值 */
    chat: ChatPageApi;
    /** 右栏内容的分组；不传则退化为"默认插槽 + 整块滚动" */
    tabs?: readonly ChatContextTab[];
}

const props = withDefaults(defineProps<Props>(), { tabs: () => [] });

/** 当前标签页；默认停在第一组。 */
const activeTab = ref(props.tabs[0]?.name ?? "");

/**
 * 会话换了就回到第一组。
 *
 * 标签页的选择原本是"我看哪一块"的局部偏好，但会话换了之后"证据"里是另一条
 * 会话的材料——停在上次那一页会让人以为新会话没有进度。
 */
watch(
    () => props.chat.active.value?.id,
    (): void => {
        activeTab.value = props.tabs[0]?.name ?? "";
    }
);

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

/* -------------------------------------------------------------------------- */
/* 本地缓存                                                                    */
/* -------------------------------------------------------------------------- */

const store = useChatStore();

/**
 * 缓存规模。
 *
 * 用 store 自己导出的两个 computed（`total` / `messageTotal`）而不是去数
 * `store.state.value.sessions`：Pinia 对 store 里的 ref 做了类型解包，
 * 读到的 `store.state` 已经是 `ChatState` 而不是 `Ref<ChatState>`——按 `.value`
 * 写会在类型检查阶段直接报「`ChatState` 上不存在 `value`」。用现成的 computed
 * 既对得上类型，也不必在这里再遍历一遍消息。
 *
 * 不调 `store.stats()` 是有意的：那个函数每次都读 `localStorage` 并解析整份快照，
 * 挂在模板上等于每次渲染都做一遍全量解析。状态里的会话与消息就是刚写下去的那一份，
 * 两者只差一个防抖窗口，对这个面板足够准。
 */
const cache = computed(() => {
    return {
        sessions: store.total,
        messages: store.messageTotal,
        savedAt: store.lastWrite?.at ?? null,
        ok: store.lastWrite?.ok
    };
});

/** 缓存的落盘时刻。 */
const savedText = computed((): string => {
    const at = cache.value.savedAt;

    return at === null ? "尚未写入" : `缓存于 ${relativeTime(at)}`;
});

/** 字节数按 KB 显示：一份对话快照顶多几十 KB，不必上 MB 档。 */
const sizeText = computed((): string => {
    const bytes = store.lastWrite?.bytes ?? 0;

    return bytes === 0 ? "" : `${(bytes / 1024).toFixed(1)} KB`;
});

/** 清空历史；带确认，不做"删了就没了"的按钮。 */
function clearHistory(): void {
    store.clearHistory();
    props.chat.startSession();
}
</script>

<template>
    <aside class="chat-context">
        <section class="xy-panel chat-context__head">
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

            <ElEmpty v-else description="还没有打开会话" :image-size="42" />

            <!-- 缓存状态：写没写下去、有多少、什么时候写的 -->
            <div class="chat-context__cache">
                <div class="chat-context__cache-row">
                    <span class="xy-dim">本地缓存</span>
                    <ElTag
                        :type="cache.ok === false ? 'danger' : cache.ok ? 'success' : 'info'"
                        size="small"
                        effect="plain">
                        {{ cache.ok === false ? "写入失败" : cache.ok ? "已写入" : "未写入" }}
                    </ElTag>
                </div>

                <span class="xy-dim numeral">
                    {{ cache.sessions }} 条会话 · {{ cache.messages }} 条消息
                    <template v-if="sizeText"> · {{ sizeText }}</template>
                </span>

                <div class="chat-context__cache-row">
                    <span class="xy-dim">{{ savedText }}</span>

                    <ElPopconfirm
                        title="清空全部会话与缓存？"
                        confirm-button-text="清空"
                        cancel-button-text="取消"
                        width="220"
                        @confirm="clearHistory">
                        <template #reference>
                            <ElButton text size="small" type="danger">清空</ElButton>
                        </template>
                    </ElPopconfirm>
                </div>
            </div>

            <p class="xy-note">
                会话与消息存在浏览器本地存储里（`src/store/chat.cache.ts`），
                <strong>刷新与重启后自动恢复</strong>；清空之后会重新铺一次演示会话。
                对话还没有对应的表，所以这份缓存是当前的持久化方案，将来会换成 sqlite。
            </p>
        </section>

        <!-- 分组形态：标签页各自滚，右栏整体不滚 -->
        <ElTabs
            v-if="props.tabs.length > 0"
            v-model="activeTab"
            type="border-card"
            class="chat-context__tabs">
            <ElTabPane
                v-for="tab in props.tabs"
                :key="tab.name"
                :label="tab.label"
                :name="tab.name">
                <div class="chat-context__pane">
                    <slot :name="tab.name" />
                </div>
            </ElTabPane>
        </ElTabs>

        <!-- 散装形态：几块内容直接排下来，整块滚 -->
        <div v-else class="chat-context__stack">
            <slot />
        </div>
    </aside>
</template>

<style scoped>
.chat-context {
    background: var(--el-fill-color-light);
    border-left: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 8px;
    min-height: 0;
    overflow: hidden;
    padding: 10px;
    width: 300px;
}

.chat-context__head {
    flex-shrink: 0;
    padding: 10px 12px;
}

.chat-context__title {
    word-break: break-all;
}

.chat-context__cache {
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    padding: 8px 10px;
}

.chat-context__cache-row {
    align-items: center;
    display: flex;
    gap: 8px;
    justify-content: space-between;
    min-height: 22px;
}

.chat-context :deep(.el-descriptions__label) {
    width: 56px;
}

.chat-context :deep(.el-empty) {
    padding: 8px 0;
}

/* 标签页区：吃掉剩下的高度，且自己不滚（滚的是里面每个 pane） */
.chat-context__tabs {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.chat-context__tabs :deep(.el-tabs__header) {
    flex-shrink: 0;
    margin: 0;
}

.chat-context__tabs :deep(.el-tabs__item) {
    font-size: 13px;
    height: 34px;
    line-height: 34px;
    padding: 0 10px;
}

.chat-context__tabs :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    padding: 0;
}

/* 每个标签页自己滚：内容再长也不会把右栏顶出父容器 */
.chat-context__tabs :deep(.el-tab-pane) {
    height: 100%;
    overflow-y: auto;
}

.chat-context__pane {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
}

/* 散装形态：整块滚动，供不需要分组的模式沿用 */
.chat-context__stack {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 8px;
    min-height: 0;
    overflow-y: auto;
}
</style>
