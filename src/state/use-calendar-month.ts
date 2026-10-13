/**
 * 一个月里的每一天：从 `gregory_month` 读，不自己算。
 *
 * ## 为什么不能用 `temporal`
 *
 * `temporal` 看起来是"全库时间主键"，但它是**事件表**不是日历：10,734,114 行里
 * 2026 年 10 月只覆盖 18 天（1、2、3、6、8…），因为只有 workbook 里出现过的时刻
 * 才有一行。拿它铺日历会到处是空洞，而空洞看起来像"这天没有历法数据"。
 *
 * `gregory_month` 才是稠密的：每月一行，带 `start`（该月 1 日 0 点的 `absolute`）
 * 与 `lengthOfDay`（该月天数）。所以"这个月有哪些天"是
 * `start + n × 86400`，`n` 从 0 到 `lengthOfDay - 1`。
 *
 * ## 两个口径要对上
 *
 * `gregory_month.year` 是**公历年 + 10000**（年 7304 = 公元前 2697 年，
 * 且该年 2 月有 29 天，与 -2696 是闰年吻合），`ordinal` 是月份。加 10000 是为了
 * 让公元前也能用非负整数索引——所以界面上要减回去再显示。
 *
 * 这与 `temporal` 的 `year` 列是同一套口径：`temporal` 里 2026-10-01 的
 * `absolute` 是 `149029632000`，与 `gregory_month` 的 `year = 12026, ordinal = 10`
 * 的 `start` 逐位相同。两个库因此可以互相校验。
 */

import { bigOf } from "../datasource/sqlite";
import { queryModule } from "../datasource/runner";
import { keyOfCivil } from "../share/calendar/gregorian";

/** 公历年与 `gregory_month.year` 之间的偏移。 */
export const YEAR_OFFSET = 10_000;

/** 一天里的秒数。 */
const SECONDS_PER_DAY = 86_400n;

/** 一个月里的某一天。 */
export interface CalendarDay {
    /** `YYYY-MM-DD` */
    key: string;
    /** 公历年（天文纪年，可为负） */
    year: number;
    /** 公历月，1–12 */
    month: number;
    /** 公历日，1–31 */
    day: number;
    /** 当天 0 点的 `absolute` */
    absolute: bigint;
}

/** 一个月。 */
export interface CalendarMonth {
    /** 公历年（天文纪年） */
    year: number;
    /** 公历月，1–12 */
    month: number;
    /** 该月 1 日 0 点的 `absolute` */
    start: bigint;
    /** 该月天数 */
    lengthOfDay: number;
    /** 该月的每一天 */
    days: CalendarDay[];
}

/**
 * 全局月序号：`(year + 10000) × 12 + (month - 1)`。
 *
 * 用它而不是 `Date` 做光标，是因为**跨公元前后要能连续加减**：
 * `Date` 在公元 0 年附近有"没有 0 年"与 `0–99` 年被当成 19xx 两个坑，
 * 而这个库的时间轴一路铺到公元前 9999 年。
 */
export const monthIndexOf = (year: number, month: number): number => (year + YEAR_OFFSET) * 12 + (month - 1);

/** 月序号 → 年月。 */
export const partsOfMonthIndex = (index: number): { year: number; month: number } => {
    const yearIndex = Math.floor(index / 12);
    return { year: yearIndex - YEAR_OFFSET, month: (index % 12) + 1 };
};

/**
 * 读一个月的日历。
 *
 * @returns 该月不在库里时返回 `null`（库覆盖公元前 9999 到公元 13500）
 */
export async function loadMonth(year: number, month: number): Promise<CalendarMonth | null> {
    const rows = await queryModule(
        "gregory",
        `SELECT "start", "lengthOfDay"
         FROM "gregory_month"
         WHERE "year" = :year AND "ordinal" = :month
         LIMIT 1`,
        { year: year + YEAR_OFFSET, month }
    );

    const row = rows[0];
    if (row === undefined) {
        return null;
    }

    const start = bigOf(row.start);
    const lengthOfDay = Number(bigOf(row.lengthOfDay));

    return {
        year,
        month,
        start,
        lengthOfDay,
        days: Array.from({ length: lengthOfDay }, (_unused, index) => ({
            key: keyOfCivil(year, month, index + 1),
            year,
            month,
            day: index + 1,
            absolute: start + BigInt(index) * SECONDS_PER_DAY
        }))
    };
}

/** 一个包含若干个月的窗口，用于一次性把相邻月也取回来（月视图要铺上月尾下月头）。 */
export async function loadMonths(center: number, before = 2, after = 2): Promise<CalendarDay[]> {
    const wanted: number[] = [];
    for (let offset = -before; offset <= after; offset += 1) {
        wanted.push(center + offset);
    }

    const months = await Promise.all(
        wanted.map((index) => {
            const parts = partsOfMonthIndex(index);
            return loadMonth(parts.year, parts.month);
        })
    );

    return months.flatMap((month) => month?.days ?? []);
}
