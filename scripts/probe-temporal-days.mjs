/**
 * 确认能不能从 `temporal` 里按天取到一行。
 *
 * `temporal` 存的不是"每秒一行"，而是**事件时刻**（10,734,114 行，其中
 * `seconds = 0` 只是每月月初那几条）。日历要的是"每天一行"，所以得按
 * `year / month / day` 分组取最小 `absolute`。
 *
 * 这个脚本验证两件事：
 *   1. 每一天在表里都至少有一行（否则日历会有空洞）；
 *   2. 分组取 `MIN("absolute")` 得到的时刻就是当天的日界。
 *
 * 用法：`node scripts/probe-temporal-days.mjs`
 */
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("src/sqlite/temporal.sqlite", { readOnly: true });
const sql = (text) => db.prepare(text);

console.log("总行数", sql("SELECT COUNT(*) AS n FROM temporal").get().n);
console.log("seconds = 0 的行数", sql('SELECT COUNT(*) AS n FROM temporal WHERE "seconds" = 0').get().n);

/* 2026 年 10 月每一天 */
const october = sql(
    'SELECT MIN("absolute") AS a, "day" FROM temporal WHERE "year" = 2026 AND "month" = 10 GROUP BY "day" ORDER BY a'
).all();
console.log(`\n2026 年 10 月：${october.length} 天`);
console.log("  日期 " + october.map((row) => row.day).join(","));

/* 缺口检查：日期应该是 1..N 的连续序列 */
const days = october.map((row) => Number(row.day));
const gaps = [];
for (let index = 1; index < days.length; index += 1) {
    if (days[index] !== days[index - 1] + 1) {
        gaps.push(`${days[index - 1]}→${days[index]}`);
    }
}
console.log(gaps.length === 0 ? "  ✅ 连续" : `  ❌ 有缺口：${gaps.join(" ")}`);

/* 日界检查：同一天里最小的 absolute 应当落在 0 点（secs 分量接近 0） */
console.log("\n每天的日界（当天最早一行的秒内偏移）：");
for (const row of october.slice(0, 6)) {
    const absolute = BigInt(row.a);
    const seconds = Number(((absolute % 86_400n) + 86_400n) % 86_400n);
    const hour = Math.floor(seconds / 3600);
    const minute = Math.floor((seconds % 3600) / 60);
    console.log(`  ${row.day} 日  absolute=${absolute}  日内 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}

/* 跨年的一段：某个闰年 2 月，验证没有跳日 */
console.log("\n2024 年 2 月：");
const feb = sql(
    'SELECT MIN("absolute") AS a, "day" FROM temporal WHERE "year" = 2024 AND "month" = 2 GROUP BY "day" ORDER BY a'
).all();
console.log(`  ${feb.length} 天：${feb.map((row) => row.day).join(",")}`);

/* 建元那一年 */
console.log("\n-2696 年 3 月：");
const epoch = sql(
    'SELECT MIN("absolute") AS a, "day" FROM temporal WHERE "year" = -2696 AND "month" = 3 GROUP BY "day" ORDER BY a'
).all();
console.log(`  ${epoch.length} 天：${epoch.map((row) => row.day).join(",")}`);

db.close();
