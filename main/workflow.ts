import { spawn } from "child_process";
import type { ChildProcessWithoutNullStreams } from "child_process";
import { existsSync, readFileSync, statSync } from "fs";
import { delimiter, join } from "path";
import { app } from "electron";

import type {
    WorkflowCatalog,
    WorkflowEnvelope,
    WorkflowEvent,
    WorkflowRunResult,
    WorkflowStep,
    WorkflowStepResult,
    WorkflowVerb
} from "../shared/workflow-api";

/**
 * dsh-os 执行器。
 *
 * ## 为什么不直接调用 `scripts/operation/*.ps1`
 *
 * 那些是**模块**，不是入口：`preamble` 是文件头、`entry` 是文件尾、中间只有函数
 * 定义，单独跑任何一个都没有 `main`。真正的入口由
 * `node scripts/operation/build.mjs` 从它们组装出来，本文件只调用组装产物。
 *
 * ## 怎么选入口（"按系统判断"）
 *
 * 只看操作系统是不够的：这台机器上没有 PowerShell 7（没有 `pwsh`），也没有 `bash`。
 * 所以判定条件是**运行时真的有哪个解释器**，按优先级取第一个既存在解释器、又存在
 * 产物的组合：
 *
 * | 平台    | 候选（按序）                                        |
 * | ------- | --------------------------------------------------- |
 * | Windows | `pwsh` + `dsh-os7.ps1`，否则 `powershell` + `dsh-os5.ps1` |
 * | 其它    | `sh` / `bash` + `dsh-os.sh`                          |
 *
 * 判定结果缓存在 `plan` 里，每次运行不重复扫 PATH。
 */

/** 项目根。开发期是仓库目录，打包后是 asar 根。 */
const projectRoot = app.getAppPath();

const operationDir = join(projectRoot, "scripts", "operation");

/** 由 build.mjs 生成的动词清单。 */
const manifestPath = join(operationDir, "verbs.json");

/* -------------------------------------------------------------------------- */
/* 解释器与入口的解析                                                          */
/* -------------------------------------------------------------------------- */

/** 在 PATH 里找可执行文件。不启进程，避免为了"能不能用"付一次 spawn 的代价。 */
const findExecutable = (name: string): string | null => {
    const pathValue = process.env.PATH ?? "";
    const extensions =
        process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];

    for (const dir of pathValue.split(delimiter)) {
        if (!dir) {
            continue;
        }
        for (const extension of extensions) {
            const candidate = join(dir, name + extension.toLowerCase());
            try {
                if (existsSync(candidate) && statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // PATH 里常有已卸载程序的死目录，读不到就跳过
            }
        }
    }
    return null;
};

interface EntryPlan {
    /** 解释器可执行文件 */
    executable: string;
    /** 解释器自己的参数，入口路径接在它们后面 */
    executableArgs: string[];
    /** 入口脚本绝对路径 */
    entryPath: string;
    /** 入口脚本相对项目根的路径，用于界面回显 */
    entry: string;
    /** 人读的解释器说明 */
    interpreter: string;
    /** 该平台的动词可用性判定：Windows 上 82 个全有实现，POSIX 上只有 sh 侧写过的那些 */
    windows: boolean;
}

interface Candidate {
    exe: string;
    args: string[];
    entry: string;
    label: string;
}

const candidatesFor = (platform: NodeJS.Platform): Candidate[] => {
    if (platform === "win32") {
        return [
            { exe: "pwsh", args: ["-NoProfile", "-File"], entry: "dsh-os7.ps1", label: "PowerShell 7" },
            {
                exe: "powershell",
                args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File"],
                entry: "dsh-os5.ps1",
                label: "Windows PowerShell 5.1"
            }
        ];
    }
    return [
        { exe: "sh", args: [], entry: "dsh-os.sh", label: "POSIX sh" },
        { exe: "bash", args: [], entry: "dsh-os.sh", label: "bash" }
    ];
};

let cachedPlan: EntryPlan | null = null;

/** 解析入口；失败时返回原因，由调用方放进 `WorkflowCatalog.problem`。 */
const resolvePlan = (): { plan: EntryPlan } | { problem: string } => {
    if (cachedPlan) {
        return { plan: cachedPlan };
    }
    if (!existsSync(operationDir)) {
        return { problem: `找不到命令层目录 ${operationDir}。` };
    }

    const tried: string[] = [];
    for (const candidate of candidatesFor(process.platform)) {
        const executable = findExecutable(candidate.exe);
        const entryPath = join(operationDir, candidate.entry);
        if (!executable) {
            tried.push(`${candidate.exe}（PATH 里没有）`);
            continue;
        }
        if (!existsSync(entryPath)) {
            tried.push(`${candidate.entry}（未生成）`);
            continue;
        }
        cachedPlan = {
            executable,
            executableArgs: candidate.args,
            entryPath,
            entry: `scripts/operation/${candidate.entry}`,
            interpreter: candidate.label,
            windows: process.platform === "win32"
        };
        return { plan: cachedPlan };
    }

    return {
        problem: `没有可用的解释器或入口：${tried.join("；")}。先执行 node scripts/operation/build.mjs 生成入口。`
    };
};

/* -------------------------------------------------------------------------- */
/* 动词清单                                                                    */
/* -------------------------------------------------------------------------- */

interface ManifestVerb {
    key: string;
    module: string;
    arity: number | null;
    minPositionals?: number;
    mutating: boolean;
    sh: boolean;
    names?: { name: string; required: boolean; fallback: string | null }[];
    flags?: { values: string[]; booleans: string[] };
}

const readManifest = (): ManifestVerb[] | null => {
    if (!existsSync(manifestPath)) {
        return null;
    }
    try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as { verbs?: ManifestVerb[] };
        return Array.isArray(parsed.verbs) ? parsed.verbs : null;
    } catch {
        return null;
    }
};

/** 动词清单 + 当前平台选中的入口。渲染进程据此渲染动作列表。 */
export const readCatalog = (): WorkflowCatalog => {
    const resolved = resolvePlan();
    const manifest = readManifest();

    if (!manifest) {
        return {
            platform: process.platform,
            entry: "",
            interpreter: "",
            verbs: [],
            problem: "缺少 scripts/operation/verbs.json。先执行 node scripts/operation/build.mjs。"
        };
    }

    if ("problem" in resolved) {
        return {
            platform: process.platform,
            entry: "",
            interpreter: "",
            verbs: [],
            problem: resolved.problem
        };
    }

    const verbs: WorkflowVerb[] = manifest.map((verb) => ({
        key: verb.key,
        module: verb.module,
        arity: verb.arity,
        mutating: verb.mutating,
        // Windows 侧 82 个动词都有实现；POSIX 侧只有 sh 模块写过的那些，
        // 没有实现的在界面上标灰而不是调用后才失败。
        available: resolved.plan.windows ? true : verb.sh,
        // 参数名与开关是从源码静态提取的（scripts/operation/build.mjs），
        // 界面用它们渲染可读的参数标签与开关区；缺了也能跑，只是标签退化成 arg1/arg2。
        minPositionals: verb.minPositionals ?? (verb.arity ?? 0),
        names: verb.names ?? [],
        flags: verb.flags ?? { values: [], booleans: [] }
    }));

    return {
        platform: process.platform,
        entry: resolved.plan.entry,
        interpreter: resolved.plan.interpreter,
        verbs,
        problem: null
    };
};

/* -------------------------------------------------------------------------- */
/* 执行                                                                        */
/* -------------------------------------------------------------------------- */

/** 按 shell 习惯把参数拼成可读的命令行，只用于界面回显与复制。 */
const displayCommand = (entry: string, tokens: string[]): string => {
    const quote = (token: string): string =>
        token === "" || /[\s"']/.test(token) ? `"${token.replace(/"/g, '\\"')}"` : token;
    return [entry, ...tokens.map(quote)].join(" ");
};

/**
 * 从 stdout 里取信封。
 *
 * 契约要求 stdout **只有**一个 UTF-8 JSON 信封，但进程被强杀、模块里有人忘了把
 * 调试输出挪去 stderr 时都可能多出行。所以从最后一行往前找第一个能解析成
 * 带 `ok` 或 `error` 的对象，而不是假定 stdout 整块就是 JSON。
 */
const parseEnvelope = (stdout: string): WorkflowEnvelope | null => {
    const lines = stdout.split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index].trim();
        if (!line.startsWith("{") || !line.endsWith("}")) {
            continue;
        }
        try {
            const parsed = JSON.parse(line) as WorkflowEnvelope;
            if (parsed && typeof parsed === "object" && ("ok" in parsed || "error" in parsed)) {
                return parsed;
            }
        } catch {
            // 不是信封，继续往前找
        }
    }
    return null;
};

/** 当前运行；同时只允许一个，避免两次运行抢同一份 .temporary 状态。 */
let activeChild: ChildProcessWithoutNullStreams | null = null;
let cancelRequested = false;

/** 中断当前运行。没有运行时空操作。 */
export const cancelWorkflow = (): void => {
    cancelRequested = true;
    if (activeChild && !activeChild.killed) {
        activeChild.kill();
    }
};

/**
 * 跑一个动词，边跑边把输出推给界面。
 *
 * 这是**唯一的执行入口**：工作流的一步与"调一个动词"（`shared/os-api.ts`）都走这里，
 * 所以 spawn 参数、UTF-8 三流、信封解析、中断判定只写一遍。
 *
 * `hook` 决定要不要推事件：工作流页要按 stepId 归位流式输出，直接调动词的页面不需要事件，
 * 传 `null` 即可（此时 `emit` 会被完全跳过，不留一个空函数调用）。
 */
const runVerb = (
    plan: EntryPlan,
    tokens: string[],
    hook: { runId: string; stepId: string; emit: (event: WorkflowEvent) => void } | null
): Promise<Omit<WorkflowStepResult, "stepId">> =>
    new Promise((resolve) => {
        const command = displayCommand(plan.entry, tokens);
        const startedAt = Date.now();

        let stdout = "";
        let stderr = "";
        let settled = false;

        const settle = (result: Omit<WorkflowStepResult, "stepId">): void => {
            if (settled) {
                return;
            }
            settled = true;
            activeChild = null;
            if (hook) {
                hook.emit({ type: "step-end", runId: hook.runId, stepId: hook.stepId, result: { stepId: hook.stepId, ...result } });
            }
            resolve(result);
        };

        const finish = (exitCode: number | null, note: string | null): void => {
            const envelope = parseEnvelope(stdout);
            settle({
                command,
                // 判决以信封为准：进程退出码是给 shell 看的，信封才是契约里的权威
                // （模块的 entry 特意按 error.code 反推退出码，两者必然一致；但被强杀时
                // 没有信封，那时只能看退出码）。
                ok: envelope ? envelope.ok === true : exitCode === 0,
                exitCode,
                durationMs: Date.now() - startedAt,
                envelope,
                stdout,
                stderr,
                note
            });
        };

        let child: ChildProcessWithoutNullStreams;
        try {
            child = spawn(plan.executable, [...plan.executableArgs, plan.entryPath, ...tokens], {
                cwd: projectRoot,
                windowsHide: true
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            settle({
                command,
                ok: false,
                exitCode: null,
                durationMs: Date.now() - startedAt,
                envelope: null,
                stdout: "",
                stderr: message,
                note: `无法启动 ${plan.executable}`
            });
            return;
        }

        activeChild = child;
        if (hook) {
            hook.emit({ type: "step-start", runId: hook.runId, stepId: hook.stepId, index: 0, command });
        }

        // 模块把三个流都钉成 UTF-8 无 BOM，所以按 utf8 解码即可。
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");

        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
            if (hook) {
                hook.emit({ type: "output", runId: hook.runId, stepId: hook.stepId, stream: "stdout", text: chunk });
            }
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
            if (hook) {
                hook.emit({ type: "output", runId: hook.runId, stepId: hook.stepId, stream: "stderr", text: chunk });
            }
        });

        child.on("error", (error) => finish(null, `进程错误：${error.message}`));

        child.on("close", (code, signal) => {
            if (cancelRequested) {
                finish(code, "已中断");
                return;
            }
            if (signal) {
                finish(code, `进程被信号 ${signal} 终止`);
                return;
            }
            finish(code, parseEnvelope(stdout) ? null : "进程没有输出信封，见 stdout / stderr 原文");
        });
    });

/** 跑工作流里的一步。 */
const runStep = async (
    plan: EntryPlan,
    step: WorkflowStep,
    runId: string,
    emit: (event: WorkflowEvent) => void
): Promise<WorkflowStepResult> => {
    // 动词键是点分形式（`file.create`），命令行要空格分形式（`file create`）——
    // 三词动词 `environment.attribute.add` 也由此正确展开。
    const tokens = [...step.verb.split("."), ...(step.allow ? ["--allow"] : []), ...step.args];
    const result = await runVerb(plan, tokens, { runId, stepId: step.id, emit });

    return { stepId: step.id, ...result };
};

/**
 * 按顺序跑完这些步骤。
 *
 * 步骤之间**不并行**：这些动词会操作同一台机器的窗口、剪贴板、环境变量，
 * 并发跑等于把顺序交给调度器。
 */
export const runWorkflow = async (
    steps: WorkflowStep[],
    emit: (event: WorkflowEvent) => void
): Promise<WorkflowRunResult> => {
    const resolved = resolvePlan();
    if ("problem" in resolved) {
        throw new Error(resolved.problem);
    }
    if (activeChild) {
        throw new Error("已有一次运行正在进行，先中断它。");
    }

    const catalogKeys = new Set((readManifest() ?? []).map((verb) => verb.key));
    const runId = `run-${Date.now().toString(36)}`;
    const startedAt = Date.now();

    cancelRequested = false;
    const results: WorkflowStepResult[] = [];
    let cancelled = false;

    for (const step of steps) {
        if (cancelRequested) {
            cancelled = true;
            break;
        }
        if (!step.enabled) {
            continue;
        }
        // 白名单：渲染进程送来的动词必须在清单里，否则不启动进程。
        if (!catalogKeys.has(step.verb)) {
            results.push({
                stepId: step.id,
                command: step.verb,
                ok: false,
                exitCode: null,
                durationMs: 0,
                envelope: null,
                stdout: "",
                stderr: "",
                note: `未知动词 ${step.verb}，已拒绝执行`
            });
            continue;
        }

        const result = await runStep(resolved.plan, step, runId, emit);
        results.push(result);
    }

    if (cancelRequested) {
        cancelled = true;
    }

    const runResult: WorkflowRunResult = {
        runId,
        ok: results.length > 0 && results.every((result) => result.ok),
        steps: results,
        durationMs: Date.now() - startedAt,
        cancelled
    };
    emit({ type: "run-end", runId, result: runResult });
    return runResult;
};

/* -------------------------------------------------------------------------- */
/* 单动词调用                                                                  */
/* -------------------------------------------------------------------------- */

/** 渲染进程送来的单次调用（形状见 `shared/os-api.ts` 的 `OsInvokeRequest`）。 */
export interface OsInvokeInput {
    verb: string;
    args?: readonly string[];
    named?: Readonly<Record<string, string>>;
    flags?: readonly string[];
    allow?: boolean;
}

/**
 * 把一次调用的三种参数形式拼成 dsh-os 的命令行 token。
 *
 * 具名参数**不在这里折回位置**：`command.ps1` 的 `Merge-NamedArguments` 已经按
 * `spec/verbs.tsv` 的声明顺序做了这件事，而且它知道每个动词的参数名。
 * 在渲染进程或这里再实现一遍，就等于把同一张表抄两份。所以具名参数原样透传成
 * `name="value"` 的形式，由命令层自己折叠。
 */
const tokensOf = (input: OsInvokeInput): string[] => {
    const tokens = [...input.verb.split(".")];

    if (input.allow) {
        tokens.push("--allow");
    }
    tokens.push(...(input.args ?? []));

    for (const [name, value] of Object.entries(input.named ?? {})) {
        tokens.push(`${name}=${value}`);
    }
    tokens.push(...(input.flags ?? []));

    return tokens;
};

/**
 * 调一个动词。
 *
 * 与工作流共用同一个执行器（`runVerb`）与同一份白名单：动词必须在清单里，
 * 否则不启动进程。`mutating` 的动词需要调用方显式给 `allow`——**这一层不替用户点头**，
 * 命令层自己会在缺 `--allow` 时回 `E_PERMISSION` 信封。
 */
export const invokeOs = async (input: OsInvokeInput): Promise<Omit<WorkflowStepResult, "stepId">> => {
    const resolved = resolvePlan();
    if ("problem" in resolved) {
        throw new Error(resolved.problem);
    }
    if (activeChild) {
        throw new Error("已有一次执行正在进行，先中断它。");
    }

    const catalogKeys = new Set((readManifest() ?? []).map((verb) => verb.key));
    if (!catalogKeys.has(input.verb)) {
        return {
            command: input.verb,
            ok: false,
            exitCode: null,
            durationMs: 0,
            envelope: null,
            stdout: "",
            stderr: "",
            note: `未知动词 ${input.verb}，已拒绝执行`
        };
    }

    cancelRequested = false;
    return runVerb(resolved.plan, tokensOf(input), null);
};
