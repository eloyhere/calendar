<script setup lang="ts">
/**
 * 工作流左栏：动作库 + 步骤列表 + 运行控制。
 *
 * ```
 * .flow-steps
 * ├─ 动作库     ElSelect（可筛选，按 `模块 · 动词` 平铺）+ 添加
 * ├─ 步骤列表   自己滚：序号 / 动词 / 状态 / 启用开关 / 排序删除
 * └─ 运行区     运行 / 中断 + 本次运行的步骤数
 * ```
 *
 * ## 为什么动作库是平铺的下拉而不是树
 *
 * 82 个动词按模块分组当然更好看，但 Element Plus 的分组选项要 `ElOptionGroup`，
 * 而 `src/globals.d.ts` 只登记了模板里实际用到的组件。为了分组去动那份全局类型表
 * 不划算：下拉本身可筛选，输入 `mouse` 就只剩鼠标那几个，检索比层级更快。
 *
 * ## 为什么运行按钮在左栏
 *
 * 运行的是**整张步骤表**，不是选中的那一步，所以它属于"列表"这一侧；
 * 右栏是单步的参数与输出，把它放在右栏会让人以为只跑选中项。
 */

import { ref } from "vue";

import AppIcon from "../../../component/AppIcon.vue";
import type { WorkflowState } from "../../../state/use-workflow";
import type { WorkflowStep } from "../../../../shared/workflow-api";

const props = defineProps<{
    /** 页面持有的工作流状态，见 `useWorkflow()` */
    state: WorkflowState;
}>();

/** 动作库当前选中的动词键。 */
const picked = ref("");

const addPicked = (): void => {
    if (picked.value.length === 0) {
        return;
    }
    props.state.addStep(picked.value);
    picked.value = "";
};

/** 一步在列表里的状态：没跑过 / 正在跑 / 成功 / 失败。 */
type StepStatus = "idle" | "running" | "ok" | "failed";

const statusOf = (step: WorkflowStep): StepStatus => {
    if (props.state.activeStepId.value === step.id) {
        return "running";
    }
    const result = props.state.results.value[step.id];
    if (!result) {
        return "idle";
    }
    return result.ok ? "ok" : "failed";
};

const statusIcon = (status: StepStatus): "Loading" | "CircleCheckFilled" | "WarningFilled" | "VideoPlay" => {
    switch (status) {
        case "running":
            return "Loading";
        case "ok":
            return "CircleCheckFilled";
        case "failed":
            return "WarningFilled";
        default:
            return "VideoPlay";
    }
};

const statusText = (status: StepStatus): string => {
    switch (status) {
        case "running":
            return "运行中";
        case "ok":
            return "成功";
        case "failed":
            return "失败";
        default:
            return "未运行";
    }
};

/** 参数摘要：把参数拼一行显示，空参数标出来。 */
const argsSummary = (step: WorkflowStep): string =>
    step.args.length === 0 ? "（无参数）" : step.args.map((arg) => (arg === "" ? "∅" : arg)).join(" · ");
</script>

<template>
    <div class="flow-steps">
        <div class="flow-steps__picker">
            <ElSelect
                v-model="picked"
                class="flow-steps__select"
                placeholder="选择要执行的动作"
                filterable
                clearable
                size="default">
                <ElOption
                    v-for="group in props.state.groups.value"
                    :key="group.module"
                    :label="group.module"
                    :value="`__module__${group.module}`"
                    disabled />
                <ElOption
                    v-for="verb in props.state.groups.value.flatMap((item) => item.verbs)"
                    :key="verb.key"
                    :label="`${verb.module} · ${verb.key.split('.').slice(1).join(' ') || verb.key}`"
                    :value="verb.key" />
            </ElSelect>

            <ElButton type="primary" :disabled="picked === ''" @click="addPicked">
                <AppIcon name="Fold" />
                <span>添加</span>
            </ElButton>
        </div>

        <ElScrollbar class="flow-steps__list">
            <ElEmpty v-if="props.state.steps.value.length === 0" description="还没有步骤，先从上面加一个" />

            <div
                v-for="(step, index) in props.state.steps.value"
                :key="step.id"
                class="flow-step"
                :class="{
                    'flow-step--active': props.state.selectedId.value === step.id,
                    'flow-step--off': !step.enabled
                }"
                @click="props.state.selectedId.value = step.id">
                <span class="flow-step__index numeral">{{ index + 1 }}</span>

                <div class="flow-step__body">
                    <div class="flow-step__title">
                        <span class="flow-step__verb">{{ step.verb }}</span>
                        <ElTag v-if="props.state.verbMap.value.get(step.verb)?.mutating" size="small" type="warning" effect="plain">
                            写
                        </ElTag>
                    </div>
                    <div class="flow-step__args">{{ argsSummary(step) }}</div>
                </div>

                <ElTooltip :content="statusText(statusOf(step))" placement="top">
                    <span class="flow-step__status" :class="`flow-step__status--${statusOf(step)}`">
                        <AppIcon :name="statusIcon(statusOf(step))" />
                    </span>
                </ElTooltip>

                <ElSwitch
                    :model-value="step.enabled"
                    size="small"
                    @click.stop
                    @update:model-value="(value: string | number | boolean) => props.state.updateStep(step.id, { enabled: Boolean(value) })" />

                <div class="flow-step__actions" @click.stop>
                    <ElButton link size="small" :disabled="index === 0" @click="props.state.moveStep(step.id, -1)">
                        <AppIcon name="Top" />
                    </ElButton>
                    <ElButton
                        link
                        size="small"
                        :disabled="index === props.state.steps.value.length - 1"
                        @click="props.state.moveStep(step.id, 1)">
                        <AppIcon name="Bottom" />
                    </ElButton>
                    <ElButton link size="small" type="danger" @click="props.state.removeStep(step.id)">
                        <AppIcon name="Delete" />
                    </ElButton>
                </div>
            </div>
        </ElScrollbar>

        <div class="flow-steps__run">
            <ElButton
                v-if="!props.state.running.value"
                type="primary"
                :disabled="!props.state.ready.value || props.state.enabledCount.value === 0"
                @click="props.state.run()">
                <AppIcon name="VideoPlay" />
                <span>运行 {{ props.state.enabledCount.value }} 步</span>
            </ElButton>
            <ElButton v-else type="danger" @click="props.state.cancel()">
                <AppIcon name="VideoPause" />
                <span>中断</span>
            </ElButton>

            <ElButton link :disabled="props.state.steps.value.length === 0" @click="props.state.clearSteps()">
                清空
            </ElButton>
        </div>
    </div>
</template>

<style scoped>
.flow-steps {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.flow-steps__picker {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding: 12px;
}

.flow-steps__select {
    flex: 1;
    min-width: 0;
}

.flow-steps__list {
    flex: 1;
    min-height: 0;
}

.flow-step {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding: 8px 12px;
}

.flow-step:hover {
    background: var(--el-fill-color-light);
}

.flow-step--active {
    background: var(--el-color-primary-light-9);
}

.flow-step--off {
    opacity: 0.5;
}

.flow-step__index {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 12px;
    width: 16px;
}

.flow-step__body {
    flex: 1;
    min-width: 0;
}

.flow-step__title {
    align-items: center;
    display: flex;
    gap: 6px;
}

.flow-step__verb {
    font-family: var(--el-font-family-mono, monospace);
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.flow-step__args {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.flow-step__status {
    flex-shrink: 0;
}

.flow-step__status--idle {
    color: var(--el-text-color-placeholder);
}

.flow-step__status--running {
    color: var(--el-color-primary);
    display: inline-flex;
    animation: flow-spin 1.2s linear infinite;
}

.flow-step__status--ok {
    color: var(--el-color-success);
}

.flow-step__status--failed {
    color: var(--el-color-danger);
}

@keyframes flow-spin {
    to {
        transform: rotate(360deg);
    }
}

.flow-step__actions {
    display: flex;
    flex-shrink: 0;
}

.flow-steps__run {
    align-items: center;
    border-top: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding: 12px;
}
</style>
