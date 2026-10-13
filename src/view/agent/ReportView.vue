<script setup lang="ts">
/**
 * 报告（`/agent/report`）：深度研究与课题研究的产出。
 *
 * ## 为什么单设一个页面
 *
 * `docs/ui-architecture.md` §8 的理由：深度研究与课题研究的产出是**报告**，
 * 而在此之前它们只是消息流里的一段。用户要"把上次那份报告找出来"没有落点。
 *
 * ## 报告从哪来
 *
 * 它**不是新数据层**：报告是会话的产物视图。这一页做的事是从
 * `chat.store` 的全部会话里，挑出助手给出过**带引用的长回答**的那些，
 * 把那些回答当作报告列出来。
 *
 * 判据取自 `src/entity/research.ts` 的 `stageOf()`——"成文"这一步的定义是
 * "助手已给出带引用的结论"，也正是"这条会话产出了报告"的定义。
 * 复用那个判据而不是另立一条，是为了让"研究到哪一步"与"有没有报告"永远一致。
 *
 * ## 引用的显示
 *
 * 报告里的引用要**行内紧贴论断**（§2.3 第 2 条，NN/g 五条规则，
 * 其中"人们很少点引用链接"是本项目必须绕开的坑）。这一页直接复用
 * `ChatMessageBubble` 的渲染，所以引用 chip 的样子与对话页**完全一致**——
 * 同一件事在应用里只有一个实现。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import ChatMessageBubble from "../agent/chat/ChatMessageBubble.vue";
import { useRouter } from "../../plugin";
import { relativeTime } from "../../entity/chat";
import type { ChatMessage, ChatSession } from "../../entity/chat";
import { useChatStore } from "../../store/chat.store";

const router = useRouter();
const chat = useChatStore();

chat.ensureReady();

/** 一条报告：来源会话 + 那条带引用的回答。 */
interface Report {
    session: ChatSession;
    message: ChatMessage;
    citations: number;
    origins: number;
    version: number;
}

/**
 * 从全部会话里挑出报告。
 *
 * 判据：**助手发出的、带引用的**消息。与 `src/entity/research.ts` 的
 * `stageOf()` 把"成文"判为"助手给出带引用的结论"是同一条。
 */
const reports = computed<Report[]>(() => {
    const out: Report[] = [];

    for (const session of chat.state.sessions) {
        const messages = chat.state.messages[session.id] ?? [];
        for (const message of messages) {
            const citations = message.citations ?? [];
            if (message.role !== "assistant" || citations.length === 0) {
                continue;
            }
            const origins = new Set(citations.map((item) => item.source)).size;
            out.push({
                session,
                message,
                citations: citations.length,
                // 独立出处数：同一份材料引三次只算一处（`docs/research.md` §4
                // 把"交叉验证"与"多贴几条引用"分得很清）
                origins,
                version: messages.indexOf(message) + 1
            });
        }
    }

    return out.sort((left, right) => right.message.time - left.message.time);
});

/** 当前打开的报告。 */
const picked = ref<string | null>(null);

/** 按 id 找报告。 */
const active = computed(
    () => reports.value.find((item) => item.message.id === picked.value) ?? reports.value[0] ?? null
);

/** 报告标题：取会话标题（它就是首条发言的摘要）。 */
const titleOf = (report: Report): string => report.session.title;

/** 去来源会话。 */
const openSession = (session: ChatSession): void => {
    chat.selectSession(session.channel, session.id);
    void router.push(`/agent/chat/${session.channel}`);
};

/** 复制引用清单。 */
const copyCitations = async (report: Report): Promise<void> => {
    const lines = (report.message.citations ?? []).map(
        (item) => `- ${item.title}（${item.source}）${item.note ? `：${item.note}` : ""}`
    );
    await navigator.clipboard.writeText(lines.join("\n"));
};

/** 导出报告的 Markdown。走 dsh-os 的 file.create（写操作，要 allow）。 */
const exporting = ref(false);
const exportNote = ref("");

const exportReport = async (report: Report): Promise<void> => {
    exporting.value = true;
    exportNote.value = "";

    const citations = (report.message.citations ?? [])
        .map((item) => `- ${item.title}（${item.source}）${item.note ? `：${item.note}` : ""}`)
        .join("\n");

    const body = [
        `# ${titleOf(report)}`,
        "",
        `> 来源会话：${report.session.id}（${report.session.channel}）· ${relativeTime(report.message.time)}`,
        "",
        report.message.text,
        "",
        "## 出处",
        "",
        citations
    ].join("\n");

    const name = `./report-${report.session.channel}-${report.message.time}.md`;
    const result = await window.desktop.os.invoke({
        verb: "file.create",
        args: [name, body, "utf-8"],
        allow: true
    });

    exporting.value = false;
    exportNote.value = result.ok
        ? `已写出 ${name}`
        : (result.envelope?.error?.message ?? result.note ?? "写出失败");
};
</script>

<template>
    <PageShell
        :state="reports.length === 0 ? 'empty' : 'ready'"
        source="对话会话"
        empty-text="还没有报告。报告是带引用的回答——去「深度研究」或「课题研究」问一个需要出处的问题，助手给出带引用的结论之后，这里就会出现一条。"
        @retry="() => router.push('/agent/chat/research')">
        <div class="reports">
            <!-- 左：报告列表 -->
            <aside class="reports__list">
                <ElScrollbar class="reports__scroll">
                    <ul class="reports__items">
                        <li v-for="report in reports" :key="report.message.id">
                            <button
                                type="button"
                                class="reports__item"
                                :class="{ 'is-active': report.message.id === active?.message.id }"
                                @click="picked = report.message.id">
                                <span class="reports__item-title is-truncated">{{ titleOf(report) }}</span>
                                <span class="reports__item-meta">
                                    <span class="xy-dim numeral">{{ report.citations }} 条引用</span>
                                    <span class="xy-dim numeral">{{ report.origins }} 处出处</span>
                                </span>
                                <span class="xy-dim reports__item-when">{{ relativeTime(report.message.time) }}</span>
                            </button>
                        </li>
                    </ul>
                </ElScrollbar>
            </aside>

            <!-- 右：报告正文 -->
            <section v-if="active !== null" class="reports__detail">
                <header class="reports__head">
                    <h2 class="reports__title">
                        <AppIcon name="Collection" />
                        <span>{{ titleOf(active) }}</span>
                    </h2>

                    <!--
                        AI 标记（§9.5）：报告是助手生成的，所以必须打标。
                        点开给**摘要级**说明，不直接展开长文——Carbon for AI 的原则 ③。
                    -->
                    <ElPopover placement="bottom" :width="320" trigger="click">
                        <template #reference>
                            <ElTag size="small" type="warning" effect="plain" class="reports__ai">AI 生成</ElTag>
                        </template>
                        <p class="xy-note reports__ai-note">
                            这条内容由助手生成。它引用了 <span class="numeral">{{ active.citations }}</span> 条材料、
                            来自 <span class="numeral">{{ active.origins }}</span> 处独立出处。
                            结论请以**原始记录**为准——具体到哪一张表哪一行，看正文里的引用条目。
                        </p>
                    </ElPopover>

                    <span class="xy-dim">
                        {{ active.session.channel === "research" ? "深度研究" : "课题研究" }} ·
                        {{ relativeTime(active.message.time) }}
                    </span>

                    <span class="reports__spring" />

                    <ElButton text size="small" @click="openSession(active.session)">
                        <AppIcon name="ChatDotRound" />
                        <span>回到会话</span>
                    </ElButton>
                    <ElButton text size="small" @click="copyCitations(active)">
                        <AppIcon name="DocumentCopy" />
                        <span>复制引用清单</span>
                    </ElButton>
                    <ElButton text size="small" :loading="exporting" @click="exportReport(active)">
                        <AppIcon name="Download" />
                        <span>导出 Markdown</span>
                    </ElButton>
                </header>

                <p v-if="exportNote.length > 0" class="xy-note reports__note" role="status" aria-live="polite">
                    {{ exportNote }}
                </p>

                <ElScrollbar class="reports__body">
                    <!--
                        正文复用对话页的气泡渲染：引用 chip 的样子与对话页完全一致。
                        同一件事在应用里只有一个实现（§2.2 第 8 条，内部一致性）。
                    -->
                    <ChatMessageBubble :message="active.message" class="reports__bubble" />

                    <p class="xy-note">
                        报告的正文与引用直接取自会话消息，**不是另存一份**。
                        所以对话里的回答一改，这里跟着改；而"报告"这个概念本身
                        目前还没有对应的表（与对话、工作流定义一样，
                        见 <code>docs/design.md</code> 的迁移约定）。
                    </p>
                </ElScrollbar>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.reports {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
}

.reports__list {
    border-right: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    min-height: 0;
    padding-right: 12px;
    width: 260px;
}

.reports__scroll {
    height: 100%;
}

.reports__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
}

/* 整块可点：Fitts 定律 */
.reports__item {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 7px 8px;
    text-align: left;
    width: 100%;
}

.reports__item:hover {
    background: var(--el-fill-color-light);
}

.reports__item.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
}

.reports__item-title {
    color: var(--el-text-color-regular);
    font-size: 13px;
}

.reports__item-meta {
    display: flex;
    gap: 8px;
}

.reports__item-when {
    font-size: 11px;
}

.reports__detail {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
}

.reports__head {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 10px;
}

.reports__title {
    align-items: center;
    display: flex;
    font-size: 15px;
    font-weight: 600;
    gap: 6px;
    margin: 0;
}

/* "弹簧"：把右侧动作推到最右 */
.reports__spring {
    flex: 1 1 auto;
}

.reports__ai {
    cursor: help;
}

.reports__ai-note {
    margin: 0;
}

.reports__note {
    flex-shrink: 0;
    margin: 0 0 8px;
}

.reports__body {
    flex: 1;
    min-height: 0;
}

.reports__bubble {
    max-width: 100%;
}
</style>
