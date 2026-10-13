/**
 * 用**纯扫描 + 黄金分割细化**找合日，不依赖 `Astronomy.Search`。
 *
 * ## 为什么放弃 `Search`
 *
 * 这版 astronomy-engine 的 `Search(func, t1, t2, options)` 在我传 `Date` 时
 * 抛出的错误连 `message` 都是 `undefined`；带与不带 options 都一样。
 * 与其猜它的参数约定，不如自己扫——相位函数是现成的，
 * 而"找 |相位| 的局部极小"这件事不需要库。
 *
 * ## 扫描法
 *
 * 1. 粗扫：每天取一次相位（0–360），算到 0° 的**环形距离**
 *    `d = min(相位, 360 − 相位)`；
 * 2. 找 `d` 的局部极小（比左右邻都小）；
 * 3. 极小点两侧各 1 天用黄金分割细化到 1e-4 天。
 *
 * 逆行不影响这个做法：`d` 是相位的环形距离，与相位是否单调无关。
 * 上一版手写"相位从 >180 跳到 <180"的判据会在逆行段误触发，
 * 实测出现过三个 0.000 天的假间隔。
 *
 * 用法：`node scripts/probe-jupiter-conjunction.mjs`
 */
import * as Astronomy from "astronomy-engine";

const helioLon = (body, date) => {
    const ecliptic = Astronomy.Ecliptic(Astronomy.HelioVector(body, date));
    return ((ecliptic.elon % 360) + 360) % 360;
};

/** 地球与木星的日心黄经差（度）。0 = 合日，180 = 冲日。 */
const phase = (date) =>
    ((helioLon(Astronomy.Body.Jupiter, date) - helioLon(Astronomy.Body.Earth, date)) % 360 + 360) % 360;

/** 到合日的环形距离（度），越小越接近合日。 */
const distance = (date) => {
    const angle = phase(date);
    return Math.min(angle, 360 - angle);
};

const DATE = (jd) => new Date((jd - 2_440_587.5) * 86_400_000);

/** 黄金分割：在 `[low, high]` 内找 `distance` 的极小。 */
const refine = (low, high) => {
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

const START_JD = 2451544.5;
const SPAN = 4400;

const samples = [];
for (let day = 0; day <= SPAN; day += 1) {
    samples.push(distance(DATE(START_JD + day)));
}

const minima = [];
for (let day = 1; day < samples.length - 1; day += 1) {
    if (samples[day] < samples[day - 1] && samples[day] < samples[day + 1]) {
        minima.push(refine(START_JD + day - 1, START_JD + day + 1));
    }
}

console.log(`${SPAN} 天内找到 ${minima.length} 次合日：\n`);
console.log("  序  儒略日        日期         相位      距上次（天）");

const gaps = [];
for (let index = 0; index < minima.length; index += 1) {
    const jd = minima[index];
    const gap = index === 0 ? null : jd - minima[index - 1];
    if (gap !== null) {
        gaps.push(gap);
    }
    console.log(
        `  ${String(index + 1).padStart(2)}  ${jd.toFixed(3).padStart(11)}  ${DATE(jd).toISOString().slice(0, 10)}  ` +
            `${phase(DATE(jd)).toFixed(3).padStart(8)}°  ${gap === null ? "—" : gap.toFixed(3).padStart(9)}`
    );
}

if (gaps.length > 0) {
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    console.log(`\n间隔平均 ${average.toFixed(4)} 天（模块常数 398.884）`);
    console.log(`最短 ${Math.min(...gaps).toFixed(3)}、最长 ${Math.max(...gaps).toFixed(3)}`);
    console.log(`\n建议历元（第一次合日）：JD ${minima[0].toFixed(1)}`);
}

/* 恒星周期：日心黄经回到基准 */
console.log("\n木星恒星周期（日心黄经回到基准，纯扫描）：");
const base = helioLon(Astronomy.Body.Jupiter, DATE(START_JD));
const lonDistance = (date) => {
    const delta = ((helioLon(Astronomy.Body.Jupiter, date) - base) % 360 + 360) % 360;
    return Math.min(delta, 360 - delta);
};

const crossings = [];
for (let day = 4000; day <= 4700; day += 1) {
    const previous = lonDistance(DATE(START_JD + day - 1));
    const current = lonDistance(DATE(START_JD + day));
    const next = lonDistance(DATE(START_JD + day + 1));
    if (current < previous && current < next) {
        crossings.push(START_JD + day);
    }
}

for (const jd of crossings) {
    console.log(
        `  ${DATE(jd).toISOString().slice(0, 10)}  距基准 ${(jd - START_JD).toFixed(1)} 天  黄经差 ${lonDistance(DATE(jd)).toFixed(3)}°`
    );
}
if (crossings.length >= 2) {
    console.log(`  相邻两次回归之间 = ${(crossings[1] - crossings[0]).toFixed(1)} 天（应为 4332.6）`);
}
