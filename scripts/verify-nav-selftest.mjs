/**
 * `verify-nav.mjs` 的反向自检：确认校验**不是空转**，并划清两层的边界。
 *
 * ## 第一次运行抓到的真问题
 *
 * 最初版本的 `verify-nav.mjs` 报"全部通过"，而它其实是恒真的：
 *
 * 1. 路由表里有兜底 `/:pathMatch(.*)*`——匹配任何路径；
 * 2. `:system` 是**自由参数**，`/calendar/synodik` 在结构上完全合法。
 *
 * ## 两层的边界（这个脚本的结论）
 *
 * | 层     | 拦得住                                   | 拦不住                      |
 * | ------ | ---------------------------------------- | --------------------------- |
 * | 结构   | 段数不对、字面段不符（`/nope`、多一段）  | **参数值的拼写错**          |
 * | 取值   | `/calendar/synodik` 这类"结构合法值非法" | 需要脚本里维护取值集合      |
 *
 * 所以"参数值拼错"这一类**只能**靠取值校验拦，结构匹配必然放行它。
 * 这个脚本就按这条边界来断言，而不是假装结构匹配能拦住拼写错误。
 *
 * 用法：`node scripts/verify-nav-selftest.mjs`
 */
import { readFileSync } from "node:fs";

/** 与 `verify-nav.mjs` 同一份（那边是权威，这边是副本）。 */
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

const routerPaths = [...readFileSync("src/plugin/router.ts", "utf8").matchAll(/\bpath:\s*"([^"]*)"/g)]
    .map((match) => match[1])
    .filter((path) => !path.includes("pathMatch"));

const routes = routerPaths.map((path) => ({ path, regex: patternOf(path) }));

const structHit = (target) => routes.some((route) => route.regex.test(target));

/* -------------------------------------------------------------------------- */
/* ① 结构层：段数与字面段                                                       */
/* -------------------------------------------------------------------------- */

/** 结构上就不该匹配的。 */
const STRUCTURAL_MISS = [
    ["/nope", "没有任何两段以上的路由能匹配单段路径"],
    ["/divination/liuren/extra", "多一段，没有三段的路由覆盖它"],
    ["/library/ancient-china/extra/more", "多两段"]
];

/** 结构上必须匹配的。 */
const STRUCTURAL_HIT = [
    ["/", "根"],
    ["/calendar/natural", "参数化路由的两段形态"],
    ["/calendar/natural/year", "参数化路由的三段形态"],
    ["/agent/chat", "可选参数缺省"],
    ["/agent/chat/research", "可选参数给出"],
    ["/calendar/table/climate", "静态段优先的那一条"]
];

/**
 * **结构上会放行、但取值校验必须拦住**的。
 *
 * 这一组是这份自检存在的理由：它们证明"结构匹配"这一层
 * 单独用是不够的，必须有第二层。
 */
const VALUE_TYPOS = [
    ["/calendar/synodik", "拼错一个字母"],
    ["/astrology/bazhi", "拼音顺序错"],
    ["/sky/planes", "多一个字母"],
    ["/library/ancient-china-2", "多一个后缀"]
];

let bad = 0;

for (const [path, why] of STRUCTURAL_MISS) {
    if (structHit(path)) {
        console.error(`✗ ${path}（${why}）结构上不该匹配，却匹配上了`);
        bad += 1;
    }
}

for (const [path, why] of STRUCTURAL_HIT) {
    if (!structHit(path)) {
        console.error(`✗ ${path}（${why}）结构上应该匹配，却没匹配上`);
        bad += 1;
    }
}

/* -------------------------------------------------------------------------- */
/* ② 取值层：结构必然放行拼写错，所以必须有第二层                              */
/* -------------------------------------------------------------------------- */

for (const [path, why] of VALUE_TYPOS) {
    if (!structHit(path)) {
        console.error(`✗ ${path}（${why}）预期是"结构放行、取值拦住"，结果结构就拦住了——`);
        console.error("   说明路由表变了，这条用例的断言要跟着改（而不是当成功）");
        bad += 1;
    }
}

console.log(
    `结构错例 ${STRUCTURAL_MISS.length} 条、结构正例 ${STRUCTURAL_HIT.length} 条、` +
        `取值错例 ${VALUE_TYPOS.length} 条`
);

if (bad > 0) {
    console.error(`\n❌ ${bad} 条不符合预期`);
    process.exit(1);
}

console.log("\n✅ 结构层行为符合预期");
console.log(
    "✅ 取值错例（如 /calendar/synodik）**结构上确实放行**——\n" +
        "   这不是 bug，而是为什么 verify-nav.mjs 必须做参数取值校验。\n" +
        "   结构匹配单独用是拦不住拼写错误的。"
);
