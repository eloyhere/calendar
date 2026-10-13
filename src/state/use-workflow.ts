import { computed, onUnmounted, ref, watch } from "vue";

import { WORKFLOW_ARGS_MAX } from "../../shared/workflow-api";
import type {
    WorkflowCatalog,
    WorkflowEvent,
    WorkflowRunResult,
    WorkflowStep,
    WorkflowStepResult,
    WorkflowVerb
} from "../../shared/workflow-api";

/**
 * 工作流页的状态。
 *
 * ## 边界
 *
 * 本文件只管"编排与展示"：步骤的增删改、选中、持久化，以及把主进程推来的运行事件
 * 归位。真正的执行在 `main/workflow.ts`，本文件通过 `window.desktop.workflow`
 * 调用它，不碰 Node 能力。
 *
 * ## 为什么步骤存 localStorage
 *
 * 工作流是用户手编的东西，重启应用还得在。存的是 `WorkflowStep[]` 本身（纯数据、
 * 无函数），所以可以直接 `JSON.stringify`。用 `app://` 装载之后页面有正常来源，
 * localStorage 是可用的——这一条依赖 `main/window.ts` 的自定义协议，换成
 * `file://` 就会退化。
 *
 * ## 为什么清单里查不到的步骤会被丢掉
 *
 * 动词清单是从模块源码静态提取的，模块一变（改名、增删动词）旧步骤就可能指向一个
 * 不存在的动词。加载时就按当前清单过滤，比留着一个点了必然失败的步骤好。
 */

const STORAGE_KEY = "calendar.workflow.steps.v1";

/** 生成步骤 id：只需要在本地下独一无二，不参与任何协议。 */
let sequence = 0;
const nextId = (): string => {
    sequence += 1;
    return `step-${Date.now().toString(36)}-${sequence}`;
};

/** 一个模块下的动词分组，给左栏的动作库用。 */
export interface WorkflowVerbGroup {
    module: string;
    verbs: WorkflowVerb[];
}

/** 运行中/运行后每个步骤的原始输出。 */
export interface WorkflowStream {
    stdout: string;
    stderr: string;
}

/** 读回持久化的步骤；坏数据一律当作没有，不让页面上出现半截状态。 */
const loadSteps = (): WorkflowStep[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter((item): item is WorkflowStep => {
                if (typeof item !== "object" || item === null) {
                    return false;
                }
                const step = item as Record<string, unknown>;
                return (
                    typeof step.id === "string" &&
                    typeof step.verb === "string" &&
                    Array.isArray(step.args) &&
                    step.args.every((arg) => typeof arg === "string")
                );
            })
            .map((step) => ({
                id: step.id,
                verb: step.verb,
                args: step.args,
                allow: step.allow === true,
                enabled: step.enabled !== false
            }));
    } catch {
        return [];
    }
};

export const useWorkflow = () => {
    const catalog = ref<WorkflowCatalog | null>(null);
    const loading = ref(true);
    /** 取清单失败时的说明（IPC 本身出错，与 catalog.problem 是两件事） */
    const loadError = ref("");

    const steps = ref<WorkflowStep[]>([]);
    const selectedId = ref<string | null>(null);

    const running = ref(false);
    const activeStepId = ref<string | null>(null);
    const results = ref<Record<string, WorkflowStepResult>>({});
    const streams = ref<Record<string, WorkflowStream>>({});
    const lastRun = ref<WorkflowRunResult | null>(null);

    /** 动词键 → 清单条目，供界面查 arity / mutating / available。 */
    const verbMap = computed(() => {
        const map = new Map<string, WorkflowVerb>();
        for (const verb of catalog.value?.verbs ?? []) {
            map.set(verb.key, verb);
        }
        return map;
    });

    /** 动作库：按模块分组，当前平台没有实现的动词不进列表。 */
    const groups = computed<WorkflowVerbGroup[]>(() => {
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
            .sort((a, b) => a.module.localeCompare(b.module));
    });

    /** 可执行的环境就绪：有清单、没有 problem、动词非空。 */
    const ready = computed(
        () => catalog.value !== null && catalog.value.problem === null && catalog.value.verbs.length > 0
    );

    const selected = computed(() => steps.value.find((step) => step.id === selectedId.value) ?? null);

    /** 当前选中的动词条目。 */
    const selectedVerb = computed<WorkflowVerb | null>(() => {
        const step = selected.value;
        return step ? (verbMap.value.get(step.verb) ?? null) : null;
    });

    /** 有几步会在这次运行里真正执行。 */
    const enabledCount = computed(() => steps.value.filter((step) => step.enabled).length);

    /* ---------------------------------------------------------------------- */
    /* 运行事件                                                                */
    /* ---------------------------------------------------------------------- */

    const handleEvent = (event: WorkflowEvent): void => {
        switch (event.type) {
            case "step-start":
                activeStepId.value = event.stepId;
                streams.value = {
                    ...streams.value,
                    [event.stepId]: { stdout: "", stderr: "" }
                };
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
            case "step-end":
                results.value = { ...results.value, [event.stepId]: event.result };
                activeStepId.value = null;
                break;
            case "run-end":
                activeStepId.value = null;
                running.value = false;
                lastRun.value = event.result;
                break;
        }
    };

    const unsubscribe = window.desktop.workflow.onEvent(handleEvent);
    onUnmounted(unsubscribe);

    /* ---------------------------------------------------------------------- */
    /* 步骤编辑                                                                */
    /* ---------------------------------------------------------------------- */

    /** 按动词声明的参数个数开好输入槽；个数不固定（`arity === null`）时留空。 */
    const blankArgs = (verb: WorkflowVerb | null): string[] =>
        verb && verb.arity !== null ? Array.from({ length: verb.arity }, () => "") : [];

    const addStep = (verbKey: string): void => {
        const step: WorkflowStep = {
            id: nextId(),
            verb: verbKey,
            args: blankArgs(verbMap.value.get(verbKey) ?? null),
            allow: false,
            enabled: true
        };
        steps.value = [...steps.value, step];
        selectedId.value = step.id;
    };

    const removeStep = (id: string): void => {
        steps.value = steps.value.filter((step) => step.id !== id);
        if (selectedId.value === id) {
            selectedId.value = steps.value[0]?.id ?? null;
        }
    };

    /** 上移 / 下移一格。顺序就是执行顺序，所以要能调。 */
    const moveStep = (id: string, delta: number): void => {
        const index = steps.value.findIndex((step) => step.id === id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= steps.value.length) {
            return;
        }
        const next = [...steps.value];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        steps.value = next;
    };

    const updateStep = (id: string, patch: Partial<Omit<WorkflowStep, "id">>): void => {
        steps.value = steps.value.map((step) => (step.id === id ? { ...step, ...patch } : step));
    };

    const setArg = (id: string, index: number, value: string): void => {
        const step = steps.value.find((item) => item.id === id);
        if (!step) {
            return;
        }
        const args = [...step.args];
        args[index] = value;
        updateStep(id, { args });
    };

    /** 参数个数不固定的动词：自己加一槽。 */
    const appendArg = (id: string): void => {
        const step = steps.value.find((item) => item.id === id);
        if (!step || step.args.length >= WORKFLOW_ARGS_MAX) {
            return;
        }
        updateStep(id, { args: [...step.args, ""] });
    };

    const dropArg = (id: string, index: number): void => {
        const step = steps.value.find((item) => item.id === id);
        if (!step) {
            return;
        }
        updateStep(id, { args: step.args.filter((_value, at) => at !== index) });
    };

    const clearSteps = (): void => {
        steps.value = [];
        selectedId.value = null;
    };

    /* ---------------------------------------------------------------------- */
    /* 运行                                                                    */
    /* ---------------------------------------------------------------------- */

    const run = async (): Promise<void> => {
        if (running.value || !ready.value) {
            return;
        }
        const payload = steps.value.filter((step) => step.enabled);
        if (payload.length === 0) {
            return;
        }

        // 上一轮的结果先清掉：留着会让人以为这轮也跑过这些步骤。
        results.value = {};
        streams.value = {};
        lastRun.value = null;
        running.value = true;

        try {
            await window.desktop.workflow.run(payload);
        } catch (error) {
            // IPC 抛错（已有运行在进行、形状不合法……）时把话说清楚，
            // 而不是让界面停在"转圈中"。
            loadError.value = error instanceof Error ? error.message : String(error);
        } finally {
            running.value = false;
            activeStepId.value = null;
        }
    };

    const cancel = (): void => {
        window.desktop.workflow.cancel();
    };

    const clearOutput = (): void => {
        results.value = {};
        streams.value = {};
        lastRun.value = null;
    };

    /* ---------------------------------------------------------------------- */
    /* 生命周期                                                                */
    /* ---------------------------------------------------------------------- */

    const load = async (): Promise<void> => {
        loading.value = true;
        loadError.value = "";
        try {
            const result = await window.desktop.workflow.catalog();
            catalog.value = result;

            // 清单到手后才能判断旧步骤还有没有意义，所以过滤放在这里。
            const known = new Set(result.verbs.map((verb) => verb.key));
            steps.value = loadSteps().filter((step) => known.has(step.verb));
            selectedId.value = steps.value[0]?.id ?? null;
        } catch (error) {
            loadError.value = error instanceof Error ? error.message : String(error);
        } finally {
            loading.value = false;
        }
    };

    watch(
        steps,
        (value) => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
            } catch {
                // 存不下（配额、隐私模式）不该影响正在编辑的内容，静默即可
            }
        },
        { deep: true }
    );

    return {
        catalog,
        loading,
        loadError,
        ready,
        groups,
        verbMap,
        steps,
        selectedId,
        selected,
        selectedVerb,
        enabledCount,
        running,
        activeStepId,
        results,
        streams,
        lastRun,
        load,
        addStep,
        removeStep,
        moveStep,
        updateStep,
        setArg,
        appendArg,
        dropArg,
        clearSteps,
        run,
        cancel,
        clearOutput
    };
};

/** 页面把这份状态透传给子组件时用的类型。 */
export type WorkflowState = ReturnType<typeof useWorkflow>;
