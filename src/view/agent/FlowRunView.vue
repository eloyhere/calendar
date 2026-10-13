<script setup lang="ts">
/**
 * 工作流运行记录（`/agent/flow/run`）：每次运行的时间线、产出与授权痕迹。
 *
 * ## 依据（`docs/ui-architecture.md` §7.4）
 *
 * | 设计                          | 依据                                                      |
 * | ----------------------------- | --------------------------------------------------------- |
 * | 耗时用**横向条 + 直接标数值**  | §2.4 第 4 条（长度最适合定量表达）；与 `docs/research.md` §3 第 13 条"计数用数字直排"一致 |
 * | 运行中先给**步骤级状态**       | §2.3 第 1 条（无结构的长文流式会加剧过载）                  |
 * | 中断是一等按钮                | Element Plus 可控性原则（"给建议可以，不要替用户做决定"）    |
 * | 状态用文字 + 图标             | WCAG **1.4.1**                                              |
 * | 哪几步是批准后执行的           | §7.5（审计要闭合）                                          |
 *
 * ## 为什么这里不做"流式输出回放"
 *
 * 记录是**运行结束之后**看的，那时 stdout 已经完整落在每一步里。
 * 再模拟一遍流式只会让"已经跑完"这件事看起来还在跑——
 * 那是 §2.2 第 11 条（变化盲视）最容易骗到人的形态。
 * 所以：运行中的流式在**编排器**里看，跑完之后到这一页看结论。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { relativeTime } from "../../entity/chat";
import { useFlowStore } from "../../store/flow.store";
import type { FlowRun, FlowRunStep } from "../../entity/workflow";

const flow = useFlowStore();

/** 选中的运行；默认第一条。 */
const picked = ref<string | null>(flow.runs[0]?.id ?? null);

/** 当前运行。 */
const current = computed<FlowRun | null>(
    () => flow.runs.find((item) => item.id === picked.value) ?? flow.runs[0] ?? null
);

/** 结局的中文与配色。 */
const outcomeOf = (value: string): { text: string; tone: "success" | "danger" | "warning" | "info" } => {
    switch (value) {
        case "ok":
            return { text: "成功", tone: "success" };
        case "failed":
            return { text: "失败", tone: "danger" };
        case "cancelled":
            return { text: "已中断", tone: "warning" };
        default:
            return { text: "运行中", tone: "info" };
    }
};

/** 最长的一步耗时：横向条的基准。 */
const longest = computed(() => {
    const steps = current.value?.steps ?? [];
    return Math.max(1, ...steps.map((step) => step.durationMs));
});

/** 一步的条宽。 */
const widthOf = (step: FlowRunStep): string => `${(step.durationMs / longest.value) * 100}%`;

/** 耗时的人读形式。 */
const durationText = (milliseconds: number): string =>
    milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(2)} s`;

/** 选一条运行。 */
const pick = (id: string): void => {
    picked.value = id;
};
</script>

<template>
    <PageShell
        :state="flow.runs.length === 0 ? 'empty' : 'ready'"
        source="localStorage"
        empty-text="还没有运行记录。去工作流定义库选一条，在编排器里跑一次，这里就会有记录。"
        @retry="flow.clearRuns">
        <div class="run-log">
            <!-- 左：运行列表 -->
            <aside class="run-log__list">
                <ElScrollbar class="run-log__scroll">
                    <ul class="run-log__items">
                        <li v-for="run in flow.runs" :key="run.id">
                            <button
                                type="button"
                                class="run-log__item"
                                :class="{ 'is-active': run.id === current?.id }"
                                @click="pick(run.id)">
                                <span class="run-log__item-name is-truncated">
                                    {{ run.definitionName }}
                                </span>
                                <span class="run-log__item-meta">
                                    <ElTag :type="outcomeOf(run.outcome).tone" size="small" effect="plain">
                                        {{ outcomeOf(run.outcome).text }}
                                    </ElTag>
                                    <span class="xy-dim numeral">v{{ run.definitionVersion }}</span>
                                </span>
                                <span class="xy-dim run-log__item-when">{{ relativeTime(run.startedAt) }}</span>
                            </button>
                        </li>
                    </ul>
                </ElScrollbar>

                <ElButton text size="small" class="run-log__clear" @click="flow.clearRuns">
                    <AppIcon name="Delete" />
                    <span>清空记录</span>
                </ElButton>
            </aside>

            <!-- 右：这次的详情 -->
            <section v-if="current !== null" class="run-log__detail">
                <header class="run-log__head">
                    <h2 class="run-log__title">
                        <AppIcon name="List" />
                        <span>{{ current.definitionName }}</span>
                    </h2>
                    <ElTag :type="outcomeOf(current.outcome).tone" size="small" effect="plain">
                        {{ outcomeOf(current.outcome).text }}
                    </ElTag>
                    <span class="xy-dim numeral">v{{ current.definitionVersion }}</span>
                    <span class="xy-dim">· {{ relativeTime(current.startedAt) }}</span>
                    <span class="xy-dim numeral">· 共 {{ durationText(current.durationMs) }}</span>
                </header>

                <ElScrollbar class="run-log__body">
                    <!-- 时间线：横向条 + 数值。长度编码耗时 -->
                    <div class="xy-panel run-log__panel">
                        <h3 class="xy-panel-title">步骤时间线</h3>

                        <ElEmpty
                            v-if="current.steps.length === 0"
                            description="这次运行没有步骤（可能在开始前就被中断了）"
                            :image-size="60" />

                        <ul v-else class="run-log__bars">
                            <li v-for="(step, index) in current.steps" :key="step.stepId" class="run-log__bar-row">
                                <span class="run-log__bar-index numeral">{{ index + 1 }}</span>

                                <!-- 状态用图标 + 文字，不只靠颜色 -->
                                <AppIcon
                                    :name="step.ok ? 'CircleCheckFilled' : 'WarningFilled'"
                                    :class="step.ok ? 'run-log__ok' : 'run-log__bad'" />

                                <span class="run-log__bar-verb numeral is-truncated">{{ step.verb }}</span>

                                <!-- 批准痕迹：审计要闭合（§7.5） -->
                                <ElTag v-if="step.approved" size="small" type="warning" effect="plain">
                                    已批准
                                </ElTag>

                                <span class="run-log__bar-track">
                                    <span
                                        class="run-log__bar"
                                        :class="{ 'is-bad': !step.ok }"
                                        :style="{ width: widthOf(step) }" />
                                </span>

                                <span class="run-log__bar-value numeral">{{ durationText(step.durationMs) }}</span>
                            </li>
                        </ul>
                    </div>

                    <!-- 每步的命令与结论 -->
                    <div class="xy-panel run-log__panel">
                        <h3 class="xy-panel-title">每步的命令与结论</h3>

                        <div v-for="(step, index) in current.steps" :key="step.stepId" class="run-log__step">
                            <p class="run-log__step-head">
                                <span class="numeral run-log__step-index">{{ index + 1 }}</span>
                                <span class="numeral">{{ step.verb }}</span>
                                <ElTag :type="step.ok ? 'success' : 'danger'" size="small" effect="plain">
                                    {{ step.ok ? "成功" : "失败" }}
                                </ElTag>
                                <span v-if="step.exitCode !== null" class="xy-dim numeral">
                                    退出码 {{ step.exitCode }}
                                </span>
                            </p>

                            <p v-if="step.errorCode" class="xy-dim run-log__step-note">
                                错误码 <span class="numeral">{{ step.errorCode }}</span>
                            </p>
                            <p v-if="step.note" class="xy-dim run-log__step-note">{{ step.note }}</p>

                            <!-- 命令行原样保留：信封是给程序读的，原文是给人读的 -->
                            <pre class="run-log__command numeral">{{ step.command }}</pre>
                        </div>
                    </div>

                    <!-- 变量：这次运行用的值 -->
                    <div v-if="Object.keys(current.values).length > 0" class="xy-panel run-log__panel">
                        <h3 class="xy-panel-title">这次用的变量</h3>
                        <ElDescriptions :column="1" border size="small">
                            <ElDescriptionsItem
                                v-for="(value, name) in current.values"
                                :key="String(name)"
                                :label="String(name)">
                                <span class="numeral run-log__value">{{ value }}</span>
                            </ElDescriptionsItem>
                        </ElDescriptions>
                    </div>

                    <p class="xy-note">
                        记录只留最近 50 次。运行中的流式输出在**编排器**里看——
                        这一页是跑完之后回看结论的地方，不重放过程。
                    </p>
                </ElScrollbar>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.run-log {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
}

.run-log__list {
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    padding-right: 12px;
    width: 240px;
}

.run-log__scroll {
    flex: 1;
    min-height: 0;
}

.run-log__items {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
}

/* 整块可点：Fitts 定律 */
.run-log__item {
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

.run-log__item:hover {
    background: var(--el-fill-color-light);
}

.run-log__item.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
}

.run-log__item-name {
    color: var(--el-text-color-regular);
    font-size: 13px;
}

.run-log__item-meta {
    align-items: center;
    display: flex;
    gap: 6px;
}

.run-log__item-when {
    font-size: 11px;
}

.run-log__clear {
    flex-shrink: 0;
    margin-top: 8px;
}

.run-log__detail {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
}

.run-log__head {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 10px;
}

.run-log__title {
    align-items: center;
    display: flex;
    font-size: 15px;
    font-weight: 600;
    gap: 6px;
    margin: 0;
}

.run-log__body {
    flex: 1;
    min-height: 0;
}

.run-log__panel {
    margin-bottom: 16px;
}

.run-log__bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.run-log__bar-row {
    align-items: center;
    display: flex;
    gap: 8px;
}

.run-log__bar-index {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-size: 11px;
    text-align: right;
    width: 18px;
}

.run-log__ok {
    color: var(--el-color-success);
}

.run-log__bad {
    color: var(--el-color-danger);
}

.run-log__bar-verb {
    flex-shrink: 0;
    font-size: 12px;
    width: 170px;
}

.run-log__bar-track {
    background: var(--el-fill-color-light);
    border-radius: 3px;
    flex: 1;
    height: 12px;
    min-width: 0;
}

.run-log__bar {
    background: var(--el-color-success-light-5);
    border-radius: 3px;
    display: block;
    height: 100%;
}

.run-log__bar.is-bad {
    background: var(--el-color-danger-light-5);
}

.run-log__bar-value {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 11px;
    text-align: right;
    width: 70px;
}

.run-log__step {
    border-top: 1px solid var(--el-border-color-lighter);
    padding: 10px 0;
}

.run-log__step:first-of-type {
    border-top: none;
}

.run-log__step-head {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 4px;
}

.run-log__step-index {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
}

.run-log__step-note {
    margin: 2px 0;
}

/*
 * 命令行原文。
 *
 * `pre` + 等宽 + 可横向滚动：命令行的空白是有意义的，折行会让人误读参数。
 */
.run-log__command {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    color: var(--el-text-color-regular);
    font-size: 12px;
    margin: 6px 0 0;
    overflow-x: auto;
    padding: 8px 10px;
    white-space: pre-wrap;
    word-break: break-all;
}

.run-log__value {
    word-break: break-all;
}
</style>
