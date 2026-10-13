/**
 * 动词清单构建器。
 *
 * ## 为什么需要它
 *
 * `main/workflow.ts` 的 `readCatalog()` 读的是 `scripts/operation/verbs.json`，而这个文件
 * 一直没有生成器——它不是被手写进去的产物，手写必然与 82 个动词的源码漂移。
 *
 * 本脚本把清单**从源码静态提取**出来，与 `shared/workflow-api.ts` 里 `WorkflowVerb`
 * 的注释一致：
 *
 * - `arity` 来自动词体里的 `Assert-NoExtra -Parsed $Parsed -Expected N`；
 * - `mutating` 来自 `Assert-Allowed -Parsed $Parsed -Perm 'W'`（命中就必须带 `--allow`）；
 * - 位置参数的**名字与说明**来自 `Get-Positional -Index i -Name x` 与 `-Optional -Default y`；
 * - 取值开关与布尔开关分别来自 `Get-FlagValue -Name x` 与 `Test-HasFlag -Parsed $Parsed -Name x`。
 *
 * 顺带生成 `scripts/operation/spec/verbs.tsv`：`command.ps1` 的 `Get-VerbParams()` 与
 * `dispatch.ps1` 的 `Get-KnownVerbs()` 都从那里读**声明顺序的位置参数名**，
 * 没有它，`file create path=... content=...` 这种具名调用形式会报
 * "verb takes no named arguments"。也就是说这个文件缺失会让钩子降级，不只是少一份文档。
 *
 * ## 静态提取不走 PowerShell 的原因
 *
 * `selfcheck` 输出的每行 `positionals` / `flags` / `perm` 全是 `-`（实测：见
 * `.temporary/selfcheck.json`），拿不到逐动词元数据；而启动 82 次 PowerShell 解析 AST
 * 在打包后的应用里根本不可用。源码是唯一事实来源，直接从它提取。
 *
 * 用法：
 *   node scripts/operation/build.mjs            # 生成两个文件
 *   node scripts/operation/build.mjs --check    # 只校验，不写文件（CI 与开发期自检用）
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

/** 平台实现目录；Windows 侧是权威，POSIX 侧只用于标记 `sh` 可用性。 */
const IMPLEMENTATIONS = [
    { id: "powershell7.6", dir: join(here, "powershell7.6"), windows: true },
    { id: "powershell5.1", dir: join(here, "powershell5.1"), windows: true }
];

/** POSIX 侧**已实现**的动词（`entry.sh` 的 case 表里出现的那些）。 */
const posixDir = here;
const posixModules = ["charset", "command", "dispatch", "entry", "environment", "execute", "file", "git", "json", "native", "paths", "permission", "preamble", "service", "system", "task", "window"];

/**
 * 读一个平台的模块源码，拼成一张 `函数名 -> 函数体` 的表。
 *
 * 每个模块文件是「文件头 + 若干 `function Invoke-Xxx { ... }`」，函数体以顶格的 `}` 结束，
 * 所以按行扫描即可，不需要完整解析 PowerShell。
 */
function readModules(dir) {
    const bodies = new Map();
    const texts = [];

    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith(".ps1")) {
            continue;
        }
        const text = readFileSync(join(dir, entry), "utf8");
        texts.push(text);

        const lines = text.split(/\r?\n/);
        let current = null;
        let buffer = [];

        for (const line of lines) {
            const open = /^function\s+([A-Za-z0-9_-]+)\s*\{/.exec(line);
            if (open) {
                current = open[1];
                buffer = [line];
                continue;
            }
            if (current === null) {
                continue;
            }
            buffer.push(line);
            // 顶格的 `}` 收尾；函数体内不会有顶格的 `}`。
            if (/^\}/.test(line)) {
                bodies.set(current, buffer.join("\n"));
                current = null;
                buffer = [];
            }
        }
    }

    return { bodies, texts: texts.join("\n") };
}

/* -------------------------------------------------------------------------- */
/* dispatch 表：动词键 -> 实现函数                                              */
/* -------------------------------------------------------------------------- */

/**
 * 从 `dispatch.ps1` 的 `switch ($target.key)` 里取出全部动词键与实现函数。
 *
 * 只认 `'key' { ... }` 形态的 case 标签；`default` 跳过。这里是**动词全集**的唯一来源：
 * 比 `spec/verbs.tsv` 准（那个文件漏了 `file.encode`，实测）。
 */
function readDispatch(text) {
    const start = text.indexOf("switch ($target.key)");
    if (start < 0) {
        throw new Error("dispatch.ps1 里找不到 switch ($target.key)");
    }
    const body = text.slice(start);

    const entries = new Map();
    const pattern = /'([a-z][a-z0-9.]*)'\s*\{\s*return\s*\(?([A-Za-z0-9_-]+)/g;
    let match = pattern.exec(body);

    while (match !== null) {
        // 第一个命中的 case 优先：后续模块不会重复注册同一个键。
        if (!entries.has(match[1])) {
            entries.set(match[1], match[2]);
        }
        match = pattern.exec(body);
    }

    // `default` 分支之前的 `}` 结束 switch；再往后是文件其余内容。截断以免把别的 switch 读进来。
    return entries;
}

/* -------------------------------------------------------------------------- */
/* 动词体解析                                                                  */
/* -------------------------------------------------------------------------- */

/** 位置参数槽：索引、名字与是否可选。 */
function readPositionals(body) {
    const slots = new Map();

    /**
     * 名字有三种写法，都要认：
     *
     * 1. `Get-Positional -Parsed $Parsed -Index 0 -Name 'path'` —— 名字就在这次调用里；
     * 2. `Get-IntArg -Text (Get-Positional -Parsed $Parsed -Index 0) -Name 'x'` —— 名字在
     *    **同一语句**的外层调用上（window.ps1 里大量这样写）；
     * 3. `$name = Get-Positional -Parsed $Parsed -Index 0` —— 根本没有名字，靠**赋值给谁**推断
     *    （`$key` / `$target` / `$name` 就是这么来的）。
     *
     * **按语句而不是按字符窗口**取名字：曾经用「调用点后 160 字符内的第一个 `-Name`」，
     * 结果 `mouse.over` 的 `$y` 拿到了 `Assert-Allowed` 里的 `-Verb`，名字全串了。
     * 现在以分号与换行为语句边界，只在**本语句**里找。
     *
     * 三种都读不到时才退回 `arg{n}`。名字只是给界面显示用的（工作流节点库的参数标签），
     * 读不到不影响调用正确性——动词的调用形式由位置与个数决定。
     */
    const pattern =
        /(?:\(|=\s*)?\s*Get-Positional\s+(?:-Parsed\s+\$Parsed\s+)?(?:-Index\s+(\d+)\s*)?/g;

    let match = pattern.exec(body);
    let fallbackIndex = 0;

    while (match !== null) {
        const index = match[1] === undefined ? fallbackIndex : Number(match[1]);
        fallbackIndex = index + 1;

        // 语句边界：调用点所在行；行内已经含整个调用的情况占绝大多数。
        const lineStart = body.lastIndexOf("\n", match.index) + 1;
        const lineEnd = body.indexOf("\n", match.index);
        const line = body.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
        const after = body.slice(match.index, lineEnd < 0 ? undefined : lineEnd);

        const inline = /-Name\s+'([^']+)'/.exec(after)?.[1];
        const assigned = /(?:^|\s)\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*\(?\s*$/.exec(
            body.slice(lineStart, match.index)
        )?.[1];
        // 同一行里最后出现的 `-Name`：`Get-IntArg -Text (...) -Name 'x'` 取到 `x`，
        // 而 `Assert-Allowed ... -Verb 'y' -Perm 'W'` 里没有 `-Name`，不会误取。
        const onLine = [...line.matchAll(/-Name\s+'([^']+)'/g)].at(-1)?.[1];

        const name = inline ?? onLine ?? assigned ?? null;
        if (!slots.has(index)) {
            slots.set(index, { name: name ?? `arg${index + 1}` });
        }

        match = pattern.exec(body);
    }

    // 可选项与默认值：整行匹配，避免跨行误判。
    for (const [index, slot] of slots) {
        const escaped = slot.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const line = new RegExp(`^.*?-Name\\s+'${escaped}'.*$`, "m").exec(body)?.[0] ?? "";
        const fallback = /-Default\s+'([^']*)'/.exec(line);
        slots.set(index, {
            name: slot.name,
            optional: /-Optional/.test(line),
            fallback: fallback ? fallback[1] : null
        });
    }

    const maxIndex = Math.max(-1, ...slots.keys());
    const names = [];
    for (let index = 0; index <= maxIndex; index += 1) {
        const slot = slots.get(index);
        names.push(
            slot
                ? { name: slot.name, optional: slot.optional ?? false, fallback: slot.fallback ?? null }
                : { name: `arg${index + 1}`, optional: true, fallback: null }
        );
    }
    return names;
}

/** 开关：取值开关与布尔开关。 */
function readFlags(body) {
    const values = [];
    const booleans = [];

    const valuePattern = /Get-FlagValue\s+-Parsed\s+\$Parsed\s+-Name\s+'([^']+)'/g;
    let match = valuePattern.exec(body);
    while (match !== null) {
        if (!values.includes(match[1])) {
            values.push(match[1]);
        }
        match = valuePattern.exec(body);
    }

    const boolPattern = /Test-HasFlag\s+-Parsed\s+\$Parsed\s+-Name\s+'([^']+)'/g;
    match = boolPattern.exec(body);
    while (match !== null) {
        if (!booleans.includes(match[1]) && !values.includes(match[1])) {
            booleans.push(match[1]);
        }
        match = boolPattern.exec(body);
    }

    return { values, booleans };
}

/** 单个动词的元数据。 */
function readVerb(key, functionName, bodies) {
    let body = bodies.get(functionName) ?? "";

    /**
     * 跟随一层薄包装。
     *
     * `window.maximize` / `window.minimize` / `window.restore` 的函数体只有一行
     * `return (Invoke-WindowShowState -Parsed $Parsed -Action 'maximize' ...)`，
     * `execute.kill` 是 `return (Invoke-TaskKill -Parsed $Parsed)`。断言都在被调用方，
     * 不跟进去就会读到空函数体，把这三个无参动词判成变参。
     *
     * 只跟一层，且仅当函数体里**没有任何断言与位置参数读取**时才跟——真实现里
     * `screenshot` 也有 `Assert-MinPositionals`，不会被误跟。
     */
    const wrapper = /^\s*return\s+\(?([A-Za-z0-9_-]+)\s+-Parsed\s+\$Parsed/m.exec(body);
    if (
        wrapper &&
        !/Assert-|Get-Positional/.test(body) &&
        bodies.has(wrapper[1])
    ) {
        body = bodies.get(wrapper[1]);
    }

    const expected = /Assert-NoExtra\s+-Parsed\s+\$Parsed\s+-Expected\s+(\d+)/.exec(body);
    const minPositionals = /Assert-MinPositionals\s+-Parsed\s+\$Parsed\s+-Min\s+(\d+)/.exec(body);
    // `-Verb` 的值可能是 `'window close'`，也可能是 `$(if ($Sequential) { 'execute synchronous' } else { ... })`。
    // 后者不写正则也认得出——这里只要 `-Perm`，所以 `-Verb` 到 `-Perm` 之间允许任意字符。
    const allowed = /Assert-Allowed[\s\S]{0,200}?-Perm\s+'([^']*)'/.exec(body);
    const positionalsCap = /Assert-Allowed[^\n]*?-Positionals\s+(\d+)/.exec(body);

    const names = readPositionals(body);
    const flags = readFlags(body);

    /**
     * 参数个数（arity）。
     *
     * 判定顺序：`Assert-NoExtra -Expected N` 最权威（它就是上限断言）；其次是
     * `Assert-Allowed -Positionals N`（源码在授权断言里顺带声明了上限，例如
     * `environment add` 与 `mouse click`）；再次是位置参数槽的数量。三者都没有才可能是变参。
     */
    let arity = null;
    if (expected) {
        arity = Number(expected[1]);
    } else if (positionalsCap) {
        arity = Number(positionalsCap[1]);
    } else if (names.length > 0) {
        arity = names.length;
    }

    /**
     * 变参（`arity === null`）。
     *
     * **必须同时满足两条**才判变参：
     * 1. 有 `Assert-MinPositionals`（说明参数个数有下限）；
     * 2. **既没有** `Assert-NoExtra -Expected`，**也没有** `Assert-Allowed -Positionals`。
     *
     * 只满足第一条不算——`environment add` 就是"有下限 + 上限写在授权断言里"，
     * 它固定收两个参数，不是变参。这一条修掉的是一版把 30 个动词误判成变参的错误。
     */
    const variadic = minPositionals !== null && expected === null && positionalsCap === null;
    if (variadic) {
        arity = null;
    }

    // 名字表裁到 arity：多出来的槽是 `Get-Positional -Index n` 在别的分支里用的。
    const aligned = arity === null ? names : names.slice(0, Math.max(arity, names.length));

    return {
        key,
        module: key.split(".")[0],
        arity,
        minPositionals: minPositionals ? Number(minPositionals[1]) : arity,
        mutating: allowed !== null && allowed[1] === "W",
        names: aligned.map((slot, index) => ({
            name: slot.name,
            required: index < (minPositionals ? Number(minPositionals[1]) : arity ?? 0),
            fallback: slot.fallback
        })),
        flags: {
            values: flags.values,
            booleans: flags.booleans
        },
        implementation: functionName
    };
}

/* -------------------------------------------------------------------------- */
/* 组装                                                                        */
/* -------------------------------------------------------------------------- */

function build() {
    const { bodies, texts } = readModules(IMPLEMENTATIONS[1].dir);
    const dispatchText = readFileSync(join(IMPLEMENTATIONS[1].dir, "dispatch.ps1"), "utf8");
    const entries = readDispatch(dispatchText);

    if (entries.size === 0) {
        throw new Error("dispatch 表里一个动词都没解析出来");
    }

    // POSIX 侧已实现的动词：从 entry.sh 的 case 表取。
    const posixEntry = readFileSync(join(posixDir, "entry.sh"), "utf8");
    const posixImplemented = new Set();
    const casePattern = /^\s*'([a-z][a-z0-9.]*)'\)\s*dispatch/gm;
    let match = casePattern.exec(posixEntry);
    while (match !== null) {
        posixImplemented.add(match[1]);
        match = casePattern.exec(posixEntry);
    }

    // 已知开关全集：`command.ps1` 的 $script:KnownFlags。
    const knownFlagsMatch = /\$script:KnownFlags\s*=\s*@\(([\s\S]*?)\)\s*\n/.exec(texts);
    const knownFlags = new Set();
    if (knownFlagsMatch) {
        const flagPattern = /'([a-z0-9-]+)'/g;
        let flag = flagPattern.exec(knownFlagsMatch[1]);
        while (flag !== null) {
            knownFlags.add(flag[1]);
            flag = flagPattern.exec(knownFlagsMatch[1]);
        }
    }

    const verbs = [...entries.entries()]
        .map(([key, functionName]) => readVerb(key, functionName, bodies))
        .sort((left, right) => left.key.localeCompare(right.key));

    return { verbs, knownFlags: [...knownFlags].sort(), posixImplemented };
}

/* -------------------------------------------------------------------------- */
/* 输出                                                                        */
/* -------------------------------------------------------------------------- */

/** 写入 `spec/verbs.tsv`：`verb \t names \t flags \t perm`，四列。 */
function writeSpec(result) {
    const lines = [
        "# dsh-os 动词表。由 scripts/operation/build.mjs 从模块源码生成，请勿手改。",
        "# 列：verb \\t 位置参数名（| 分隔，- 表示无） \\t 开关（| 分隔，- 表示无） \\t 权限类（W = 写，- = 只读）",
        ["verb", "positionals", "flags", "perm"].join("\t")
    ];

    for (const verb of result.verbs) {
        const names = verb.names.length === 0 ? "-" : verb.names.map((item) => item.name).join("|");
        const flags = [...verb.flags.values, ...verb.flags.booleans];
        lines.push(
            [
                verb.key,
                names,
                flags.length === 0 ? "-" : flags.join("|"),
                verb.mutating ? "W" : "-"
            ].join("\t")
        );
    }

    return `${lines.join("\n")}\n`;
}

/** 写入 `verbs.json`：`main/workflow.ts` 的 `readManifest()` 读它。 */
function writeManifest(result) {
    return `${JSON.stringify(
        {
            generatedBy: "scripts/operation/build.mjs",
            source: "scripts/operation/powershell5.1",
            verbCount: result.verbs.length,
            knownFlags: result.knownFlags,
            verbs: result.verbs.map((verb) => ({
                key: verb.key,
                module: verb.module,
                arity: verb.arity,
                minPositionals: verb.minPositionals,
                mutating: verb.mutating,
                // POSIX 侧有没有实现：主进程据此在非 Windows 上把没实现的标灰，
                // 而不是调用后才失败。
                sh: result.posixImplemented.has(verb.key),
                names: verb.names,
                flags: verb.flags,
                implementation: verb.implementation
            }))
        },
        null,
        4
    )}\n`;
}

/* -------------------------------------------------------------------------- */

const check = process.argv.includes("--check");
const result = build();

if (result.verbs.length === 0) {
    console.error("动词表为空，拒绝写出");
    process.exit(1);
}

const specText = writeSpec(result);
const manifestText = writeManifest(result);

if (check) {
    const specPath = join(here, "spec", "verbs.tsv");
    const manifestPath = join(here, "verbs.json");
    const problems = [];

    if (!existsSync(specPath) || readFileSync(specPath, "utf8") !== specText) {
        problems.push("spec/verbs.tsv 与源码不一致");
    }
    if (!existsSync(manifestPath) || readFileSync(manifestPath, "utf8") !== manifestText) {
        problems.push("verbs.json 与源码不一致");
    }

    if (problems.length > 0) {
        console.error(problems.join("\n"));
        console.error("运行 node scripts/operation/build.mjs 重新生成");
        process.exit(1);
    }
    console.log(`动词表已是最新：${result.verbs.length} 个动词`);
} else {
    mkdirSync(join(here, "spec"), { recursive: true });
    writeFileSync(join(here, "spec", "verbs.tsv"), specText, "utf8");
    writeFileSync(join(here, "verbs.json"), manifestText, "utf8");

    const mutating = result.verbs.filter((verb) => verb.mutating).length;
    const variadic = result.verbs.filter((verb) => verb.arity === null).length;
    const modules = new Set(result.verbs.map((verb) => verb.module));

    console.log(
        [
            `已写出：`,
            `  scripts/operation/spec/verbs.tsv`,
            `  scripts/operation/verbs.json`,
            `动词 ${result.verbs.length} 个（模块 ${modules.size} 个，写操作 ${mutating} 个，变参 ${variadic} 个）`,
            `已知开关 ${result.knownFlags.length} 个，POSIX 已实现 ${result.posixImplemented.size} 个`
        ].join("\n")
    );
}
