/**
 * 木星历：库里的"月"到底是不是十二次？
 *
 * ## 要验的事
 *
 * 参考事实（[PanSci 太歲天文學](https://pansci.asia/archives/113512)）：
 *
 * | 量                | 值                |
 * | ----------------- | ----------------- |
 * | 木星公转（恒星）周期 | **4332.6 天 ≈ 11.862 年** |
 * | 木星会合周期（视运动）| **398.88 天 ≈ 1.09 年** |
 * | 十二次            | 黄道**均分 12 份，每份 30°** |
 * | 木星每年实际移动   | **约 31°**（不是 30°）→ 超辰 |
 *
 * 库里 `jupiter_year.lengthOfDay = 4332`、`lengthOfMonth = 12`，
 * 于是"月" = 4332 / 12 = **361 天**——那是把轨道按**时间**均分成 12 份。
 * 而十二次是按**黄经**均分成 12 份。两者只有在木星匀速运动时才等价，
 * 而木星轨道有 e = 0.0486 的偏心率，速度并非常数。
 *
 * 所以这个脚本算：库给的每个月界时刻，木星的真实黄经是不是恰好相差 30°。
 *
 * 用法：`node scripts/probe-jupiter-sidereal.mjs`
 */
import { DatabaseSync } from "node:sqlite";
import * as Astronomy from "astronomy-engine";

/** 库的 `absolute` → 真实 `Date`。 */
const EPOCH_JD = 736413.5;
const dateOfAbsolute = (absolute) => new Date((EPOCH_JD + Number(absolute) / 86_400 - 2_440_587.5) * 86_400_000);

/** 木星的地心黄经（度）。 */
const longitudeOf = (date) => {
    const vector = Astronomy.GeoVector(Astronomy.Body.Jupiter, date, true);
    const ecliptic = Astronomy.Ecliptic(vector);
    return ((ecliptic.elon % 360) + 360) % 360;
};

const db = new DatabaseSync("src/sqlite/jupiter.calendar.sqlite", { readOnly: true });

/* 取 2026 那一年（identity 1015）的全部 12 个月 */
const year = db
    .prepare('SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfDay", "start", "end" FROM jupiter_year WHERE "identity" = 1015')
    .get();
console.log("jupiter_year（含 2026 的那一年）:");
console.log(`  identity=${year.identity} relative=${year.absolute} 月数=${year.lengthOfMonth} 天数=${year.lengthOfDay}`);
console.log(`  跨度 ${Number(year.end - year.start) / 86_400} 天`);

const months = db
    .prepare('SELECT "ordinal", "name", "start", "end", "lengthOfDay" FROM jupiter_month WHERE "year" = 1015 ORDER BY "ordinal"')
    .all();

console.log(`\n该年 ${months.length} 个月，逐月看月首时刻的木星黄经：\n`);
console.log("  序  月名    天数   月首时刻的黄经    与上一月的差");

let previous = null;
let minDiff = 360;
let maxDiff = 0;

for (const month of months) {
    const date = dateOfAbsolute(month.start);
    const longitude = longitudeOf(date);
    let diffText = "—";
    if (previous !== null) {
        const diff = ((longitude - previous + 540) % 360) - 180;
        diffText = `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}°`;
        minDiff = Math.min(minDiff, diff);
        maxDiff = Math.max(maxDiff, diff);
    }
    previous = longitude;
    console.log(
        `  ${String(month.ordinal).padStart(2)}  ${String(month.name).padEnd(6)} ${String(month.lengthOfDay).padStart(4)}   ` +
            `${longitude.toFixed(2).padStart(7)}°   ${diffText}`
    );
}

console.log(`\n相邻月首的黄经差：最小 ${minDiff.toFixed(2)}°、最大 ${maxDiff.toFixed(2)}°`);
console.log(`若库里真的是"十二次"，这个差应当接近 30.00°；`);
console.log(`实际跨度 ${(maxDiff - minDiff).toFixed(2)}° 就是"按时间均分"与"按黄经均分"的偏差。`);

/* 对照：把一年按黄经均分 12 份会得到什么天数 */
console.log("\n对照：木星公转一周的实际黄经推进（从该年年初起每 30° 的时刻）");
const startDate = dateOfAbsolute(year.start);
let cursor = startDate;
console.log(`  年初黄经 ${longitudeOf(cursor).toFixed(2)}°`);
for (let step = 1; step <= 12; step += 1) {
    const target = step * 30;
    let low = 0;
    let high = 5000; // 天
    for (let iteration = 0; iteration < 40; iteration += 1) {
        const middle = (low + high) / 2;
        const at = new Date(cursor.getTime() + middle * 86_400_000);
        const advanced = ((longitudeOf(at) - longitudeOf(startDate) + 360) % 360);
        if (advanced < target) {
            low = middle;
        } else {
            high = middle;
        }
    }
    const days = (low + high) / 2;
    console.log(`  第 ${String(step).padStart(2)} 次（+${target}°）在年初后 ${days.toFixed(1)} 天（库里给的是 ${step * 361} 天）`);
}

db.close();
