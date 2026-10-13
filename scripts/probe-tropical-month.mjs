/**
 * 核对：本历月的月首落在哪一格，以及「月内第 N 天」算得对不对。
 *
 * 截图里页头写「月内第 5 天」，而格子上的「八月」标在 10 月 8 日那一格——
 * 若月首是 10 月 9 日，则两者差一天。这个脚本从库里直接算，判定谁对。
 *
 * 用法：`node scripts/probe-tropical-month.mjs`
 */
import { DatabaseSync } from "node:sqlite";

const gregory = new DatabaseSync("src/sqlite/gregory.calendar.sqlite", { readOnly: true });
const tropical = new DatabaseSync("src/sqlite/tropical.calendar.sqlite", { readOnly: true });

/** 2026-10-13 的 absolute（由 gregory_month 查得 10 月首 + 12 天）。 */
const october = gregory
    .prepare('SELECT "start", "lengthOfDay" FROM gregory_month WHERE "year" = :y AND "ordinal" = 10')
    .get({ y: 12_026 });

const dayOf = (ordinal) => BigInt(october.start) + BigInt(ordinal - 1) * 86_400n;

console.log("公历 2026 年 10 月，逐日看它落在哪个回归月：\n");
console.log("  公历日   回归月     月内第几天   是不是月首");

for (let ordinal = 1; ordinal <= 14; ordinal += 1) {
    const absolute = dayOf(ordinal);
    const month = tropical
        .prepare('SELECT "name", "start", "end", "lengthOfDay" FROM tropical_month WHERE "start" <= :a AND "end" >= :a LIMIT 1')
        .get({ a: absolute });
    const inMonth = Number((absolute - BigInt(month.start)) / 86_400n) + 1;
    console.log(
        `  ${String(ordinal).padStart(4)}   ${String(month.name).padEnd(8)} ${String(inMonth).padStart(6)}       ${inMonth === 1 ? "← 月首" : ""}`
    );
}

console.log("\n页头写的是「月内第 5 天」，若今天（10 月 13 日）应出现在上表哪一行？");
const today = dayOf(13);
const month = tropical
    .prepare('SELECT "name", "start" FROM tropical_month WHERE "start" <= :a AND "end" >= :a LIMIT 1')
    .get({ a: today });
console.log(`  10 月 13 日在「${month.name}」的第 ${Number((today - BigInt(month.start)) / 86_400n) + 1} 天`);

/* 月首对应的公历日 */
const first = tropical
    .prepare('SELECT "name", "start" FROM tropical_month WHERE "start" <= :a AND "end" >= :a LIMIT 1')
    .get({ a: today });
const gAtStart = gregory
    .prepare('SELECT "ordinal", "start" FROM gregory_month WHERE "start" <= :a AND "end" >= :a LIMIT 1')
    .get({ a: first.start });
console.log(
    `  「${first.name}」的月首落在公历 ${gAtStart.ordinal} 月 ${Number((BigInt(first.start) - BigInt(gAtStart.start)) / 86_400n) + 1} 日`
);

gregory.close();
tropical.close();
