/**
 * 工作流域模型：一条定义、一次运行、一个变量。
 *
 * ## 现状与本设计的关系
 *
 * `src/state/use-workflow.ts` 里已有的东西是**一条线性步骤表**：步骤存
 * `localStorage` 的**一个** key（`calendar.workflow.steps.v1`），没有名字、
 * 没有版本、步骤之间没有数据流。`docs/ui-architecture.md` §7.1 把它的八个缺口
 * 逐条列了出来。
 *
 * 本文件补的是**形状**：有名字、有版本、有变量、有运行记录。执行仍然是
 * 原来的执行器（`shared/workflow-api.ts` + `main/workflow.ts`）——它已经把
 * 白名单、形状校验、长度上限、UTF-8 三流做对了，不需要重写。
 *
 * ## 为什么变量是"参数槽上的绑定"而不是重做 `args`
 *
 * `WorkflowStep.args: string[]` 是纯字符串数组。如果为了变量把 `args` 换成
 * 对象数组，那么：
 *
 * 1. `isWorkflowStep()`（`shared/workflow-api.ts`）要改，
 *    而它是**主进程的信任边界**，改它等于动安全面；
 * 2. 已经存下来的步骤（老 key 里的）全部作废；
 * 3. 主进程要跟着改，而它现在只认字符串数组。
 *
 * 所以变量做成**加法**：`WorkflowDefinition.variables` 声明变量，
 * 步骤的参数槽在**运行时**由 `bindings` 覆盖。没有 `bindings` 的步骤行为完全不变，
 * 老的定义照样能跑。
 *
 * ## 与 `docs/design.md` 的关系
 *
 * 工作流定义目前**没有对应的表**（与会话、消息一样）。它落在 `localStorage` 里，
 * 形状在这里定义、由 `store/flow.store.ts` 持有。等表结构定下来，
 * 改动只落在 store 一层：本文件加 `identity` / `start` / `end` 三个字段
 * （与其余实体一致，见 `src/entity/entity.ts`），页面与组件不用动。
 */

import type { WorkflowStep } from "../../shared/workflow-api";

/* -------------------------------------------------------------------------- */
/* 变量                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 一个工作流变量。
 *
 * 两类来源，靠 `kind` 分：
 *
 * - `input`：运行时由用户填（"这次要处理哪个文件"）；
 * - `step`：由某一步的产出提供（"上一步读到的内容"），所以带 `fromStepId`。
 *
 * `docs/ui-architecture.md` §7.3.3 把它叫"变量层"，是把"宏"变成"工作流"的关键：
 * 没有它，工作流只能重复跑同一串固定命令。
 */
export interface WorkflowVariable {
    /** 变量名，在定义内唯一；步骤用 `{{名字}}` 引用它 */
    name: string;
    /** 人读说明 */
    label: string;
    /** 来源 */
    kind: "input" | "step";
    /** 运行时变量：从哪一步取 */
    fromStepId?: string;
    /** 从那个步骤产出的哪个字段取；空串表示取整个 `result` */
    fromField?: string;
    /** 默认值（仅 `input` 有意义） */
    fallback?: string;
    /** 是否必填 */
    required: boolean;
}

/* -------------------------------------------------------------------------- */
/* 步骤与绑定                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 一步的变量绑定：**参数槽下标 → 变量名**。
 *
 * 用下标而不是参数名做键，因为参数名是从源码里静态提取的（见
 * `scripts/operation/build.mjs`），可能取不到（退化成 `arg1`），
 * 而**下标是稳定的**——它由动词自己的 `Assert-NoExtra -Expected N` 决定。
 */
export type StepBindings = Record<number, string>;

/* -------------------------------------------------------------------------- */
/* 定义                                                                        */
/* -------------------------------------------------------------------------- */

/** 一条工作流定义。 */
export interface WorkflowDefinition {
    /** 定义 id */
    id: string;
    /** 名字，用户填 */
    name: string;
    /** 一句话说明它做什么 */
    description: string;
    /**
     * 版本号，从 1 开始。
     *
     * 每次保存步骤或变量时 +1。理由不是"版本管理"这个抽象概念，
     * 而是**运行记录必须能说清"那次跑的是哪一版"**：
     * 同一个定义改过之后跑失败，用户要能分辨是"本来就坏"还是"刚改坏"。
     */
    version: number;
    /** 步骤，顺序即执行顺序 */
    steps: WorkflowStep[];
    /** 每一步的变量绑定；键是步骤 id */
    bindings: Record<string, StepBindings>;
    /** 变量声明 */
    variables: WorkflowVariable[];
    /** 创建时刻（毫秒） */
    createdAt: number;
    /** 最后修改时刻（毫秒） */
    updatedAt: number;
}

/* -------------------------------------------------------------------------- */
/* 运行记录                                                                    */
/* -------------------------------------------------------------------------- */

/** 一次运行的结局。 */
export type FlowRunOutcome = "ok" | "failed" | "cancelled" | "running";

/** 一次运行里的一步。 */
export interface FlowRunStep {
    /** 步骤 id */
    stepId: string;
    /** 动词键 */
    verb: string;
    /** 实际执行的命令行 */
    command: string;
    /** 是否成功 */
    ok: boolean;
    /** 耗时（毫秒） */
    durationMs: number;
    /** 退出码；`null` 表示被信号杀死 */
    exitCode: number | null;
    /** 信封里的错误码（如果有） */
    errorCode: string | null;
    /** 信封说不清时的一句说明 */
    note: string | null;
    /**
     * 这一步是不是"经用户批准后执行"的。
     *
     * `docs/ui-architecture.md` §7.5 要求运行记录里能看出
     * "哪几步是批准后执行的"——审计要闭合。
     */
    approved: boolean;
}

/** 一次运行。 */
export interface FlowRun {
    /** 运行 id */
    id: string;
    /** 定义 id */
    definitionId: string;
    /** 运行时的定义名字（定义可能已被改名，记录要保留当时的名字） */
    definitionName: string;
    /** 运行时的定义版本 */
    definitionVersion: number;
    /** 开始时刻（毫秒） */
    startedAt: number;
    /** 总耗时（毫秒） */
    durationMs: number;
    /** 结局 */
    outcome: FlowRunOutcome;
    /** 逐步结果 */
    steps: FlowRunStep[];
    /** 这次运行用的变量值（脱敏不了，但至少可回看） */
    values: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* 取值与推导                                                                  */
/* -------------------------------------------------------------------------- */

/** 存储键。与旧的单条步骤表分开：老 key 不动，用户已有的步骤不会丢。 */
export const FlowStorageKey = "calendar.flow.definitions.v1";

/** 运行记录的存储键。 */
export const FlowRunStorageKey = "calendar.flow.runs.v1";

/** 运行记录保留多少条。 */
export const FlowRunKeep = 50;

/** 生成一个 id。只在本地下唯一，不参与任何协议。 */
export const newId = (prefix: string): string =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 新定义。 */
export const createDefinition = (name = "新工作流"): WorkflowDefinition => {
    const now = Date.now();
    return {
        id: newId("flow"),
        name,
        description: "",
        version: 1,
        steps: [],
        bindings: {},
        variables: [],
        createdAt: now,
        updatedAt: now
    };
};

/**
 * 变量引用的写法：`{{名字}}`。
 *
 * 用双花括号而不是 `${}`：后者与 JS 模板串同形，而工作流的参数值里出现
 * shell 变量（`$env:PATH`）是常态，撞上之后很难判断该由谁展开。
 */
export const VariablePattern = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

/** 取出一个字符串里引用的全部变量名。 */
export const referencesIn = (text: string): string[] => {
    const names: string[] = [];
    for (const match of text.matchAll(VariablePattern)) {
        names.push(match[1]);
    }
    return names;
};

/**
 * 把变量引用替换成实际值。
 *
 * **在主进程之外做**（渲染进程构造好步骤再交给 `runWorkflow`），
 * 因为主进程的职责是执行与白名单，不是模板渲染；
 * 而模板的知识（`{{名字}}`）属于这一层。
 *
 * 未定义的引用**保持原样**：替换成空串会让一条命令从"明显错"变成"悄悄少一个参数"。
 */
export const substitute = (text: string, values: Record<string, string>): string =>
    text.replace(VariablePattern, (whole: string, name: string) =>
        Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole
    );

/** 把一步的参数按绑定与变量值解出来。 */
export const resolveArgs = (
    step: WorkflowStep,
    bindings: StepBindings | undefined,
    values: Record<string, string>
): string[] =>
    step.args.map((arg, index) => {
        const bound = bindings?.[index];
        // 绑定优先：它把参数槽直接指向某个变量
        if (bound !== undefined && Object.prototype.hasOwnProperty.call(values, bound)) {
            return values[bound];
        }
        // 没绑定的参数仍然支持就地写 `{{名字}}`
        return substitute(arg, values);
    });

/** 定义里引用了但没声明的变量名——校验用。 */
export const unresolvedOf = (definition: WorkflowDefinition): string[] => {
    const declared = new Set(definition.variables.map((item) => item.name));
    const used = new Set<string>();

    for (const step of definition.steps) {
        for (const arg of step.args) {
            for (const name of referencesIn(arg)) {
                used.add(name);
            }
        }
    }
    for (const binding of Object.values(definition.bindings)) {
        for (const name of Object.values(binding)) {
            used.add(name);
        }
    }

    return [...used].filter((name) => !declared.has(name));
};
