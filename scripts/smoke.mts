/**
 * 冒烟测试总入口：把 `scripts/smoke/*.smoke.ts` 逐个跑一遍。
 *
 *     npm run smoke                 # 全部
 *     npm run smoke -- markdown     # 只跑名字里含 "markdown" 的
 *     npm run smoke -- --list       # 只列出来，不跑
 *
 * 全部通过时退出码为 0；有任何一个失败就列出它并以 1 退出。
 *
 * ## 为什么要先打包再跑
 *
 * 这些脚本是 `.ts`，Node 24 能靠类型擦除直接跑，但**只对「叶子」脚本有效**：
 * Node 不认无扩展名的相对导入（`../service/service`），所以只要被测模块往下还有
 * 一层 import，直接跑就会 `ERR_MODULE_NOT_FOUND`。`store-cache.smoke.ts` 正是这种
 * 情况，它文件头本来就写着「先用 esbuild 打成一个文件」。
 *
 * 于是这里统一先打包再跑：叶子脚本走同一条路毫无损失，深依赖的脚本不必再各自
 * 记一条 esbuild 命令。打包与运行都以**项目目录**为基准，因为 `vue` / `pinia`
 * 这类裸导入要从项目的 `node_modules` 解析。
 *
 * ## 例外
 *
 * `markdown-render.smoke.ts` 自己会编译 SFC（`.vue` 不是 esbuild 能单独处理的），
 * 所以按原样直接跑；它同样把中间产物写在项目内、跑完即删。
 *
 * 本文件是 `.mts` 而不是 `.cjs`：`.cjs` 里的 `require()` 会被 eslint 的
 * `@typescript-eslint/no-require-imports` 判错（`scripts/build-icons.cjs` 现在就带着
 * 这类报错），而 ESM 既没有这个问题，也能被 `npm run typecheck:node` 一并检查。
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 项目根目录：本文件在 `scripts/` 下，上一层就是根。 */
const Root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 冒烟脚本所在目录。 */
const SmokeDirectory = join(Root, "scripts", "smoke");

/** 打包产物目录。放项目里，裸导入才找得到 `node_modules`。 */
const WorkDirectory = join(Root, ".tmp-smoke");

/** esbuild 的可执行入口。 */
const Esbuild = join(Root, "node_modules", "esbuild", "bin", "esbuild");

/** 留在外面、由 Node 从项目 `node_modules` 解析的包。 */
const ExternalPackages = ["vue", "pinia", "element-plus"];

/** 自己编译 SFC、不走 esbuild 的脚本。 */
const SelfCompiling = new Set(["markdown-render.smoke.ts"]);

/** 一次运行的结果。 */
interface Result {
    name: string;
    status: number;
    stage: string;
}

/** 命令行参数：`--list` 只列出，其余当作名字过滤。 */
const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const filters = args.filter((argument: string): boolean => !argument.startsWith("--"));

/** 参与本次运行的脚本文件名，按名字排序。 */
const scripts = readdirSync(SmokeDirectory)
    .filter((name: string): boolean => name.endsWith(".smoke.ts"))
    .filter(
        (name: string): boolean =>
            filters.length === 0 || filters.some((filter) => name.includes(filter))
    )
    .sort();

if (scripts.length === 0) {
    console.error(`没有匹配的冒烟脚本。目录：${SmokeDirectory}`);
    console.error(`过滤条件：${filters.length === 0 ? "（无）" : filters.join(", ")}`);
    process.exit(1);
}

if (listOnly) {
    for (const name of scripts) {
        console.log(`${SelfCompiling.has(name) ? "（自编译）" : "（esbuild）"} ${name}`);
    }
    process.exit(0);
}

if (!existsSync(Esbuild)) {
    console.error(`找不到 esbuild：${Esbuild}`);
    console.error("先装依赖（npm install），或只用 --list 看看有哪些脚本。");
    process.exit(1);
}

rmSync(WorkDirectory, { recursive: true, force: true });
mkdirSync(WorkDirectory, { recursive: true });

const results: Array<Result> = [];

try {
    for (const name of scripts) {
        console.log(`\n${"=".repeat(72)}\n${name}\n${"=".repeat(72)}`);

        let target = join(SmokeDirectory, name);
        if (!SelfCompiling.has(name)) {
            target = join(WorkDirectory, `${name.replace(/\.smoke\.ts$/, "")}.mjs`);
            const bundle = spawnSync(
                process.execPath,
                [
                    Esbuild,
                    join(SmokeDirectory, name),
                    "--bundle",
                    "--platform=node",
                    "--format=esm",
                    "--target=node22",
                    ...ExternalPackages.map(
                        (packageName: string): string => `--external:${packageName}`
                    ),
                    `--outfile=${target}`
                ],
                { cwd: Root, stdio: "inherit" }
            );

            if (bundle.status !== 0) {
                results.push({ name, status: bundle.status ?? 1, stage: "打包失败" });
                continue;
            }
        }

        const run = spawnSync(process.execPath, [target], { cwd: Root, stdio: "inherit" });
        results.push({ name, status: run.status ?? 1, stage: "断言失败" });
    }
} finally {
    rmSync(WorkDirectory, { recursive: true, force: true });
}

console.log(`\n${"=".repeat(72)}\n汇总\n${"=".repeat(72)}`);
for (const result of results) {
    const mark = result.status === 0 ? "✓" : "✗";
    const note = result.status === 0 ? "" : `  ${result.stage}`;
    console.log(`  ${mark} ${result.name}${note}`);
}

const failed = results.filter((result: Result): boolean => result.status !== 0);
console.log(
    failed.length === 0
        ? `\n${results.length} 个脚本全部通过。\n`
        : `\n${failed.length} / ${results.length} 个脚本未通过。\n`
);

process.exit(failed.length === 0 ? 0 : 1);
