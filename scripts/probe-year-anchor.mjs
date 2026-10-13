/**
 * 核对干支纪年的锚点，以及各历法「自己那一年」到底是什么。
 *
 * ## 为什么要查
 *
 * 用户指出两处数据错误：
 *   1. 界面把 2026 显示成**辛丑年**，而 2026 应是**丙午年**；
 *   2. 天文历与格里高利历的年份也显示成 **4722/4723**，那两套历法不该用
 *      轩辕历的年号。
 *
 * 两个问题都指向同一件事：**各历法的 `*_year.relative` 不是"年号"**，
 * 它只是该表内的相对序号。界面直接把它当作年份显示，是错的。
 *
 * 这个脚本把每个 `*_year` 表的第 1 行与"含 2026 年"那一行都打出来，
 * 以便看清 `relative` 从哪起算、以及有没有别的列能给出真正的年份。
 *
 * 用法：`node scripts/probe-year-anchor.mjs`
 */
import { DatabaseSync } from "node:sqlite";

const ANCHOR = 149_029_632_000n; // 2026-10-01

const SYSTEMS = [
    ["natural", "natural.calendar.sqlite", "natural_year", "natural_month"],
    ["synodic", "synodic.sqlite", "synodic_calendar_year", "synodic_month"],
    ["gregory", "gregory.calendar.sqlite", "gregory_year", "gregory_month"],
    ["astronomy", "astronomy.calendar.sqlite", "astronomy_year", "astronomy_month"],
    ["jupiter", "jupiter.calendar.sqlite", "jupiter_year", "jupiter_month"],
    ["tropical", "tropical.calendar.sqlite", "tropical_year", "tropical_month"],
    ["tree", "tree.calendar.sqlite", "tree_year", "tree_month"],
    ["climate", "climate.sqlite", "climate_year", "climate_month"]
];

for (const [id, file, yearTable, monthTable] of SYSTEMS) {
    const db = new DatabaseSync(`src/sqlite/${file}`, { readOnly: true });
    const cols = db
        .prepare(`PRAGMA table_info("${yearTable}")`)
        .all()
        .map((c) => c.name);

    const first = db.prepare(`SELECT * FROM "${yearTable}" ORDER BY "start" LIMIT 1`).get();
    const at2026 = db.prepare(`SELECT * FROM "${yearTable}" WHERE "start" <= :a AND "end" >= :a LIMIT 1`).get({ a: ANCHOR });
    const month = db
        .prepare(`SELECT * FROM "${monthTable}" WHERE "start" <= :a AND "end" >= :a LIMIT 1`)
        .get({ a: ANCHOR });

    console.log(`\n===== ${id} =====`);
    console.log(`  ${yearTable} 列: ${cols.join(", ")}`);
    console.log(`  首行: ${JSON.stringify(first, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    console.log(`  2026: ${JSON.stringify(at2026, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    console.log(`  当月: ${JSON.stringify(month, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    db.close();
}

/* 干支：把"已知年份 → 正确干支"列出来，供比对 */
console.log("\n===== 已知干支（用于比对）=====");
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
/** 已知：1984 = 甲子。等价于 index = (year + 2696) mod 60（因 1984+2696=4680=78×60）。 */
const ganzhiOf = (year) => {
    const n = (((year + 2696) % 60) + 60) % 60;
    return `${STEMS[n % 10]}${BRANCHES[n % 12]}`;
};
for (const year of [-2696, 1, 1900, 1984, 2000, 2020, 2024, 2025, 2026, 2027]) {
    console.log(`  ${String(year).padStart(6)} → ${ganzhiOf(year)}`);
}

/* tree_year 的 relative 与公历年的对应 */
console.log("\n===== tree_year.relative 与公历年 =====");
const tree = new DatabaseSync("src/sqlite/tree.calendar.sqlite", { readOnly: true });
for (const rel of [1, 2, 3, 4717, 4718, 4719, 4722, 4723]) {
    const row = tree.prepare('SELECT "relative", "start", "end", "lengthOfDay" FROM tree_year WHERE "relative" = :r LIMIT 1').get({ r: rel });
    if (row === undefined) {
        console.log(`  relative=${rel} 无行`);
        continue;
    }
    // 用 gregory_month 反查公历年
    const g = new DatabaseSync("src/sqlite/gregory.calendar.sqlite", { readOnly: true });
    const gm = g.prepare('SELECT "year", "ordinal" FROM gregory_month WHERE "start" <= :a AND "end" >= :a LIMIT 1').get({ a: row.start });
    console.log(`  relative=${rel} → 公历 ${gm === undefined ? "?" : gm.year - 10000} 年 ${gm === undefined ? "" : gm.ordinal} 月（该公历年应为 ${gm === undefined ? "?" : ganzhiOf(gm.year - 10000)}）`);
    g.close();
}
tree.close();
