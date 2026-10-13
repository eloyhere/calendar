/**
 * 儒略日与建元换算。
 *
 * ## 为什么需要儒略日
 *
 * `temporal.absolute` 是"建元起算的秒"。要把它交给 `astronomy-engine`（它吃 `Date`），
 * 中间必须有一个**连续的日计数**。JS `Date` 不是连续的：1582 年 10 月 4 日之前
 * 用儒略历、之后用格里高利历，两者之间凭空少了 10 天。跨建元（-2696）做日期运算时，
 * 每一次 `new Date(year, month, day)` 都在赌浏览器按哪套历解释。
 *
 * 儒略日没有这个问题：它是一个从公元前 4713 年 1 月 1 日正午起算的连续实数，
 * 加一天就是加 1，永远是。
 *
 * ## 建元的儒略日
 *
 * 建元 = 公历（天文纪年）-2696-03-11 01:45:49。
 *
 * 用标准的 Meeus 算法（《Astronomical Algorithms》第 7 章）从儒略历的
 * -2696-03-11 算 JD，**取儒略历而不是格里高利历**：公元前 2696 年格里高利历
 * 还没被发明，用格里高利历外推（proleptic Gregorian）也能得到同一个时刻，
 * 只要两边口径一致就不会错。本文件的下方有自检用例钉住这个口径。
 */

/**
 * 建元当天 00:00:00 的儒略日。
 *
 * 由 `computeEpochJd()` 在模块加载时算一次，并**在下方用自检钉住**——
 * 这个值是全项目所有天文换算的零点，写错了整页天象会整体偏移，
 * 而偏移几千秒在界面上完全看不出来。
 */
export const EPOCH_JD = computeEpochJd(-2696, 3, 11) + 0.0;

/** 建元当天 00:00:00 的 `absolute`。按定义是 `0` 减去当天已经过去的 1:45:49。 */
export const EPOCH_TIME_SECONDS = 1 * 3600 + 45 * 60 + 49;

/** 建元那一刻（-2696-03-11 01:45:49）的 `absolute` = `-EPOCH_TIME_SECONDS`。 */
export const EPOCH_ABSOLUTE = BigInt(-EPOCH_TIME_SECONDS);

/**
 * 公历年月日 → 儒略日（Meeus 第 7 章）。
 *
 * @param year 天文纪年（有 0 年）；`-2696` 就是公元前 2697 年
 * @param month 1–12
 * @param day 1–31（可以是小数，表示一天中的时刻）
 */
export function computeEpochJd(year: number, month: number, day: number): number {
    let y = year;
    let m = month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }

    /*
     * Meeus 的判据：`date >= 1582-10-15` 走格里高利历，之前走儒略历。
     * 建元远在分界之前，所以走的是 `b = 0` 那一支。
     */
    const a = Math.floor(y / 100);
    const gregorian = year > 1582 || (year === 1582 && (month > 10 || (month === 10 && day >= 15)));
    const b = gregorian ? 2 - a + Math.floor(a / 4) : 0;

    return (
        Math.floor(365.25 * (y + 4716)) +
        Math.floor(30.6001 * (m + 1)) +
        day +
        b -
        1524.5
    );
}

/** `absolute`（建元起算秒）→ 儒略日。 */
export const jdOfAbsolute = (absolute: bigint): number =>
    EPOCH_JD + Number(absolute) / 86_400;

/** 儒略日 → `absolute`。 */
export const absoluteOfJd = (jd: number): bigint =>
    BigInt(Math.round((jd - EPOCH_JD) * 86_400));

/**
 * 一天的秒数。写成常量而不是到处 `86400`，是因为它在这几个文件里出现几十次，
 * 而 `8640` 这种少一个零的笔误在界面上只表现为"慢十倍"，看不出来。
 */
export const SECONDS_PER_DAY = 86_400;

/* -------------------------------------------------------------------------- */
/* 自检                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 口径自检：已知的 JD 锚点。
 *
 * 这些数字是 Meeus《Astronomical Algorithms》里的算例与天文年历的公认值，
 * **不参与运行**，由开发期核对（或调试面板）使用。放在这里而不是测试文件里，
 * 是因为它们同时也是"这个模块的口径是什么"的文档。
 *
 * 实测（`Math.floor` 求和式，见 `scripts/smoke/julian.smoke.ts`）：
 *
 * | 输入                        | 算出          | 公认值        |
 * | --------------------------- | ------------- | ------------- |
 * | 2000-01-01.5                | 2451545.0     | 2451545.0     |
 * | 1970-01-01.0                | 2440587.5     | 2440587.5     |
 * | 1582-10-15.0                | 2299160.5     | 2299160.5     |
 * | -2696-03-11.0（建元，儒略） | 736413.5      | —（本项目的零点）|
 */
export const JULIAN_FIXTURES: readonly { year: number; month: number; day: number; jd: number; label: string }[] = [
    { year: 2000, month: 1, day: 1.5, jd: 2_451_545.0, label: "J2000.0 历元" },
    { year: 1970, month: 1, day: 1, jd: 2_440_587.5, label: "Unix 纪元" },
    { year: 1582, month: 10, day: 15, jd: 2_299_160.5, label: "格里高利历改历首日" },
    { year: -2696, month: 3, day: 11, jd: 736_413.5, label: "建元" }
];
