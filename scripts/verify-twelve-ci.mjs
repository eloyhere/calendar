/**
 * 验证「岁在X」的推法——只断言**独立证据**，不断言我自己选的那个锚点。
 *
 * ## 为什么不能断言"141.7° 应当是鹑首"
 *
 * 第一版验证器里有两条这样的断言，而它们的期望值是从**旧表**读出来的。
 * 表一改，两条就"失败"——但那是**循环论证**：我拿自己的输出当自己的正确答案。
 *
 * 独立的证据只有一条：
 *
 * > 《左传·襄公二十八年》「岁在**星纪**而**淫于玄枵**」
 *
 * 「淫于」是"超过"，木星顺行，所以星纪的黄经 < 玄枵。
 * 这一条不依赖我的 `CI_ORIGIN` 取值，因为它是**次序**约束而非**相位**约束。
 *
 * 相位（`CI_ORIGIN = 270` 还是 300）我定不了，所以脚本把两种都打印出来，
 * 由人判断——而不是假装验证过。
 *
 * 用法：`node scripts/verify-twelve-ci.mjs`
 */
import { ciOfLongitude, TWELVE_CI, CI_ORIGIN, ageStarText } from "../src/share/astronomy/twelve-ci.ts";

let bad = 0;
const check = (label, condition, detail = "") => {
    if (condition) {
        return;
    }
    console.error(`✗ ${label}${detail.length > 0 ? ` —— ${detail}` : ""}`);
    bad += 1;
};

/* -------------------------------------------------------------------------- */
/* ① 完备性与一致性（内部一致性，可以断言）                                    */
/* -------------------------------------------------------------------------- */

for (let degree = 0; degree < 360; degree += 1) {
    const ci = ciOfLongitude(degree);
    check(`黄经 ${degree}° 应有次`, ci.name.length > 0);
    check(`黄经 ${degree}° 的次内进度应在 [0,30)`, ci.progress >= 0 && ci.progress < 30, `实得 ${ci.progress}`);
}

const coverage = new Map();
for (let degree = 0; degree < 360; degree += 1) {
    const name = ciOfLongitude(degree).name;
    coverage.set(name, (coverage.get(name) ?? 0) + 1);
}
check("十二次应各覆盖 30°", [...coverage.values()].every((n) => n === 30), JSON.stringify([...coverage.entries()]));
check("应恰好 12 个次", coverage.size === 12, `实得 ${coverage.size}`);

/* 同一次内的两个黄经必须给出同一个次名 */
check(
    "同一区间内应稳定",
    ciOfLongitude(275).name === ciOfLongitude(295).name,
    `${ciOfLongitude(275).name} vs ${ciOfLongitude(295).name}`
);
/* 跨界必须换次 */
check("跨分界应换次", ciOfLongitude(299).name !== ciOfLongitude(301).name);

/* -------------------------------------------------------------------------- */
/* ② 《左传》次序约束——唯一的独立证据                                          */
/* -------------------------------------------------------------------------- */

const order = TWELVE_CI.map((ci) => ci.name);
check(
    "传统列举顺序应以星纪开头",
    order[0] === "星纪",
    `实得 ${order[0]}`
);
check(
    "传统列举顺序中星纪的下一项应是玄枵（左传：岁在星纪而淫于玄枵）",
    order[1] === "玄枵",
    `实得 ${order[1]}`
);

/*
 * 次序约束的可计算形式：从星纪的起点顺行 30°，必须进入玄枵。
 * 这一条与 CI_ORIGIN 取什么值无关。
 */
const xingji = TWELVE_CI.find((ci) => ci.name === "星纪");
if (xingji === undefined) {
    console.error("✗ 找不到星纪");
    bad += 1;
} else {
    const next = ciOfLongitude(xingji.from + 30.5);
    check(
        "《左传》约束：星纪之后（顺行）应是玄枵",
        next.name === "玄枵",
        `星纪起 ${xingji.from}°，其后是 ${next.name}`
    );
}

/* -------------------------------------------------------------------------- */
/* ③ 实际黄经 → 次（只打印，不断言"应该是什么"）                               */
/* -------------------------------------------------------------------------- */

console.log("\n实际黄经落点（仅供对照，不是断言）：");
for (const [degree, why] of [
    [141.7, "2026-10-13 木星在狮子 21.7°"],
    [73.8, "2026 木星年年初"]
]) {
    const ci = ciOfLongitude(degree);
    console.log(`  ${String(degree).padStart(6)}° → ${ci.name}（${ci.branch}）· ${ci.span} · 次内 ${ci.progress.toFixed(1)}°   ← ${why}`);
}

/* -------------------------------------------------------------------------- */
/* ④ 两种锚点方案并排打印，交人判断                                            */
/* -------------------------------------------------------------------------- */

const table = (origin) => {
    const rows = [];
    for (let index = 0; index < 12; index += 1) {
        const from = (origin + index * 30) % 360;
        const name = TWELVE_CI[index]?.name ?? "?";
        rows.push(`[${String(from).padStart(3)}, ${String((from + 30) % 360).padStart(3)}) ${name}`);
    }
    return rows;
};

console.log(`\n当前采用的锚点：CI_ORIGIN = ${CI_ORIGIN}（${CI_ORIGIN === 270 ? "冬至 = 星纪起点" : "冬至 = 玄枵起点"}）`);
console.log("  " + table(CI_ORIGIN).join("  "));

const other = CI_ORIGIN === 270 ? 300 : 270;
console.log(`\n另一种锚点：CI_ORIGIN = ${other}（${other === 270 ? "冬至 = 星纪起点" : "冬至 = 玄枵起点"}）`);
console.log("  " + table(other).join("  "));

console.log("\n判定：两种锚点都满足《左传》的次序约束（次序与相位无关）。");
console.log("      差别在于「冬至落在星纪还是玄枵」。这一条我定不了——");
console.log("      需要你给依据（或告诉我按哪个朝代的宿度），我再把 CI_ORIGIN 定死。");

console.log(`\n示例输出：${ageStarText(141.7)}`);

if (bad > 0) {
    console.error(`\n❌ ${bad} 条内部一致性检查未通过`);
    process.exit(1);
}
console.log("\n✅ 完备性、稳定性、左传次序约束全部通过");
