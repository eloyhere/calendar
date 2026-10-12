<script setup lang="ts">
/**
 * 聊天页壳：六个智能体模式共用。
 *
 * ## 为什么是"一套壳 + 六个路由"而不是"一个页面 + 模式参数"
 *
 * 六种模式的交互骨架完全相同（会话侧栏 / 消息流 / 输入区），差异只在提示语、
 * 输入框占位与产出形态。做成六个路由的好处是每条都能深链、能在侧栏里各自
 * 出现、能独立演进（深度研究将来要加"引用来源"面板，思维碰撞要加"追问链"），
 * 而共用一套壳保证它们不会各写一遍三栏布局。
 *
 * 路由表里 `/agent/chat` 是这六个页面的父节点，它的 `meta.menu` 是 `false`，
 * 所以侧栏里看到的是六个模式本身，不会多出一个"对话"分组。
 *
 * ## 布局
 *
 * ```
 * ElContainer  direction=vertical            撑满内容区
 * ├─ ElAlert                                模式说明（将来放产出格式提示）
 * ├─ ElContainer
 * │  ├─ ElAside  width=260px                 会话列表
 * │  └─ ElMain                              消息流 + 输入区
 * ```
 *
 * 消息流用 `ElScrollbar` 自己滚，输入区固定在底部——聊天界面最忌讳输入框
 * 跟着消息滚走。
 */

import { computed, ref } from "vue";
import { ElText } from "element-plus";
import { Plus } from "@element-plus/icons-vue";

interface Props {
    /** 模式名，显示在提示条上 */
    mode: string;
    /** 输入框占位文案 */
    placeholder?: string;
    /** 模式说明 */
    hint?: string;
    /** 当前路由的 `meta.description`，缺省时用它兜底 */
    description?: string;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "说点什么……",
    hint: "",
    description: ""
});

/** 输入框内容；还没接后端，先只做本地状态。 */
const draft = ref("");

/** 样式化的模式说明。 */
const modeHint = computed(
    () => props.hint || props.description || "六种模式共用同一套会话壳；差异在提示语与产出形态。"
);

/** 发送：后端未接，暂不产生任何行为。 */
function send(): void {
    draft.value = "";
}
</script>

<template>
    <ElContainer direction="vertical" class="chat-page">
        <ElAlert
            :title="`${props.mode}：${modeHint}`"
            type="info"
            :closable="false"
            show-icon
            class="chat-page__hint" />

        <ElContainer class="chat-page__body">
            <!-- 会话列表 -->
            <ElAside width="240px" class="chat-page__sessions">
                <div class="chat-page__sessions-head">
                    <ElText tag="strong" size="small">会话</ElText>
                    <ElButton text size="small">
                        <ElIcon><Plus /></ElIcon>
                        <span>新建</span>
                    </ElButton>
                </div>
                <ElScrollbar class="chat-page__sessions-list">
                    <ElEmpty description="还没有会话" :image-size="60" />
                </ElScrollbar>
            </ElAside>

            <!-- 消息流 + 输入区 -->
            <ElMain class="chat-page__main">
                <ElScrollbar class="chat-page__stream">
                    <ElEmpty
                        :description="`${props.mode}：还没有消息`"
                        :image-size="96">
                        <ElText type="info" size="small">
                            消息流、工具调用与引用来源都还没接；接入点见 src/state/use-page-state.ts
                            的说明。
                        </ElText>
                    </ElEmpty>
                </ElScrollbar>

                <div class="chat-page__composer">
                    <ElInput
                        v-model="draft"
                        type="textarea"
                        :rows="3"
                        :placeholder="props.placeholder"
                        resize="none" />
                    <div class="chat-page__actions">
                        <ElText type="info" size="small">Enter 发送 · Shift + Enter 换行</ElText>
                        <ElButton type="primary" :disabled="draft.length === 0" @click="send">
                            <ElIcon><Promotion /></ElIcon>
                            <span>发送</span>
                        </ElButton>
                    </div>
                </div>
            </ElMain>
        </ElContainer>
    </ElContainer>
</template>

<style scoped>
.chat-page {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    height: calc(100vh - 200px);
    min-height: 420px;
    overflow: hidden;
}

.chat-page__hint {
    border-radius: 0;
    flex-shrink: 0;
}

.chat-page__body {
    min-height: 0;
}

.chat-page__sessions {
    background: var(--el-fill-color-blank);
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.chat-page__sessions-head {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    justify-content: space-between;
    padding: 8px 12px;
}

.chat-page__sessions-list {
    flex: 1;
    min-height: 0;
    padding: 12px;
}

.chat-page__main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
}

.chat-page__stream {
    flex: 1;
    min-height: 0;
    padding: 16px;
}

.chat-page__composer {
    border-top: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 12px 16px;
}

.chat-page__actions {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
}
</style>
