/**
 * 把库里的 `absolute` 交给星历库之前，必须先换成**库里自己的**公历日期。
 *
 * ## 问题
 *
 * `share/astronomy/julian.ts` 里的锚点是按文档定的：建元 -2696-03-11 ↔ `absolute` 86400，
 * 于是 `JD = 736413.5 + absolute / 86400`。但库自己的日期标签**不是**这个锚点算出来的：
 *
 * | 时刻            | `absolute`   | 库里标为   |
 * | --------------- | ------------ | ---------- |
 * | 建元            | 86400        | -2696-03-11 |
 * | 2026 年 10 月 1 日 | 149029632000 | 2026-10-01 |
 *
 * 两者相差 1,724,879 天，而按儒略日算是 1,724,902 天——**少 23 天**。
 * 也就是说这个库的年月日 ↔ 天数用的是它自己的一套置闰规则。
 *
 * 后果是具体的、可观测的：用 `dateOfAbsolute()` 把 `absolute` 换成 `Date` 再交给
 * `astronomy-engine`，算出来的天象是**差 23 天**那一刻的。地表投影页就露了馅——
 * 太阳赤纬显示 0.11°N，而 10 月中旬应该是 7.6°S 左右（那正是秋分的值）。
 *
 * ## 解法
 *
 * 日期从库里读（`gregory_month` 给月首与月长），再拼成 `Date`。
 * 这样星历算的就是**库里那个日期**的天象，与页面上显示的农历、节气、干支对得上。
 *
 * `setFullYear` 而不是 `new Date(y, m, d)`：后者把 0–99 年当成 19xx，
 * 而这个库的时间轴一路铺到公元前 9999 年。
 */

/** 由公历分段拼一个 `Date`（本地时区，只要年月日时分对就够）。 */
export function dateOfCivil(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0
): Date {
    const date = new Date();
    date.setFullYear(year, month - 1, day);
    date.setHours(hour, minute, 0, 0);
    return date;
}

/**
 * 某个 `absolute` 在库里对应的公历日期。
 *
 * 只查一次 `gregory_month`（`year + 10000` 是库的年表口径），
 * 再用月首加天数偏移。**不做任何儒略日换算**——那个换算与库的口径差 23 天。
 */
export async function civilOfAbsolute(
    absolute: bigint,
    query: (
        module: string,
        statement: string,
        parameters: Record<string, bigint | number | string | null>
    ) => Promise<{ start?: unknown; lengthOfDay?: unknown; year?: unknown; ordinal?: unknown }[]>
): Promise<{ year: number; month: number; day: number; hour: number; minute: number } | null> {
    /*
     * 先用一个宽窗口把候选月找出来：公历一个月 28–31 天，
     * 而库里一个月的天数也在同一量级，所以取 `absolute` 往前 40 天、
     * 往后 10 天覆盖到的所有月，挑 `start <= absolute <= end` 的那一个。
     */
    const rows = await query(
        "gregory",
        `SELECT "year", "ordinal", "start", "lengthOfDay" FROM "gregory_month"
         WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
        { a: absolute }
    );
    const row = rows[0];
    if (row === undefined) {
        return null;
    }

    const start = BigInt(String(row.start));
    const offset = Number((absolute - start) / 86_400n);
    const remainder = Number(absolute - start - BigInt(offset) * 86_400n);

    return {
        year: Number(row.year) - 10_000,
        month: Number(row.ordinal),
        day: offset + 1,
        hour: Math.floor(remainder / 3600),
        minute: Math.floor((remainder % 3600) / 60)
    };
}
