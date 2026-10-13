/**
 * 格子里那几行文字的取名规则。
 *
 * ## 为什么单独一个文件
 *
 * "初一"、"上弦"、"立春" 这些名字看起来是一张常量表，实际是**口径**：
 * 农历日名到初十之后改用"十一"还是"十一日"、月相是四相还是八相、
 * 节气名带不带"节/气"后缀——这些在不同史料里写法不同。
 * 集中在一处才能保证八个历法页、年表页、命理页写出同一个名字。
 */

/** 农历月的日名。初一到三十。 */
export const LUNAR_DAY_NAMES: readonly string[] = [
    "初一",
    "初二",
    "初三",
    "初四",
    "初五",
    "初六",
    "初七",
    "初八",
    "初九",
    "初十",
    "十一",
    "十二",
    "十三",
    "十四",
    "十五",
    "十六",
    "十七",
    "十八",
    "十九",
    "二十",
    "廿一",
    "廿二",
    "廿三",
    "廿四",
    "廿五",
    "廿六",
    "廿七",
    "廿八",
    "廿九",
    "三十"
];

/** 农历月名。闰月在前面加"闰"。 */
export const LUNAR_MONTH_NAMES: readonly string[] = [
    "正月",
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

/**
 * 月内第几天 → 农历日名。
 *
 * @param nth 1–30
 */
export const nthOfMonth = (nth: number): string => LUNAR_DAY_NAMES[nth - 1] ?? "";

/**
 * 月序号 → 农历月名。
 *
 * @param ordinal 1–12，表示这是那一年的第几个月（不是闰月序号）
 * @param leap 是不是闰月
 */
export const monthNameOf = (ordinal: number, leap: boolean): string =>
    `${leap ? "闰" : ""}${LUNAR_MONTH_NAMES[ordinal - 1] ?? `${ordinal} 月`}`;

/**
 * 距今天数 → 一句人读的相对表达。
 *
 * ## 三档而不是一档
 *
 * | 跨度       | 写法              | 例子                    |
 * | ---------- | ----------------- | ----------------------- |
 * | ≤ 60 天    | 天                | `距今 43 天`、`距今 2 天` |
 * | ≤ 3 年     | 个月 / 年         | `距今 8 个月`、`距今 2 年` |
 * | 更大       | 年，保留一位小数  | `距今 3720.5 年`        |
 *
 * 为什么不到处都用"年"：建元距今约 3720 年，写成 `距今 3720 年` 之后，
 * 用户完全看不出"上周"和"上个月"的区别。反过来，两千年前的事写成"距今 73 万天"
 * 也没意义。三档各自在它擅长的那段里准确。
 *
 * @param days 正数表示过去（距今），负数表示未来（距未来）
 */
export function relativeLabel(days: bigint | number): string {
    const value = Number(days);

    if (value === 0) {
        return "就是今天";
    }

    const past = value > 0;
    const magnitude = Math.abs(value);
    const prefix = past ? "距今" : "距未来";

    if (magnitude <= 60) {
        return `${prefix} ${magnitude} 天`;
    }
    if (magnitude <= 365 * 3) {
        const months = Math.round(magnitude / 30.44);
        return months < 24 ? `${prefix} ${months} 个月` : `${prefix} ${(magnitude / 365.2422).toFixed(1)} 年`;
    }

    const years = magnitude / 365.2422;
    return years < 100 ? `${prefix} ${years.toFixed(1)} 年` : `${prefix} ${Math.round(years)} 年`;
}

/**
 * 元会运世：把一个朔望年序号换算成"几元几会几运几世第几年"。
 *
 * 邵雍《皇极经世》的周期按 `src/entity/primary.ts` 的口径：
 * `1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望年`，`1 世 = 30 朔望年`。
 *
 * @param yearIndex 朔望年序号，从 1 开始（建元那年是 1）
 */
export function epochCycle(yearIndex: number): {
    yuan: number;
    hui: number;
    yun: number;
    shi: number;
    yearInShi: number;
} {
    // 序号从 1 起，先减 1 再取模，否则"第 1 年"会被算成上一个周期的最后一年
    const zero = Math.max(0, yearIndex - 1);

    const yuan = Math.floor(zero / 129_600) + 1;
    const inYuan = zero % 129_600;
    const hui = Math.floor(inYuan / 10_800) + 1;
    const inHui = inYuan % 10_800;
    const yun = Math.floor(inHui / 360) + 1;
    const inYun = inHui % 360;
    const shi = Math.floor(inYun / 30) + 1;

    return { yuan, hui, yun, shi, yearInShi: (inYun % 30) + 1 };
}

/** 元会运世的一句话写法。 */
export const formatEpochCycle = (cycle: ReturnType<typeof epochCycle>): string =>
    `第 ${cycle.yuan} 元 ${cycle.hui} 会 ${cycle.yun} 运 ${cycle.shi} 世 第 ${cycle.yearInShi} 年`;
