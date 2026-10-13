<script setup lang="ts">
/**
 * 助手抽屉：任意页可唤起的就地对话。
 *
 * ## 这是本次架构改动里对"智能体"最重要的一条
 *
 * 旧架构里助手是"一个要去的地方"——必须先离开当前页、进"智能体"域才能问一句。
 * 新架构把它变成**任何页面上都能就地打开的工具**（`docs/ui-architecture.md` §5.5）。
 *
 * 依据：
 *
 * - HAX **G7 Support efficient invocation**（能一键唤起）；
 * - HAX **G8 Support efficient dismissal**（能一键关闭，且**不阻塞主工作区**——
 *   所以是 `ElDrawer` 而不是模态对话框）；
 * - WCAG **3.2.6 Consistent Help**：帮助机制要在所有页面出现在相同的位置顺序，
 *   所以唤起入口固定在侧栏底部与顶栏右侧两处，其余地方不重复；
 * - §2.2 第 11 条（变化盲视）：焦点区内的提示才被看见，所以回答就在当前页边上。
 *
 * ## 为什么复用对话页的组件而不是另写一套
 *
 * `ChatMessageList` 与 `ChatComposer` 已经处理了消息流的四种形态（正文、说明、引用、
 * 提纲）与输入区的键盘约定。抽屉里另写一套的话，"引用怎么显示"这件事就有两个实现，
 * 而 §2.3 第 2 条（引用要行内紧贴论断）只会在其中一处生效。
 *
 * ## 会话归属
 *
 * 抽屉里的对话**就是一条会话**，用 `thought` 通道（「反问我」）或 `create` 通道，
 * 因此它会出现在 `/agent/chat` 的会话列表里。这一条很重要：抽屉是**快捷入口**，
 * 不是第二个收件箱——在里面聊过的东西必须在正式页面里找得到。
 *
 * ## 无障碍
 *
 * - 状态行 `role="status"`（WCAG 4.1.3）；
 * - `Esc` 关闭由 `AppShell` 统一处理，关闭后焦点回到唤起按钮
 *   （WCAG 2.1.2 无键盘陷阱）——这里只管把焦点送进去；
 * - 抽屉不模态（`modal: false`），后面的页面仍可点——"不阻塞主工作区"。
 */

import { computed, nextTick, ref, watch } from "vue";

import AppIcon from "../AppIcon.vue";
import { useRouter } from "../../plugin";
import { ChatChannels } from "../../entity/chat";
import { useChatSession } from "../../state/use-chat-session";
import { useShellStore } from "../../store/shell.store";
import ChatComposer from "../../view/agent/chat/ChatComposer.vue";
import ChatMessageList from "../../view/agent/chat/ChatMessageList.vue";

const shell = useShellStore();
const router = useRouter();

/**
 * 抽屉用哪个通道。
 *
 * `thought`（原"思维碰撞"）：`docs/ui-architecture.md` §4.3.3 把它从一级路径降到
 * 抽屉动作「反问我」。它是唯一一个**助手提问、用户产出想法**的形态，
 * 与抽屉"就地想一下"的定位一致；另外三个模式（研究 / 调研 / 课题）要产出报告，
 * 属于正式页面的工作。
 */
const channel = ref<"thought" | "create">("thought");

/**
 * 两个通道各装配一份会话状态。
 *
 * 都装配（而不是按 `channel` 动态 `useChatSession`）是因为 composable
 * 不能在条件分支里调用；两份状态各自持有自己的草稿与待回复句柄，
 * 切换通道时互不干扰。
 */
const thought = useChatSession("thought");
const create = useChatSession("create");
const chat = computed(() => (channel.value === "thought" ? thought : create));

const body = ref<HTMLElement | null>(null);

/** 打开时把焦点送进输入区。 */
watch(
    () => shell.assistantOpen,
    async (open) => {
        if (!open) {
            return;
        }
        await nextTick();
        body.value?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    }
);

/** 去正式的对话页接着聊。 */
const openInPage = (): void => {
    shell.closeAssistant();
    void router.push(`/agent/chat/${channel.value}`);
};
</script>

<template>
    <ElDrawer
        v-model="shell.assistantOpen"
        direction="rtl"
        size="420px"
        :modal="false"
        :with-header="false"
        class="assistant-drawer">
        <div class="assistant-drawer__inner">
            <header class="assistant-drawer__head">
                <AppIcon name="MagicStick" />
                <span class="assistant-drawer__title">助手</span>

                <!--
                    通道切换器只有一个（§2.2 第 3 条："很少是好主意去为通往次级选项
                    提供多条路径"），所以是一个二选一的分段控件，不是一个下拉菜单。
                -->
                <ElSegmented
                    :model-value="channel"
                    size="small"
                    :options="[
                        { label: '反问我', value: 'thought' },
                        { label: '自由对话', value: 'create' }
                    ]"
                    @update:model-value="
                        (value: string | number | boolean) => (channel = value as 'thought' | 'create')
                    " />

                <ElButton text size="small" @click="openInPage">在对话页打开</ElButton>

                <!-- Esc 也关，但按钮必须存在：键盘用户之外的人不该被迫记快捷键 -->
                <ElButton text size="small" aria-label="关闭助手" @click="shell.closeAssistant()">
                    <AppIcon name="Close" />
                </ElButton>
            </header>

            <!-- 状态行：WCAG 4.1.3，不抢焦点地播报 -->
            <p class="assistant-drawer__status" role="status" aria-live="polite">
                {{ ChatChannels[channel].description }}
            </p>

            <div ref="body" class="assistant-drawer__body">
                <ChatMessageList :chat="chat" />
            </div>

            <div class="assistant-drawer__composer">
                <ChatComposer
                    :chat="chat"
                    @update:draft="(text: string) => (chat.draft.value = text)" />
            </div>
        </div>
    </ElDrawer>
</template>

<style scoped>
.assistant-drawer__inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.assistant-drawer__head {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding: 10px 12px;
}

.assistant-drawer__title {
    font-size: 15px;
    font-weight: 600;
}

/*
 * 状态行占一行固定高度。
 *
 * 不留 `min-height` 的话，模式说明长短不一会让下面的消息流跳一下——
 * 而它承载的是"当前是哪个模式"，跳动的代价大于那一行空间。
 */
.assistant-drawer__status {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 12px;
    line-height: 18px;
    margin: 0;
    min-height: 18px;
    overflow: hidden;
    padding: 6px 12px 0;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.assistant-drawer__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}

.assistant-drawer__composer {
    border-top: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 8px 12px 12px;
}
</style>
