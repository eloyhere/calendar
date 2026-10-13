/**
 * 构建期校验：领域登记表里的每条路径都**真的**指向一个存在的页面。
 *
 * ## 为什么需要它（以及为什么第一版是废的）
 *
 * 运行时 `verifyDomainRoutes()` 只警告不抛错（配置错误不该让应用白屏），
 * 所以构建期要有一道硬拦截。
 *
 * 但第一版**是空转的**，由 `scripts/verify-nav-selftest.mjs` 发现：
 *
 * 1. 路由表里有兜底 `/:pathMatch(.*)*`，它匹配**任何**路径——
 *    于是"每条路径都能匹配"这句话恒真；
 * 2. 更根本的是：`/calendar/:system/:view?` 里的 `:system` 是**自由参数**，
 *    任何字符串都能填。所以 `/calendar/synodik`（拼错一个字母）
 *    在结构上完全合法，而运行时 `systemOf("synodik")` 返回 `undefined`，
 *    页面显示"没有这套历法"。
 *
 * 这正是这道校验**本来要拦**的一类错误。结论：只做结构匹配没用，
 * 必须**校验参数的值**落在登记表里。
 *
 * ## 做法
 *
 * 1. 排除兜底路由；
 * 2. 对参数化路由，把参数值与该参数允许的取值集合比对——
 *    集合从登记表源码里解析（`:system` 取 `entity/calendar.ts` 的 `id`，
 *    `:page` 取该域在 `entity/domain.ts` 里声明的页面路径最后一段）。
 *
 * 参数名到取值来源的映射写在下面的 `PARAM_VALUES`。新增参数化路由时
 * 要在这里补一条——不补的话那条路由的参数不受校验（脚本会打印提醒）。
 *
 * 用法：`node scripts/verify-nav.mjs`
 */

import { readFileSync } from "node:fs";

/** 抽所有 `path: "..."` 字面量。 */
const pathsOf = (file) =>
    [...readFileSync(file, "utf8").matchAll(/\bpath:\s*"([^"]*)"/g)].map((match) => match[1]);

/** 抽所有双引号字符串（用于取 id 集合）。 */
const stringsOf = (file, pattern) =>
    [...readFileSync(file, "utf8").matchAll(pattern)].map((match) => match[1]);

/** 一条注册路径 → 正则（镜像 `plugin/menu.ts` 的 `patternOf`）。 */
function patternOf(path) {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const parts = [];

    for (const segment of segments) {
        const optional = segment.endsWith("?");
        const name = optional ? segment.slice(0, -1) : segment;

        if (name.startsWith(":")) {
            if (name.includes("(") || segment.endsWith("*")) {
                parts.push("(?:/.*)?");
                continue;
            }
            parts.push(optional ? "(?:/[^/]+)?" : "/[^/]+");
        } else {
            parts.push(`/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
        }
    }

    return new RegExp(`^${parts.join("") || "/"}/?$`);
}

/* -------------------------------------------------------------------------- */
/* 参数取值集合                                                                */
/* -------------------------------------------------------------------------- */

/** 八套历法的 id（含年表）。 */
const SYSTEM_IDS = stringsOf("src/entity/calendar.ts", /\bid:\s*"([a-z-]+)"/g);

/** 各域的页面路径最后一段，按域前缀分组。 */
const registryPaths = pathsOf("src/entity/domain.ts");

/**
 * 参数名 → 允许的取值。
 *
 * `:system` 出现在 `/calendar/:system/:view?` 与 `/calendar/table/:system`；
 * `:page` 出现在五个域的参数化路由上，取值集合按**域前缀**分别算。
 */
const PARAM_VALUES = {
    system: new Set(SYSTEM_IDS),
    page: null // 见下：按域前缀动态算
};

/** 从登记表路径里取某个域前缀下的页面名。 */
function pagesUnder(prefix) {
    return new Set(
        registryPaths
            .filter((path) => path.startsWith(`${prefix}/`))
            .map((path) => path.slice(prefix.length + 1).split("/")[0])
    );
}

/** `:page` 的取值集合按域前缀分别检查。 */
const PAGE_DOMAINS = ["/astrology", "/divination", "/sky", "/history", "/library", "/data", "/system", "/chronology"];

/* -------------------------------------------------------------------------- */
/* 校验                                                                        */
/* -------------------------------------------------------------------------- */

const routerPaths = pathsOf("src/plugin/router.ts").filter(
    // 兜底路由匹配任何东西，参与匹配就等于取消校验
    (path) => !path.includes("pathMatch")
);

console.log(`路由表 ${routerPaths.length} 条 path（已排除兜底），领域登记表 ${registryPaths.length} 条 path`);

if (registryPaths.length === 0 || routerPaths.length === 0) {
    console.error("❌ 一条 path 都没解出来——文件结构变了，本脚本要跟着改");
    process.exit(1);
}

const routes = routerPaths.map((path) => ({
    path,
    regex: patternOf(path),
    /** 参数名按出现顺序 */
    params: path
        .split("/")
        .filter((segment) => segment.startsWith(":"))
        .map((segment) => segment.replace(/^:/, "").replace(/\?$/, "").replace(/\(.*$/, ""))
}));

const problems = [];
const uncheckedParams = new Set();

for (const target of registryPaths) {
    const segments = target.split("/").filter((segment) => segment.length > 0);

    // 至少能被一条**非兜底**路由匹配上
    const candidates = routes.filter((route) => route.regex.test(target));
    if (candidates.length === 0) {
        problems.push(`${target} —— 没有任何路由能匹配`);
        continue;
    }

    /*
     * 校验参数取值。
     *
     * 参数值 = 路由模板里该参数所在段的**位置**在目标路径上的那一段。
     * 例：模板 `/calendar/:system/:view?` 的第 2 段是 `:system`，
     * 目标 `/calendar/natural` 的第 2 段是 `natural`。
     */
    let ok = false;
    for (const route of candidates) {
        const template = route.path.split("/").filter((segment) => segment.length > 0);
        let allGood = true;

        for (let index = 0; index < template.length; index += 1) {
            const segment = template[index];
            if (!segment.startsWith(":")) {
                continue;
            }
            const name = segment.replace(/^:/, "").replace(/\?$/, "").replace(/\(.*$/, "");
            const value = segments[index];
            if (value === undefined) {
                continue; // 可选参数没给
            }

            let allowed = null;
            if (name === "system") {
                allowed = PARAM_VALUES.system;
            } else if (name === "page") {
                const prefix = `/${segments[0]}`;
                if (PAGE_DOMAINS.includes(prefix)) {
                    allowed = pagesUnder(prefix);
                }
            } else {
                uncheckedParams.add(name);
            }

            if (allowed !== null && !allowed.has(value)) {
                allGood = false;
                break;
            }
        }

        if (allGood) {
            ok = true;
            break;
        }
    }

    if (!ok) {
        problems.push(`${target} —— 结构能匹配，但参数值不在登记表里（例如 :system 没有这一项）`);
    }
}

if (uncheckedParams.size > 0) {
    console.log(
        `ℹ️  这些参数没有取值校验（新增时请在脚本的 PARAM_VALUES 里补一条）：${[...uncheckedParams].join("、")}`
    );
}

if (problems.length === 0) {
    console.log(`✅ ${registryPaths.length} 条路径全部通过结构匹配与参数取值校验`);
    process.exit(0);
}

console.error(`\n❌ ${problems.length} 条路径有问题：`);
for (const line of problems) {
    console.error(`   ${line}`);
}
console.error("\n修法：在 src/plugin/router.ts 里加路由，或改正 src/entity/domain.ts 里的路径与参数。");
process.exit(1);
