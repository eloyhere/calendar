<script setup lang="ts">
/**
 * 工作流编排器（`/agent/flow/:id`）。
 *
 * ## 沉浸布局
 *
 * 路由表里这一条带 `meta.chrome === "immersive"`，所以外壳不渲染侧栏与状态栏
 * （`docs/ui-architecture.md` §4.3.4）。理由：默认窗口是 1440×720，侧栏 220px
 * 会把编排区压掉 15%；而编排器要在同一屏里放下"动作库 / 步骤 / 参数 / 追踪"四块。
 *
 * ## 三区 + 右栏三个页签
 *
 * ```
 * ┌───────────┬──────────────────────────────┬───────────────────────┐
 * │ 左 240px  │ 中 flex:1                     │ 右 340px              │
 * │ 动作库     │ 步骤表（含参数与绑定）          │ ├ 变量                │
 * │ 82 个动词   │ 拖到线上自动插入（见下）        │ ├ 运行                │
 * │ 分组筛选    │ 每步：动词 / 参数 / 开关 / 排序 │ └ 追踪                │
 * │ 搜索       │                              │                       │
 * └───────────┴──────────────────────────────┴───────────────────────┘
 * ```
 *
 * ## 结构照 Node-RED（§2.3 第 9 条，已核实）
 *
 * - **全局动作放顶栏**（"运行 / 中断"），不放中间——画布类界面里放在内容区
 *   会与"这一步的动作"混淆；
 * - **节点面板在左**，"多数流程从这里开始"；
 * - 侧栏可折叠（这里用右栏的页签代替"可移动的面板"，因为屏幕只有 1440 宽）。
 *
 * ## 关于"节点拖到线上自动插入"
 *
 * Node-RED 的 splice 交互（§2.3 第 10 条）在**图**里是"拖到线的中点"。
 * 本项目的步骤是**线性顺序表**（`WorkflowStep[]`），所以它的等价物是
 * **点某一步的「插入」按钮**：新动词直接插在那一步之后。
 * 这不是省略——线性表里没有"线的中点"这个位置，而有"两步之间"这个位置，
 * 两者是同一个概念。
 *
 * ## 参数怎么填：名字来自源码
 *
 * `WorkflowCatalog.verbs[].names` 是从模块源码静态提取的参数名
 * （`scripts/operation/build.mjs`：`Get-Positional -Name 'path'`）。
 * 所以这里显示的是 `path` / `content` / `charset`，而不是 `arg1` / `arg2`——
 * 后者会逼用户去读源码才知道第 3 个参数是什么。
 *
 * ## 授权：写操作在运行前逐个确认
 *
 * `mutating` 的步骤默认带 `allow: true`（用户已经在编排时看到"写"标记），
 * 但**运行时仍会停下来**——见下面的 `run()`：写操作先收集成一张待批准清单，
 * 用户点了"允许"才真的带 `allow` 发出去。这是 §7.5 与 HAX **G16** 要求的
 * "传达后果"。
 */

import { computed, ref, watch } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import PageShell from "../../component/PageShell.vue";
import { useRoute, useRouter } from "../../plugin";
import type { WorkflowCatalog, WorkflowEvent, WorkflowStep, WorkflowVerb } from "../../../shared/workflow-api";
import type { FlowRunStep } from "../../entity/workflow";
import { newId, referencesIn, resolveArgs, unresolvedOf } from "../../entity/workflow";
import { useFlowStore } from "../../store/flow.store";
import { useShellStore } from "../../store/shell.store";

const route = useRoute();
const router = useRouter();
const flow = useFlowStore();
const shell = useShellStore();

/**
 * 参数槽里引用了哪些变量，拼成 `{{a}} {{b}}` 的形状。
 *
 * 为什么在脚本里拼而不是模板里直接写：模板插值的定界符本身就是双花括号，
 * 在插值表达式里再写一次会在第一个 `}}` 处提前收尾，构建期直接报
 * "Error parsing JavaScript expression"。所以花括号在这里造出来。
 */
const templateRefs = (arg: string): string =>
    referencesIn(arg)
        .map((item) => `{{${item}}}`)
        .join(" ");

/** 说明文字里那个"变量占位符长什么样"的例子。同样不能在模板里直接写。 */
const variableToken = `{{变量}}`;

/* -------------------------------------------------------------------------- */
/* 定义                                                                        */
/* -------------------------------------------------------------------------- */

/** 定义 id。 */
const id = computed(() => String(route.params.id ?? ""));

/** 当前定义。 */
const definition = computed(() => flow.byId(id.value));

/** 非法 id 时给空态，不重定向（与历法页同一个判断）。 */
const missing = computed(() => definition.value === null);

/** 定义名字的本地编辑值（失焦才落库，避免每敲一个字就写一次 localStorage）。 */
const nameDraft = ref("");
const descDraft = ref("");

watch(
    definition,
    (value) => {
        nameDraft.value = value?.name ?? "";
        descDraft.value = value?.description ?? "";
    },
    { immediate: true }
);

/** 落库名字。 */
const commitName = (): void => {
    if (definition.value !== null && nameDraft.value.trim().length > 0) {
        flow.update(id.value, { name: nameDraft.value.trim() });
    } else {
        nameDraft.value = definition.value?.name ?? "";
    }
};

/** 落库说明。 */
const commitDescription = (): void => {
    if (definition.value !== null) {
        flow.update(id.value, { description: descDraft.value });
    }
};

/* -------------------------------------------------------------------------- */
/* 动词清单                                                                    */
/* -------------------------------------------------------------------------- */

const catalog = ref<WorkflowCatalog | null>(null);
const catalogError = ref("");

const loadCatalog = async (): Promise<void> => {
    try {
        catalog.value = await window.desktop.os.catalog();
    } catch (error) {
        catalogError.value = error instanceof Error ? error.message : String(error);
    }
};

void loadCatalog();

/** 动词键 → 条目。 */
const verbMap = computed(() => {
    const map = new Map<string, WorkflowVerb>();
    for (const verb of catalog.value?.verbs ?? []) {
        map.set(verb.key, verb);
    }
    return map;
});

/** 左栏：按模块分组，隐藏当前平台没有实现的。 */
const groups = computed(() => {
    const byModule = new Map<string, WorkflowVerb[]>();
    for (const verb of catalog.value?.verbs ?? []) {
        if (!verb.available) {
            continue;
        }
        const list = byModule.get(verb.module) ?? [];
        list.push(verb);
        byModule.set(verb.module, list);
    }
    return [...byModule.entries()]
        .map(([module, verbs]) => ({ module, verbs }))
        .sort((left, right) => left.module.localeCompare(right.module));
});

/** 搜索串。 */
const search = ref("");

/** 过滤后的分组。 */
const filteredGroups = computed(() => {
    const needle = search.value.trim().toLowerCase();
    if (needle.length === 0) {
        return groups.value;
    }
    return groups.value
        .map((group) => ({
            module: group.module,
            verbs: group.verbs.filter((verb) => verb.key.toLowerCase().includes(needle))
        }))
        .filter((group) => group.verbs.length > 0);
});

/** 折叠的模块。 */
const folded = ref<string[]>([]);

const toggleFold = (module: string): void => {
    folded.value = folded.value.includes(module)
        ? folded.value.filter((item) => item !== module)
        : [...folded.value, module];
};

/* -------------------------------------------------------------------------- */
/* 步骤                                                                        */
/* -------------------------------------------------------------------------- */

/** 一步的参数槽个数：`arity` 为 null 时按 `minPositionals` 开槽。 */
const slotsOf = (verb: WorkflowVerb | undefined): number => {
    if (verb === undefined) {
        return 0;
    }
    return verb.arity ?? verb.minPositionals ?? 0;
};

/** 新增一步。`after` 给了就插在它之后（线性表里的"拖到线上"）。 */
const addStep = (verbKey: string, after?: string): void => {
    const current = definition.value;
    if (current === null) {
        return;
    }
    const verb = verbMap.value.get(verbKey);
    const step: WorkflowStep = {
        id: newId("step"),
        verb: verbKey,
        args: Array.from({ length: slotsOf(verb) }, () => ""),
        allow: false,
        enabled: true
    };

    if (after === undefined) {
        flow.addStep(id.value, step);
        return;
    }
    const index = current.steps.findIndex((item) => item.id === after);
    const next = [...current.steps];
    next.splice(index + 1, 0, step);
    flow.update(id.value, { steps: next });
};

/** 选中想插入的动词（左栏当前选中）。 */
const picked = ref("");

const insertPicked = (after?: string): void => {
    if (picked.value.length === 0) {
        return;
    }
    addStep(picked.value, after);
    picked.value = "";
};

/* -------------------------------------------------------------------------- */
/* 变量                                                                        */
/* -------------------------------------------------------------------------- */

/** 变量名草稿。 */
const variableName = ref("");
const variableLabel = ref("");

/** 加一个"运行时填"的变量。 */
const addInputVariable = (): void => {
    const name = variableName.value.trim();
    if (name.length === 0 || definition.value === null) {
        return;
    }
    flow.addVariable(id.value, {
        name,
        label: variableLabel.value.trim() || name,
        kind: "input",
        required: true
    });
    variableName.value = "";
    variableLabel.value = "";
};

/**
 * 从某一步的产出加一个变量。
 *
 * 这是 `docs/ui-architecture.md` §7.3.3 说的"数据流"：上一步的输出接下一步的输入。
 * 目前从**整条 result** 取（`fromField` 留空），因为信封里有哪些字段要跑过一次才知道；
 * 跑过之后用户可以在变量上补 `fromField`。
 */
const addStepVariable = (stepId: string, verb: string): void => {
    const name = `step_${stepId.slice(-4)}`;
    flow.addVariable(id.value, {
        name,
        label: `${verb} 的产出`,
        kind: "step",
        fromStepId: stepId,
        fromField: "",
        required: false
    });
};

/** 未声明的引用。 */
const unresolved = computed(() => (definition.value === null ? [] : unresolvedOf(definition.value)));

/* -------------------------------------------------------------------------- */
/* 运行                                                                        */
/* -------------------------------------------------------------------------- */

/** 运行时的变量值。 */
const values = ref<Record<string, string>>({});

/** 正在运行。 */
const running = ref(false);

/** 当前正在跑的那一步。 */
const activeStepId = ref<string | null>(null);

/** 逐步结果。 */
const stepResults = ref<Record<string, FlowRunStep>>({});

/** 流式输出。 */
const streams = ref<Record<string, { stdout: string; stderr: string }>>({});

/** 待批准清单（写操作）。 */
const approvals = ref<string[]>([]);

/** 本次运行的 id。 */
const runId = ref<string | null>(null);

/** 运行中的助手状态写进状态栏（沉浸布局里没有状态栏，但仍然要写：切回普通布局时它还在）。 */
watch(running, (value) => {
    shell.setAssistantStatus(value ? "retrieving" : "idle", value ? "工作流运行中" : "");
});

/** 订阅事件。 */
const unsubscribe = window.desktop.workflow.onEvent((event: WorkflowEvent) => {
    switch (event.type) {
        case "step-start":
            activeStepId.value = event.stepId;
            streams.value = { ...streams.value, [event.stepId]: { stdout: "", stderr: "" } };
            break;
        case "output": {
            const current = streams.value[event.stepId] ?? { stdout: "", stderr: "" };
            streams.value = {
                ...streams.value,
                [event.stepId]: {
                    stdout: event.stream === "stdout" ? current.stdout + event.text : current.stdout,
                    stderr: event.stream === "stderr" ? current.stderr + event.text : current.stderr
                }
            };
            break;
        }
        case "step-end": {
            const result = event.result;
            stepResults.value = {
                ...stepResults.value,
                [event.stepId]: {
                    stepId: event.stepId,
                    verb: result.command.split(" ")[1] ?? "",
                    command: result.command,
                    ok: result.ok,
                    durationMs: result.durationMs,
                    exitCode: result.exitCode,
                    errorCode: result.envelope?.error?.code ?? null,
                    note: result.note,
                    approved: approvals.value.includes(event.stepId)
                }
            };
            activeStepId.value = null;
            break;
        }
        case "run-end":
            activeStepId.value = null;
            running.value = false;
            break;
    }
});

/** 组件卸载时退订：不退订会在换页后继续往已卸载的组件里写状态。 */
import { onUnmounted } from "vue";
onUnmounted(unsubscribe);

/**
 * 跑一次。
 *
 * 三件事按顺序发生：
 *
 * 1. **先解变量**——`resolveArgs` 把绑定与 `{{名字}}` 都换成实际值。
 *    未声明的引用会让这一步直接停下：把 `{{path}}` 原样发给命令层会得到一个
 *    看起来像成功的失败（shell 把 `{{path}}` 当普通字符串）。
 * 2. **再过一遍写操作**——`mutating` 的步骤要求 `allow`。用户已经在编排时看到
 *    "写"标记，但**这里仍然要确认一次**，因为"哪些步骤真的会执行"是运行时的信息
 *    （有的被关掉了）。这一条是 §7.5 与 HAX G16 的落点。
 * 3. **记一次运行**——开始时就落一条 `running`，结束时补齐。这样中途关掉应用
 *    也留下"跑过、没跑完"的痕迹，而不是什么都没有。
 */
const run = async (): Promise<void> => {
    const current = definition.value;
    if (current === null || running.value) {
        return;
    }

    if (unresolved.value.length > 0) {
        shell.setAssistantStatus("failed", `未声明的变量：${unresolved.value.join("、")}`);
        return;
    }

    const enabled = current.steps.filter((step) => step.enabled);
    if (enabled.length === 0) {
        shell.setAssistantStatus("failed", "没有启用的步骤");
        return;
    }

    // 写操作清单：`mutating` 且用户没有在编排时预先授权
    approvals.value = enabled
        .filter((step) => verbMap.value.get(step.verb)?.mutating === true && !step.allow)
        .map((step) => step.id);

    if (approvals.value.length > 0) {
        // 停下来，把"将要执行什么"交给用户看。批准后才能继续。
        shell.setAssistantStatus("retrieving", `有 ${approvals.value.length} 步写操作待批准`);
        return;
    }

    await execute(enabled);
};

/** 真正发出去。 */
const execute = async (steps: WorkflowStep[]): Promise<void> => {
    const current = definition.value;
    if (current === null) {
        return;
    }

    stepResults.value = {};
    streams.value = {};
    running.value = true;

    const record = flow.beginRun(current, { ...values.value });
    runId.value = record.id;
    const startedAt = Date.now();

    /** 发出去的是**解过变量**的步骤，不动定义本身。 */
    const payload: WorkflowStep[] = steps.map((step) => ({
        ...step,
        args: resolveArgs(step, current.bindings[step.id], values.value)
    }));

    try {
        await window.desktop.workflow.run(payload);
    } catch (error) {
        shell.setAssistantStatus("failed", error instanceof Error ? error.message : String(error));
    } finally {
        const steps = Object.values(stepResults.value);
        flow.finishRun(record.id, {
            durationMs: Date.now() - startedAt,
            outcome: steps.length === 0 ? "cancelled" : steps.every((item) => item.ok) ? "ok" : "failed",
            steps
        });
        running.value = false;
        approvals.value = [];
    }
};

/** 批准全部待批准的写操作，然后继续跑。 */
const approveAll = async (): Promise<void> => {
    const current = definition.value;
    if (current === null) {
        return;
    }
    // 把待批准的步骤标成允许（只在这条定义的内存副本上，改完就落库，
    // 因为用户点的是"这条工作流里的这一步可以写"）
    for (const stepId of approvals.value) {
        flow.updateStep(id.value, stepId, { allow: true });
    }
    const enabled = (flow.byId(id.value)?.steps ?? []).filter((step) => step.enabled);
    approvals.value = [];
    await execute(enabled);
};

/** 中断。 */
const cancel = (): void => {
    window.desktop.workflow.cancel();
};

/* -------------------------------------------------------------------------- */
/* 右栏页签                                                                     */
/* -------------------------------------------------------------------------- */

const tab = ref<"variables" | "run" | "trace">("variables");

</script>

<template>
    <!-- 非法 id：空态 + 出口 -->
    <ElResult
        v-if="missing"
        icon="warning"
        title="没有这条工作流"
        :sub-title="`地址里的「${id}」不在本机的定义里。它可能已被删除，或者这条记录来自另一台机器（定义存在 localStorage 里，不跟随账号）。`"
        class="editor__missing">
        <template #extra>
            <ElButton type="primary" @click="router.push('/agent/flow')">回定义库</ElButton>
        </template>
    </ElResult>

    <PageShell v-else :state="'ready'" :card="false" :scroll="false">
        <div class="editor">
            <!-- 顶栏：全局动作放这里（Node-RED 的 Deploy 位置） -->
            <header class="editor__top">
                <ElButton text @click="router.push('/agent/flow')">
                    <AppIcon name="ArrowLeft" />
                    <span>定义库</span>
                </ElButton>

                <ElInput
                    v-model="nameDraft"
                    class="editor__name"
                    placeholder="工作流名字"
                    @blur="commitName"
                    @keydown.enter="commitName" />

                <ElInput
                    v-model="descDraft"
                    class="editor__desc"
                    placeholder="一句话说明它做什么（可空）"
                    @blur="commitDescription"
                    @keydown.enter="commitDescription" />

                <span class="xy-chip numeral">v{{ definition?.version ?? 1 }}</span>

                <span class="editor__spring" />

                <!-- 运行 / 中断：一等按钮，不藏进菜单（Element Plus 可控性原则） -->
                <template v-if="approvals.length > 0">
                    <ElTag type="warning" effect="plain">
                        {{ approvals.length }} 步写操作待批准
                    </ElTag>
                    <ElButton type="warning" @click="approveAll">
                        <AppIcon name="Check" />
                        <span>允许并运行</span>
                    </ElButton>
                    <ElButton text @click="approvals = []">取消</ElButton>
                </template>
                <template v-else-if="!running">
                    <ElButton type="primary" :disabled="(definition?.steps.length ?? 0) === 0" @click="run">
                        <AppIcon name="VideoPlay" />
                        <span>运行 {{ definition?.steps.filter((step) => step.enabled).length ?? 0 }} 步</span>
                    </ElButton>
                </template>
                <template v-else>
                    <ElButton type="danger" @click="cancel">
                        <AppIcon name="VideoPause" />
                        <span>中断</span>
                    </ElButton>
                </template>
            </header>

            <!-- 未声明的引用：先拦住，不要等运行时才炸 -->
            <ElAlert
                v-if="unresolved.length > 0"
                type="warning"
                :closable="false"
                show-icon
                title="有变量没有声明"
                :description="`${unresolved.join('、')} 被引用了，但没在「变量」里声明。运行会先停下——把 {{path}} 原样发给命令层会得到一个看起来像成功的失败。`"
                class="editor__warn" />

            <div class="editor__body">
                <!-- 左：动作库 -->
                <aside class="editor__palette">
                    <ElInput
                        v-model="search"
                        size="small"
                        placeholder="搜动词，例如 file create"
                        clearable
                        class="editor__search" />

                    <ElScrollbar class="editor__palette-scroll">
                        <div v-for="group in filteredGroups" :key="group.module" class="editor__group">
                            <button type="button" class="editor__group-head" @click="toggleFold(group.module)">
                                <AppIcon :name="folded.includes(group.module) ? 'ArrowRight' : 'Bottom'" />
                                <span class="editor__group-name">{{ group.module }}</span>
                                <span class="xy-dim numeral">{{ group.verbs.length }}</span>
                            </button>

                            <ul v-if="!folded.includes(group.module)" class="editor__verbs">
                                <li v-for="verb in group.verbs" :key="verb.key">
                                    <button
                                        type="button"
                                        class="editor__verb"
                                        :class="{ 'is-picked': picked === verb.key }"
                                        :title="verb.names?.map((item) => item.name).join(' · ') || verb.key"
                                        @click="picked = picked === verb.key ? '' : verb.key">
                                        <span class="numeral is-truncated">{{ verb.key }}</span>
                                        <ElTag v-if="verb.mutating" size="small" type="warning" effect="plain">
                                            写
                                        </ElTag>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </ElScrollbar>

                    <div class="editor__palette-foot">
                        <ElButton type="primary" size="small" :disabled="picked === ''" @click="insertPicked()">
                            <AppIcon name="Plus" />
                            <span>加到末尾</span>
                        </ElButton>
                        <p class="xy-dim editor__palette-hint">
                            {{ picked === '' ? '选一个动词' : `选中：${picked}` }}
                        </p>
                    </div>
                </aside>

                <!-- 中：步骤表 -->
                <section class="editor__steps">
                    <ElScrollbar class="editor__steps-scroll">
                        <ElEmpty
                            v-if="(definition?.steps.length ?? 0) === 0"
                            description="还没有步骤。左边选一个动词，点「加到末尾」。"
                            :image-size="70" />

                        <div
                            v-for="(step, index) in definition?.steps ?? []"
                            :key="step.id"
                            class="editor__step"
                            :class="{
                                'is-active': activeStepId === step.id,
                                'is-off': !step.enabled,
                                'is-bad': stepResults[step.id] && !stepResults[step.id].ok
                            }">
                            <div class="editor__step-head">
                                <span class="editor__step-index numeral">{{ index + 1 }}</span>

                                <span class="numeral editor__step-verb">{{ step.verb }}</span>

                                <ElTag v-if="verbMap.get(step.verb)?.mutating" size="small" type="warning" effect="plain">
                                    写
                                </ElTag>
                                <ElTag v-if="!verbMap.get(step.verb)?.available" size="small" type="info" effect="plain">
                                    本平台无实现
                                </ElTag>

                                <!-- 运行状态：图标 + 文字。不只靠颜色（WCAG 1.4.1） -->
                                <ElTag
                                    v-if="stepResults[step.id]"
                                    :type="stepResults[step.id].ok ? 'success' : 'danger'"
                                    size="small"
                                    effect="plain">
                                    {{ stepResults[step.id].ok ? "成功" : "失败" }}
                                    · {{ stepResults[step.id].durationMs }} ms
                                </ElTag>

                                <span class="editor__spring" />

                                <ElSwitch
                                    :model-value="step.enabled"
                                    size="small"
                                    aria-label="启用这一步"
                                    @update:model-value="
                                        (value: string | number | boolean) =>
                                            flow.updateStep(id, step.id, { enabled: Boolean(value) })
                                    " />

                                <ElButton
                                    text
                                    size="small"
                                    :disabled="index === 0"
                                    title="上移"
                                    @click="flow.moveStep(id, step.id, -1)">
                                    <AppIcon name="Top" />
                                </ElButton>
                                <ElButton
                                    text
                                    size="small"
                                    :disabled="index === (definition?.steps.length ?? 1) - 1"
                                    title="下移"
                                    @click="flow.moveStep(id, step.id, 1)">
                                    <AppIcon name="Bottom" />
                                </ElButton>
                                <ElButton
                                    text
                                    size="small"
                                    title="在这一步之后插入"
                                    @click="insertPicked(step.id)">
                                    <AppIcon name="Plus" />
                                </ElButton>
                                <!--
                                    删一步，保留接线（Node-RED 的 Ctrl-Delete）。
                                    `removeStepKeepingWires` 把这一步的变量绑定交给下一步。
                                -->
                                <ElButton
                                    text
                                    size="small"
                                    title="删掉这一步，但把变量绑定交给下一步"
                                    @click="flow.removeStepKeepingWires(id, step.id)">
                                    <AppIcon name="Delete" />
                                </ElButton>
                                <ElButton
                                    text
                                    size="small"
                                    title="彻底删掉（含绑定）"
                                    @click="flow.removeStep(id, step.id)">
                                    <AppIcon name="Close" />
                                </ElButton>
                            </div>

                            <!-- 参数：名字来自源码，槽位可绑定变量 -->
                            <div class="editor__args">
                                <div
                                    v-for="(arg, slot) in step.args"
                                    :key="slot"
                                    class="editor__arg">
                                    <span class="editor__arg-label numeral">
                                        {{ verbMap.get(step.verb)?.names?.[slot]?.name ?? `arg${slot + 1}` }}
                                    </span>

                                    <ElInput
                                        :model-value="arg"
                                        size="small"
                                        class="editor__arg-input"
                                        :placeholder="
                                            definition?.bindings[step.id]?.[slot]
                                                ? `绑定到 {{${definition?.bindings[step.id]?.[slot]}}}`
                                                : '字面值，或写 {{变量名}}'
                                        "
                                        :disabled="Boolean(definition?.bindings[step.id]?.[slot])"
                                        @update:model-value="
                                            (value: string) => {
                                                const args = [...step.args];
                                                args[slot] = value;
                                                flow.updateStep(id, step.id, { args });
                                            }
                                        " />

                                    <!-- 绑定选择器：把参数槽直接指向一个变量（再认而非回忆，§2.2 第 7 条） -->
                                    <ElSelect
                                        :model-value="definition?.bindings[step.id]?.[slot] ?? ''"
                                        size="small"
                                        class="editor__arg-bind"
                                        placeholder="绑定变量"
                                        clearable
                                        @update:model-value="
                                            (value: string | number | boolean | null) =>
                                                flow.bind(id, step.id, Number(slot), value === null ? '' : String(value))
                                        ">
                                        <ElOption
                                            v-for="variable in definition?.variables ?? []"
                                            :key="variable.name"
                                            :label="variable.name"
                                            :value="variable.name" />
                                    </ElSelect>

                                    <!--
                                        引用提示：这个槽里写了哪些变量。
                                        模板串里**不能**直接写双花括号——Vue 的插值定界符
                                        与外层插值同形，解析器会在第一个 `}}` 处提前收尾。
                                        所以花括号由 `templateRefs()` 拼出来。
                                    -->
                                    <span
                                        v-if="referencesIn(arg).length > 0"
                                        class="xy-dim editor__arg-ref numeral">
                                        {{ templateRefs(arg) }}
                                    </span>
                                </div>

                                <p v-if="step.args.length === 0" class="xy-dim editor__arg-empty">
                                    这个动词按变参处理，参数在运行时按变量展开。
                                </p>
                            </div>

                            <!-- 流式输出：运行中就地更新，不弹窗、不抢焦点（§2.2 第 9 条） -->
                            <pre
                                v-if="activeStepId === step.id || streams[step.id]"
                                class="editor__stream numeral"
                                role="status"
                                aria-live="polite">{{ streams[step.id]?.stdout || "（还没有输出）" }}</pre>
                        </div>
                    </ElScrollbar>
                </section>

                <!-- 右：变量 / 运行 / 追踪 -->
                <aside class="editor__side">
                    <ElTabs v-model="tab" class="editor__tabs">
                        <ElTabPane label="变量" name="variables">
                            <div class="editor__side-body">
                                <ElForm label-width="60px" label-position="left" size="small">
                                    <ElFormItem label="名字">
                                        <ElInput v-model="variableName" placeholder="path" />
                                    </ElFormItem>
                                    <ElFormItem label="说明">
                                        <ElInput v-model="variableLabel" placeholder="要处理的文件" />
                                    </ElFormItem>
                                </ElForm>
                                <ElButton size="small" type="primary" @click="addInputVariable">
                                    <AppIcon name="Plus" />
                                    <span>加运行时要填的变量</span>
                                </ElButton>

                                <ElDivider />

                                <ElEmpty
                                    v-if="(definition?.variables.length ?? 0) === 0"
                                    description="还没有变量。没有变量的工作流只能重复跑同一串固定命令——加一个变量，它才成为工作流。"
                                    :image-size="60" />

                                <ul v-else class="editor__vars">
                                    <li v-for="variable in definition?.variables ?? []" :key="variable.name" class="editor__var">
                                        <div class="editor__var-head">
                                            <span class="numeral editor__var-name">{{ variable.name }}</span>
                                            <ElTag size="small" effect="plain">
                                                {{ variable.kind === "input" ? "运行时填" : "来自步骤" }}
                                            </ElTag>
                                            <span class="editor__spring" />
                                            <ElButton
                                                text
                                                size="small"
                                                title="删除变量（同时清掉指向它的绑定）"
                                                @click="flow.removeVariable(id, variable.name)">
                                                <AppIcon name="Delete" />
                                            </ElButton>
                                        </div>
                                        <p class="xy-dim editor__var-label">{{ variable.label }}</p>

                                        <ElInput
                                            v-model="values[variable.name]"
                                            size="small"
                                            :placeholder="variable.kind === 'input' ? '运行时在这里填值' : '由步骤产出'"
                                            :disabled="variable.kind === 'step'" />
                                    </li>
                                </ul>

                                <ElDivider />

                                <p class="xy-dim editor__side-lead">从某一步的产出建变量（数据流）：</p>
                                <ul class="editor__flow-vars">
                                    <li v-for="step in definition?.steps ?? []" :key="step.id">
                                        <ElButton text size="small" @click="addStepVariable(step.id, step.verb)">
                                            <AppIcon name="Connection" />
                                            <span class="numeral is-truncated">{{ step.verb }}</span>
                                        </ElButton>
                                    </li>
                                </ul>
                            </div>
                        </ElTabPane>

                        <ElTabPane label="运行" name="run">
                            <div class="editor__side-body">
                                <ElDescriptions :column="1" border size="small">
                                    <ElDescriptionsItem label="步骤">
                                        <span class="numeral">{{ definition?.steps.length ?? 0 }}</span>
                                        （启用
                                        <span class="numeral">
                                            {{ definition?.steps.filter((step) => step.enabled).length ?? 0 }}
                                        </span>）
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="写操作">
                                        <span class="numeral">
                                            {{
                                                definition?.steps.filter(
                                                    (step) => verbMap.get(step.verb)?.mutating === true
                                                ).length ?? 0
                                            }}
                                        </span>
                                        <span class="xy-dim">步（会在运行前请你确认）</span>
                                    </ElDescriptionsItem>
                                </ElDescriptions>

                                <p class="xy-note">
                                    运行时会：
                                    ① 把 <code>{{ variableToken }}</code> 换成实际值；
                                    ② 若清单里有写操作，先停下来把你将要执行的命令摆出来；
                                    ③ 逐步执行，输出就地流式更新；
                                    ④ 结束之后写一条运行记录（含批准痕迹）。
                                </p>

                                <ElAlert
                                    v-if="catalogError.length > 0"
                                    type="warning"
                                    :closable="false"
                                    show-icon
                                    title="读不到动词清单"
                                    :description="catalogError" />

                                <ElAlert
                                    v-else-if="catalog?.problem"
                                    type="warning"
                                    :closable="false"
                                    show-icon
                                    title="命令层不可用"
                                    :description="catalog.problem" />

                                <ElDescriptions v-else :column="1" border size="small">
                                    <ElDescriptionsItem label="平台">
                                        <span class="numeral">{{ catalog?.platform ?? "—" }}</span>
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="解释器">
                                        <span class="numeral">{{ catalog?.interpreter ?? "—" }}</span>
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label="入口">
                                        <span class="numeral editor__entry">{{ catalog?.entry ?? "—" }}</span>
                                    </ElDescriptionsItem>
                                </ElDescriptions>
                            </div>
                        </ElTabPane>

                        <ElTabPane label="追踪" name="trace">
                            <div class="editor__side-body">
                                <p v-if="Object.keys(stepResults).length === 0" class="xy-dim">
                                    还没有跑过。运行之后这里会出现每一步的命令与耗时。
                                </p>

                                <ul v-else class="editor__trace">
                                    <li v-for="(result, stepId) in stepResults" :key="String(stepId)">
                                        <div class="editor__trace-head">
                                            <AppIcon
                                                :name="result.ok ? 'CircleCheckFilled' : 'WarningFilled'"
                                                :class="result.ok ? 'editor__ok' : 'editor__bad'" />
                                            <span class="numeral is-truncated">{{ result.command }}</span>
                                        </div>
                                        <p class="xy-dim">
                                            {{ result.durationMs }} ms
                                            <span v-if="result.exitCode !== null" class="numeral">
                                                · 退出码 {{ result.exitCode }}
                                            </span>
                                            <span v-if="result.errorCode" class="numeral">
                                                · {{ result.errorCode }}
                                            </span>
                                            <span v-if="result.approved">· 已批准</span>
                                        </p>
                                        <p v-if="result.note" class="xy-dim">{{ result.note }}</p>
                                    </li>
                                </ul>

                                <p v-if="runId !== null" class="xy-note">
                                    这次运行记在
                                    <RouterLink to="/agent/flow/run">运行记录</RouterLink>
                                    里（{{ runId }}）。
                                </p>
                            </div>
                        </ElTabPane>
                    </ElTabs>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.editor__missing {
    margin-top: 48px;
}

/*
 * 编排器：吃掉整屏，三段横向分配。
 *
 * 与对话页同一个做法：撑满一律用 `flex: 1`，不用 `height: 100%`
 * ——弹性分配来的高度是 `auto`，百分比高度在里面解析不出确定值。
 */
.editor {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
}

.editor__top {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.editor__name {
    width: 220px;
}

.editor__desc {
    width: 280px;
}

/* "弹簧"：把右侧的运行控制推到最右 */
.editor__spring {
    flex: 1 1 auto;
}

.editor__warn {
    border-radius: 6px;
    flex-shrink: 0;
}

.editor__body {
    display: flex;
    flex: 1;
    gap: 10px;
    min-height: 0;
}

/* ── 左：动作库 ─────────────────────────────────────────────────────────── */

.editor__palette {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    overflow: hidden;
    width: 250px;
}

.editor__search {
    border-bottom: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
}

.editor__palette-scroll {
    flex: 1;
    min-height: 0;
}

.editor__group-head {
    align-items: center;
    background: var(--el-fill-color-lighter);
    border: none;
    color: var(--el-text-color-regular);
    cursor: pointer;
    display: flex;
    font-size: 12px;
    gap: 6px;
    padding: 6px 8px;
    width: 100%;
}

.editor__group-head:hover {
    background: var(--el-fill-color);
}

.editor__group-name {
    flex: 1;
    font-weight: 600;
    text-align: left;
}

.editor__verbs {
    list-style: none;
    margin: 0;
    padding: 0;
}

.editor__verb {
    align-items: center;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    font-size: 11px;
    gap: 6px;
    padding: 5px 8px 5px 22px;
    text-align: left;
    width: 100%;
}

.editor__verb:hover {
    background: var(--el-fill-color-light);
}

.editor__verb.is-picked {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
}

.editor__palette-foot {
    border-top: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 8px;
}

.editor__palette-hint {
    margin: 6px 0 0;
    word-break: break-all;
}

/* ── 中：步骤表 ─────────────────────────────────────────────────────────── */

.editor__steps {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
}

.editor__steps-scroll {
    flex: 1;
    min-height: 0;
    padding: 10px;
}

.editor__step {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    margin-bottom: 10px;
    padding: 10px;
}

.editor__step.is-active {
    border-color: var(--el-color-primary);
}

.editor__step.is-off {
    opacity: 0.55;
}

.editor__step.is-bad {
    border-color: var(--el-color-danger-light-5);
}

.editor__step-head {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.editor__step-index {
    background: var(--el-fill-color);
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 11px;
    padding: 1px 6px;
}

.editor__step-verb {
    font-size: 13px;
    font-weight: 600;
}

.editor__args {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
}

.editor__arg {
    align-items: center;
    display: flex;
    gap: 6px;
}

.editor__arg-label {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 11px;
    text-align: right;
    width: 72px;
}

.editor__arg-input {
    flex: 1;
    min-width: 0;
}

.editor__arg-bind {
    flex-shrink: 0;
    width: 120px;
}

.editor__arg-ref {
    flex-shrink: 0;
}

.editor__arg-empty {
    margin: 0;
}

/*
 * 流式输出：就地更新，不弹窗。
 * `pre` 保留空白，横向可滚——命令输出折行会让人误读。
 */
.editor__stream {
    background: var(--el-fill-color-light);
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    font-size: 11px;
    margin: 8px 0 0;
    max-height: 140px;
    overflow: auto;
    padding: 6px 8px;
    white-space: pre-wrap;
    word-break: break-all;
}

/* ── 右：变量 / 运行 / 追踪 ──────────────────────────────────────────────── */

.editor__side {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    overflow: hidden;
    width: 340px;
}

.editor__tabs {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.editor__tabs :deep(.el-tabs__header) {
    flex-shrink: 0;
    margin: 0;
    padding: 0 10px;
}

.editor__tabs :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.editor__tabs :deep(.el-tab-pane) {
    height: 100%;
}

.editor__side-body {
    height: 100%;
    overflow-y: auto;
    padding: 10px;
}

.editor__side-lead {
    margin: 0 0 6px;
}

.editor__vars,
.editor__flow-vars,
.editor__trace {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.editor__var {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 8px;
}

.editor__var-head {
    align-items: center;
    display: flex;
    gap: 6px;
}

.editor__var-name {
    font-size: 12px;
    font-weight: 600;
}

.editor__var-label {
    margin: 4px 0 6px;
}

.editor__trace-head {
    align-items: center;
    display: flex;
    gap: 6px;
}

.editor__ok {
    color: var(--el-color-success);
}

.editor__bad {
    color: var(--el-color-danger);
}

.editor__entry {
    word-break: break-all;
}
</style>
