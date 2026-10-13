/**
 * 工作流 store：定义、变量、运行记录。
 *
 * ## 它替页面解决了什么
 *
 * 三个页面（定义库 / 编排器 / 运行记录）读的是**同一份东西**：
 *
 * - 定义库列出全部定义的名称、步骤数、上次运行；
 * - 编排器编辑其中一条，跑它；
 * - 运行记录按定义过滤运行历史。
 *
 * 状态放页面里的话，从编排器跳回定义库就丢了；而"改完保存、回去看列表"
 * 是最基本的动作。所以归 store。
 *
 * ## 为什么不并进 `src/state/use-workflow.ts`
 *
 * 那个 composable 是**一次运行的状态**（正在跑哪一步、流式输出到哪、
 * 上一次运行的结果）。它的生命周期跟着页面走，而定义要与应用同寿。
 * 两者混在一起会出现"换页把定义也丢了"。
 *
 * 所以分工是：
 *
 * | 谁                              | 管什么                       |
 * | ------------------------------- | ---------------------------- |
 * | `store/flow.store.ts`（本文件） | 定义、变量、运行记录（持久）  |
 * | `state/use-workflow.ts`         | 一次运行的进行时状态（临时）  |
 * | `main/workflow.ts`              | 真正 spawn 与信封解析         |
 *
 * ## 持久化
 *
 * `localStorage`。与 `use-workflow.ts` 的旧 key 分开（`calendar.flow.definitions.v1`），
 * 所以用户已有的那条步骤表不会被覆盖——它在第一次打开编排器时可以一键导入成
 * 一条新定义。
 */

import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import type { WorkflowStep } from "../../shared/workflow-api";
import type { FlowRun, FlowRunStep, WorkflowDefinition, WorkflowVariable } from "../entity/workflow";
import {
    FlowRunKeep,
    FlowRunStorageKey,
    FlowStorageKey,
    createDefinition,
    newId
} from "../entity/workflow";

/* -------------------------------------------------------------------------- */
/* 读写                                                                        */
/* -------------------------------------------------------------------------- */

/** 读定义；坏数据一律丢掉，不让页面上出现半截状态。 */
const loadDefinitions = (): WorkflowDefinition[] => {
    try {
        const raw = localStorage.getItem(FlowStorageKey);
        if (raw === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(
            (item): item is WorkflowDefinition =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as WorkflowDefinition).id === "string" &&
                typeof (item as WorkflowDefinition).name === "string" &&
                Array.isArray((item as WorkflowDefinition).steps)
        );
    } catch {
        return [];
    }
};

/** 读运行记录。 */
const loadRuns = (): FlowRun[] => {
    try {
        const raw = localStorage.getItem(FlowRunStorageKey);
        if (raw === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as FlowRun[]) : [];
    } catch {
        return [];
    }
};

/** 旧版的单条步骤表：`use-workflow.ts` 的 key。用于"导入旧步骤"。 */
const LegacyStepsKey = "calendar.workflow.steps.v1";

/** 读旧步骤。 */
const loadLegacySteps = (): WorkflowStep[] => {
    try {
        const raw = localStorage.getItem(LegacyStepsKey);
        if (raw === null) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(
            (item): item is WorkflowStep =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as WorkflowStep).id === "string" &&
                typeof (item as WorkflowStep).verb === "string" &&
                Array.isArray((item as WorkflowStep).args)
        );
    } catch {
        return [];
    }
};

/* -------------------------------------------------------------------------- */
/* store                                                                       */
/* -------------------------------------------------------------------------- */

export const useFlowStore = defineStore("flow", () => {
    /** 全部定义。 */
    const definitions = ref<WorkflowDefinition[]>(loadDefinitions());

    /** 运行记录，最新的在前。 */
    const runs = ref<FlowRun[]>(loadRuns());

    /* ── 落盘 ─────────────────────────────────────────────────────────────── */

    watch(
        definitions,
        (value) => {
            try {
                localStorage.setItem(FlowStorageKey, JSON.stringify(value));
            } catch {
                // 存不下（配额、隐私模式）不该影响正在编辑的内容
            }
        },
        { deep: true }
    );

    watch(
        runs,
        (value) => {
            try {
                localStorage.setItem(FlowRunStorageKey, JSON.stringify(value.slice(0, FlowRunKeep)));
            } catch {
                // 同上
            }
        },
        { deep: true }
    );

    /* ── 查询 ─────────────────────────────────────────────────────────────── */

    /** 按 id 取定义。 */
    const byId = (id: string): WorkflowDefinition | null =>
        definitions.value.find((item) => item.id === id) ?? null;

    /** 按最近修改排序的定义。 */
    const ordered = computed(() =>
        [...definitions.value].sort((left, right) => right.updatedAt - left.updatedAt)
    );

    /** 某条定义的运行记录（最新在前）。 */
    const runsOf = (definitionId: string): FlowRun[] =>
        runs.value.filter((item) => item.definitionId === definitionId);

    /** 某条定义的上一次运行。 */
    const lastRunOf = (definitionId: string): FlowRun | null =>
        runsOf(definitionId)[0] ?? null;

    /* ── 定义 ─────────────────────────────────────────────────────────────── */

    /** 新建一条定义；返回它。 */
    const create = (name?: string): WorkflowDefinition => {
        const definition = createDefinition(name);
        definitions.value = [...definitions.value, definition];
        return definition;
    };

    /** 改一条定义。`patch` 里的字段会被合并，`version` 自动 +1。 */
    const update = (id: string, patch: Partial<Omit<WorkflowDefinition, "id">>): void => {
        definitions.value = definitions.value.map((item) =>
            item.id === id
                ? { ...item, ...patch, version: patch.version ?? item.version + 1, updatedAt: Date.now() }
                : item
        );
    };

    /** 删除一条定义；它的运行记录一并删掉（否则运行记录里会出现孤儿引用）。 */
    const remove = (id: string): void => {
        definitions.value = definitions.value.filter((item) => item.id !== id);
        runs.value = runs.value.filter((item) => item.definitionId !== id);
    };

    /** 复制一条定义。名字加"副本"，步骤与变量照抄——这是最常见的起点。 */
    const duplicate = (id: string): WorkflowDefinition | null => {
        const source = byId(id);
        if (source === null) {
            return null;
        }
        const copy: WorkflowDefinition = {
            ...source,
            id: newId("flow"),
            name: `${source.name} 副本`,
            version: 1,
            // 步骤 id 要重新生成：否则两条定义的步骤 id 相同，
            // 而 `bindings` 是按步骤 id 索引的，复制后会串到一起
            steps: source.steps.map((step) => ({ ...step, id: newId("step") })),
            bindings: {},
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        definitions.value = [...definitions.value, copy];
        return copy;
    };

    /* ── 步骤 ─────────────────────────────────────────────────────────────── */

    /** 加一步。 */
    const addStep = (id: string, step: WorkflowStep): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        update(id, { steps: [...definition.steps, step] });
    };

    /** 改一步。 */
    const updateStep = (id: string, stepId: string, patch: Partial<Omit<WorkflowStep, "id">>): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        update(id, {
            steps: definition.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
        });
    };

    /** 删一步；同时丢掉它的绑定（否则 `bindings` 里会留下指向不存在步骤的键）。 */
    const removeStep = (id: string, stepId: string): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        const bindings = { ...definition.bindings };
        delete bindings[stepId];
        update(id, { steps: definition.steps.filter((step) => step.id !== stepId), bindings });
    };

    /**
     * 删一步但**保留接线**。
     *
     * 照 Node-RED 的 `Ctrl/⌘-Delete`（"Delete Node, keep wires"，
     * `docs/ui-architecture.md` §2.3 第 10 条，已核实）。在一条线性步骤表里，
     * 它的等价物是"把这一步的绑定交给下一步"——这样删掉中间一步不会让后面的
     * 引用全部悬空。
     */
    const removeStepKeepingWires = (id: string, stepId: string): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        const index = definition.steps.findIndex((step) => step.id === stepId);
        if (index < 0) {
            return;
        }
        const next = definition.steps[index + 1];
        const bindings = { ...definition.bindings };
        const dropped = bindings[stepId];
        delete bindings[stepId];
        if (next !== undefined && dropped !== undefined) {
            bindings[next.id] = { ...dropped, ...(bindings[next.id] ?? {}) };
        }
        update(id, { steps: definition.steps.filter((step) => step.id !== stepId), bindings });
    };

    /** 上移 / 下移一步。 */
    const moveStep = (id: string, stepId: string, delta: number): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        const steps = [...definition.steps];
        const index = steps.findIndex((step) => step.id === stepId);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= steps.length) {
            return;
        }
        [steps[index], steps[target]] = [steps[target], steps[index]];
        update(id, { steps });
    };

    /* ── 变量 ─────────────────────────────────────────────────────────────── */

    /** 加一个变量。 */
    const addVariable = (id: string, variable: WorkflowVariable): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        update(id, { variables: [...definition.variables, variable] });
    };

    /** 改一个变量。 */
    const updateVariable = (id: string, name: string, patch: Partial<WorkflowVariable>): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        update(id, {
            variables: definition.variables.map((item) =>
                item.name === name ? { ...item, ...patch } : item
            )
        });
    };

    /**
     * 删一个变量。
     *
     * 同时清掉指向它的绑定与就地引用——留着会让"参数槽指向一个不存在的变量"，
     * 而那种错在运行时才暴露。
     */
    const removeVariable = (id: string, name: string): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        const bindings: WorkflowDefinition["bindings"] = {};
        for (const [stepId, binding] of Object.entries(definition.bindings)) {
            const kept: Record<number, string> = {};
            for (const [slot, target] of Object.entries(binding)) {
                if (target !== name) {
                    kept[Number(slot)] = target;
                }
            }
            bindings[stepId] = kept;
        }
        update(id, {
            variables: definition.variables.filter((item) => item.name !== name),
            bindings,
            steps: definition.steps.map((step) => ({
                ...step,
                args: step.args.map((arg) => arg.replace(new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, "g"), ""))
            }))
        });
    };

    /** 设一个绑定：步骤的某个参数槽指向某个变量。 */
    const bind = (id: string, stepId: string, slot: number, variable: string): void => {
        const definition = byId(id);
        if (definition === null) {
            return;
        }
        const current = { ...(definition.bindings[stepId] ?? {}) };
        if (variable === "") {
            delete current[slot];
        } else {
            current[slot] = variable;
        }
        update(id, { bindings: { ...definition.bindings, [stepId]: current } });
    };

    /* ── 运行记录 ─────────────────────────────────────────────────────────── */

    /** 记一次运行；返回它。 */
    const record = (run: FlowRun): FlowRun => {
        runs.value = [run, ...runs.value].slice(0, FlowRunKeep);
        return run;
    };

    /** 新建一条运行记录（开始时调用，结束时补齐）。 */
    const beginRun = (definition: WorkflowDefinition, values: Record<string, string>): FlowRun => {
        const run: FlowRun = {
            id: newId("run"),
            definitionId: definition.id,
            definitionName: definition.name,
            definitionVersion: definition.version,
            startedAt: Date.now(),
            durationMs: 0,
            outcome: "running",
            steps: [],
            values
        };
        return record(run);
    };

    /** 补齐一次运行。 */
    const finishRun = (
        runId: string,
        patch: { durationMs: number; outcome: FlowRun["outcome"]; steps: FlowRunStep[] }
    ): void => {
        runs.value = runs.value.map((item) => (item.id === runId ? { ...item, ...patch } : item));
    };

    /** 清空运行记录。 */
    const clearRuns = (): void => {
        runs.value = [];
    };

    /* ── 迁移 ─────────────────────────────────────────────────────────────── */

    /** 旧版单条步骤表里有没有东西。 */
    const hasLegacy = computed(() => loadLegacySteps().length > 0);

    /**
     * 把旧版的步骤表导入成一条新定义。
     *
     * 这是"旧数据不丢"的唯一入口。导入之后**不删**旧 key：
     * 用户可能还想对照一下，而那个 key 只占几 KB。
     */
    const importLegacy = (): WorkflowDefinition | null => {
        const steps = loadLegacySteps();
        if (steps.length === 0) {
            return null;
        }
        const definition = createDefinition("导入的工作流");
        definition.description = `从旧版步骤表导入（${steps.length} 步）`;
        definition.steps = steps;
        definitions.value = [...definitions.value, definition];
        return definition;
    };

    return {
        definitions,
        runs,
        ordered,
        byId,
        runsOf,
        lastRunOf,
        create,
        update,
        remove,
        duplicate,
        addStep,
        updateStep,
        removeStep,
        removeStepKeepingWires,
        moveStep,
        addVariable,
        updateVariable,
        removeVariable,
        bind,
        record,
        beginRun,
        finishRun,
        clearRuns,
        hasLegacy,
        importLegacy
    };
});

/** 页面把这份状态透传给子组件时用的类型。 */
export type FlowStore = ReturnType<typeof useFlowStore>;
