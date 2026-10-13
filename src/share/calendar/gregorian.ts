/**
 * 公历换算：`absolute`（建元起算秒）↔ 公历年月日。
 *
 * ## ⚠️ 日期**不能**在界面里算
 *
 * 中间试过用儒略日（Meeus 第 7 章）在界面里换算，**结果是错的**，
 * 而且错得很安静：界面看起来完全正常，只是每一格标注的农历、节气、干支
 * 整体错位二十多天。
 *
 * 拿 `temporal` 表自己的两个锚点一比就看得出来：
 *
 * | 时刻             | `absolute`         | `days` |
 * | ---------------- | ------------------ | ------ |
 * | 建元 -2696-03-11 | 86400（当天 0 点） | 1      |
 * | 2026-10-01       | 149029632000       | 1724880 |
 *
 * 两者相差 **1,724,879** 天，而按儒略日算出的真实间隔是 **1,724,902** 天
 * ——差 23 天。也就是说这个库的"年月日 ↔ 天数"用的是它**自己的**一套置闰规则，
 * 不是任何一个 JD 公式。用 JD 反推必然错位。
 *
 * 结论：**日期一律从 `temporal` 表读**（见 `state/use-day-facts.ts`）。
 * 本文件只保留三类不需要"换算"的东西：
 *
 * 1. 一天与秒的整数关系（`absolute = days × 86400 + seconds`，这是表的定义）；
 * 2. 中文格式化（年、月、星期）；
 * 3. 由年月日拼出**键**（`YYYY-MM-DD`）——纯字符串，不做日期运算。
 *
 * ## 星期从哪来
 *
 * 建元当天是周一（`docs/design.md` §2），而 `temporal.days` 建元当天为 **1**。
 * 所以 `days = 0` 是建元前一天 = 周日，星期就是 `days mod 7`。
 * 这不需要任何日历规则，`days` 是线性的。
 */

/** 一天的秒数。 */
export const SECONDS_PER_DAY = 86_400;

/** `days`（`temporal.days`）→ `absolute`（当天 0 点）。 */
export const absoluteOfDays = (days: bigint | number): bigint => BigInt(days) * 86_400n;

/** `absolute` → `days`，向下取整。 */
export const daysOfAbsolute = (absolute: bigint): bigint =>
    absolute >= 0n ? absolute / 86_400n : -((-absolute + 86_399n) / 86_400n);

/** 一天内的秒数偏移。 */
export const secondOfDay = (absolute: bigint): number =>
    Number(absolute - absoluteOfDays(daysOfAbsolute(absolute)));

/**
 * 星期。0 = 周日。
 *
 * 建元当天 `days = 1` 是周一，所以 `days = 0` 是周日。
 * BigInt 的取模对负数返回负值，所以补一次。
 */
export const weekdayOfDays = (days: bigint | number): number => {
    const value = BigInt(days) % 7n;
    return Number(value < 0n ? value + 7n : value);
};

/** 中文月份名。 */
export const MONTH_NAMES: readonly string[] = [
    "一月",
    "二月",
    "三月",
    "四月",
    "五月",
    "六月",
    "七月",
    "八月",
    "九月",
    "十月",
    "十一月",
    "十二月"
];

/** 中文星期名，0 = 周日。 */
export const WEEKDAY_NAMES: readonly string[] = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 公历年的显示形式。
 *
 * `temporal.year` 用**天文纪年**（有 0 年，即公元前 1 年写作 0）。
 * 中文习惯说"公元前 N 年"且没有"公元 0 年"，所以 0 → 前 1 年、-2696 → 前 2697 年。
 */
export function formatYear(year: number): string {
    return year > 0 ? `${year} 年` : `前 ${1 - year} 年`;
}

/** 公历年月日的完整写法。 */
export const formatCivil = (year: number, month: number, day: number): string =>
    `${formatYear(year)}${month} 月 ${day} 日`;

/** `YYYY-MM-DD` 键。补零到四位，字符串排序因此与时间排序一致。 */
export const keyOfCivil = (year: number, month: number, day: number): string =>
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** 把 `YYYY-MM-DD` 拆回三段。 */
export const partsOfKey = (key: string): { year: number; month: number; day: number } => {
    const [year, month, day] = key.split("-").map(Number);
    return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
};
