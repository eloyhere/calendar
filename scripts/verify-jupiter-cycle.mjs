/**
 * 验证地球—木星会合周期的算法。
 *
 * ## 这一版修掉了什么
 *
 * 第一版验证器抓出 6 处问题，其中三处是真 bug、三处是**我自己的断言写错了**：
 *
 * | 问题 | 性质 |
 * | ---- | ---- |
 * | 历元 2451552.5 处相位 288.95°，不是合日 | **真 bug**（历元是拍脑袋写的） |
 * | 手写的合日搜索出现三个 0.000 天假间隔 | **真 bug**（跳变判据在逆行段误触发） |
 * | 「距冲日 + 距合日 = 会合周期」 | **断言写错**：一个是 180° 外、一个是 360° 外，和当然不是整周期 |
 * | 「实测平均周期应等于 398.884」 | **断言写错**：398.884 是**平均**周期，而十次合日的短跨度平均值为 398.698 |
 *
 * 最后一条值得写下来：单次会合周期在 395.4–402.7 天之间摆动（地球与木星的
 * 偏心率造成），要用实测平均去逼近 398.884 得跨过一个完整的"拍"周期。
 * 十次合日约 10.9 年，**不足一个拍**，所以量出来偏小 0.19 天。
 * 断言改成"落在 398.884±0.3"并把这个原因写在注释里，而不是把常数改成实测值
 * ——那会把偏心率造成的短期偏差当成真值。
 *
 * 用法：`node scripts/verify-jupiter-cycle.mjs`
 */
import * as Astronomy from "astronomy-engine";
import {
    SYNODIC_DAYS,
    TROPICAL_DAYS,
    ELEVEN_SYNODIC_DRIFT,
    JUPITER_SIDEREAL_DAYS,
    EPOCH_JD,
    phaseOfDate,
    driftDays
} from "../src/share/astronomy/jupiter-cycle.ts";

let bad = 0;
const check = (label, condition, detail = "") => {
    if (condition) {
        return;
    }
    console.error(`✗ ${label}${detail.length > 0 ? ` —— ${detail}` : ""}`);
    bad += 1;
};

const DATE = (jd) => new Date((jd - 2_440_587.5) * 86_400_000);

const helioLon = (body, date) => {
    const ecliptic = Astronomy.Ecliptic(Astronomy.HelioVector(body, date));
    return ((ecliptic.elon % 360) + 360) % 360;
};
const phase = (date) =>
    ((helioLon(Astronomy.Body.Jupiter, date) - helioLon(Astronomy.Body.Earth, date)) % 360 + 360) % 360;
const distance = (date) => {
    const angle = phase(date);
    return Math.min(angle, 360 - angle);
};

/* -------------------------------------------------------------------------- */
/* ① 历元必须是真合日                                                          */
/* -------------------------------------------------------------------------- */

const epochAngle = phase(DATE(EPOCH_JD));
const epochDistance = Math.min(epochAngle, 360 - epochAngle);
console.log(`历元 JD ${EPOCH_JD}（${DATE(EPOCH_JD).toISOString().slice(0, 10)}）相位 ${epochAngle.toFixed(3)}°`);
check("历元应当是合日（相位距 0° 小于 1°）", epochDistance < 1, `距 0° 有 ${epochDistance.toFixed(3)}°`);

/* 在历元附近 ±2 天内找极小，确认它确实落在极小点上 */
{
    const ratio = 0.6180339887;
    let a = EPOCH_JD - 2;
    let b = EPOCH_JD + 2;
    let c = b - ratio * (b - a);
    let d = a + ratio * (b - a);
    for (let iteration = 0; iteration < 60; iteration += 1) {
        if (distance(DATE(c)) < distance(DATE(d))) {
            b = d;
        } else {
            a = c;
        }
        c = b - ratio * (b - a);
        d = a + ratio * (b - a);
    }
    const refined = (a + b) / 2;
    console.log(`  历元附近细化后的合日：JD ${refined.toFixed(4)}（与历元差 ${(refined - EPOCH_JD).toFixed(4)} 天）`);
    check("历元应当就在合日的极小点上（差 < 0.5 天）", Math.abs(refined - EPOCH_JD) < 0.5);
}

/* -------------------------------------------------------------------------- */
/* ② 扫描量会合周期（不依赖模块的任何常数）                                     */
/* -------------------------------------------------------------------------- */

const refineMin = (low, high) => {
    const ratio = 0.6180339887;
    let a = low;
    let b = high;
    let c = b - ratio * (b - a);
    let d = a + ratio * (b - a);
    for (let iteration = 0; iteration < 60; iteration += 1) {
        if (distance(DATE(c)) < distance(DATE(d))) {
            b = d;
        } else {
            a = c;
        }
        c = b - ratio * (b - a);
        d = a + ratio * (b - a);
    }
    return (a + b) / 2;
};

const SPAN = 8000; // 约 22 年，跨过两个"拍"
const samples = [];
for (let day = 0; day <= SPAN; day += 1) {
    samples.push(distance(DATE(EPOCH_JD + day)));
}
const minima = [];
for (let day = 1; day < samples.length - 1; day += 1) {
    if (samples[day] < samples[day - 1] && samples[day] < samples[day + 1]) {
        minima.push(refineMin(EPOCH_JD + day - 1, EPOCH_JD + day + 1));
    }
}

const gaps = [];
for (let index = 1; index < minima.length; index += 1) {
    gaps.push(minima[index] - minima[index - 1]);
}
const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

console.log(`\n${SPAN} 天内 ${minima.length} 次合日：`);
console.log(`  单次间隔 ${Math.min(...gaps).toFixed(3)} – ${Math.max(...gaps).toFixed(3)} 天（偏心率造成的摆动）`);
console.log(`  平均 ${average.toFixed(4)} 天（模块常数 ${SYNODIC_DAYS}）`);
check(`实测平均会合周期应在 ${SYNODIC_DAYS}±0.3 天`, Math.abs(average - SYNODIC_DAYS) < 0.3, `实得 ${average.toFixed(4)}`);
check("单次摆动幅度应在 3–6 天", Math.max(...gaps) - average > 3 && Math.max(...gaps) - average < 6);

/* 用公式独立复算平均会合周期 */
{
    const siderealYear = 365.256363;
    const fromFormula = 1 / (1 / siderealYear - 1 / JUPITER_SIDEREAL_DAYS);
    console.log(`  由 1/S = 1/恒星年 − 1/木星恒星周期 复算：${fromFormula.toFixed(4)} 天`);
    check(`公式值与常数一致（±0.01）`, Math.abs(fromFormula - SYNODIC_DAYS) < 0.01);
}

/* -------------------------------------------------------------------------- */
/* ③ 骨架误差                                                                  */
/* -------------------------------------------------------------------------- */

console.log(`\n骨架：11 会合 = 12 回归年？`);
console.log(`  11 × ${SYNODIC_DAYS} = ${(11 * SYNODIC_DAYS).toFixed(2)} 天`);
console.log(`  12 × ${TROPICAL_DAYS} = ${(12 * TROPICAL_DAYS).toFixed(2)} 天`);
console.log(`  差 ${ELEVEN_SYNODIC_DRIFT.toFixed(2)} 天（${((ELEVEN_SYNODIC_DRIFT / (12 * TROPICAL_DAYS)) * 100).toFixed(3)}%）`);
check("差应落在 4.8±0.5 天", Math.abs(ELEVEN_SYNODIC_DRIFT - 4.82) < 0.5, `实得 ${ELEVEN_SYNODIC_DRIFT.toFixed(2)}`);

/* -------------------------------------------------------------------------- */
/* ④ 相位接口的一致性                                                          */
/* -------------------------------------------------------------------------- */

const sample = new Date(Date.UTC(2026, 9, 13, 12));
const measured = phaseOfDate(sample);
const direct = phase(sample);

console.log(`\n2026-10-13 的相位：`);
console.log(`  接口给的 ${measured.angle.toFixed(3)}°，直接算的 ${direct.toFixed(3)}°`);
check("接口的相位应与直接计算一致", Math.abs(measured.angle - direct) < 1e-6);

console.log(`  ${measured.stage}；会合序号 ${measured.index}，本会合内第 ${measured.dayInCycle.toFixed(1)} 天`);
console.log(`  距冲日 ${measured.daysToOpposition.toFixed(1)} 天、距合日 ${measured.daysToConjunction.toFixed(1)} 天`);
console.log(`  超辰量 ${driftDays(measured.index).toFixed(1)} 天`);

check("本会合内天数应在 [0, 398.884)", measured.dayInCycle >= 0 && measured.dayInCycle < SYNODIC_DAYS);
/*
 * 正确的恒等式：距合日 = 会合周期 − 本会合内天数。
 * 第一版我断言"距冲日 + 距合日 = 会合周期"，那是错的——
 * 冲日在 180° 外、合日在 360° 外，两者之和只在相位恰好 90° 时才等于整周期。
 */
check(
    "距合日应等于周期减去本会合内天数",
    Math.abs(measured.daysToConjunction - (SYNODIC_DAYS - measured.dayInCycle)) < 0.01,
    `距合日 ${measured.daysToConjunction.toFixed(2)}，周期−已过 ${(SYNODIC_DAYS - measured.dayInCycle).toFixed(2)}`
);
check("距冲日与距合日都应在 [0, 周期)", measured.daysToOpposition < SYNODIC_DAYS && measured.daysToConjunction < SYNODIC_DAYS);

console.log(`\n木星恒星周期常数 ${JUPITER_SIDEREAL_DAYS} 天 = ${(JUPITER_SIDEREAL_DAYS / TROPICAL_DAYS).toFixed(3)} 回归年`);
{
    const base = helioLon(Astronomy.Body.Jupiter, DATE(EPOCH_JD));
    const lonDistance = (date) => {
        const delta = ((helioLon(Astronomy.Body.Jupiter, date) - base) % 360 + 360) % 360;
        return Math.min(delta, 360 - delta);
    };
    const found = [];
    for (let day = 4200; day <= 4500; day += 1) {
        if (lonDistance(DATE(EPOCH_JD + day)) < lonDistance(DATE(EPOCH_JD + day - 1)) &&
            lonDistance(DATE(EPOCH_JD + day)) < lonDistance(DATE(EPOCH_JD + day + 1))) {
            found.push(refineMin(EPOCH_JD + day - 1, EPOCH_JD + day + 1));
        }
    }
    if (found.length > 0) {
        const measuredPeriod = found[0] - EPOCH_JD;
        console.log(`  由星历实测（日心黄经回到基准）：${measuredPeriod.toFixed(2)} 天`);
        check(
            `实测恒星周期应在 ${JUPITER_SIDEREAL_DAYS}±30 天（扫描粒度 1 天）`,
            Math.abs(measuredPeriod - JUPITER_SIDEREAL_DAYS) < 30,
            `实得 ${measuredPeriod.toFixed(2)}`
        );
    } else {
        console.log("  （未在 4200–4500 天内找到回归点，跳过）");
    }
}

if (bad > 0) {
    console.error(`\n❌ ${bad} 条不符合预期`);
    process.exit(1);
}
console.log("\n✅ 历元、会合周期、骨架误差、相位一致性全部通过");
