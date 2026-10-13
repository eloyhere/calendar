/**
 * 干支与六十甲子。
 *
 * ## 为什么是"共享"而不是"命理"的
 *
 * 干支不是命理专有的：历法页的每一格都要显示日干支，年表要显示年干支，
 * 命理的四柱是它的一个用法。放在 `share/` 下是因为历法、年表、命理三层都要用，
 * 而 `entity/` 是数据契约、`database/` 是构建期——都不该有这段纯计算。
 *
 * ## 三个不同的"干支年"
 *
 * 这是最容易错的地方，三种口径**在同一天可以给出三个不同的年干支**：
 *
 * | 口径       | 换年点         | 用在哪                     |
 * | ---------- | -------------- | -------------------------- |
 * | 农历年     | 正月初一       | 读古书里的"某年"           |
 * | 干支年     | **立春**       | 八字年柱、风水、择日       |
 * | 公历年     | 1 月 1 日      | 与外界对齐                 |
 *
 * 本文件只提供**计算**：`sexagenaryOf(index)` 把任意序号映射成两字。
 * 年序号的口径由调用方决定（历法页传哪一年的序号，八字页传立春之后的序号）。
 * 把口径塞进这里，就是在制造"同一个函数在不同页给出不同答案"的坑。
 */

/** 十天干。 */
export const STEMS: readonly string[] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/** 十二地支。 */
export const BRANCHES: readonly string[] = [
    "子",
    "丑",
    "寅",
    "卯",
    "辰",
    "巳",
    "午",
    "未",
    "申",
    "酉",
    "戌",
    "亥"
];

/**
 * 六十甲子序号 → 两字干支。
 *
 * @param index 序号，可以为任意整数（负数与超过 60 的都按模 60 归一）
 */
export function sexagenary(index: number): string {
    const n = ((index % 60) + 60) % 60;
    return `${STEMS[n % 10]}${BRANCHES[n % 12]}`;
}

/** 序号 → 天干。 */
export const stemOf = (index: number): string => STEMS[(((index % 10) + 10) % 10)];

/** 序号 → 地支。 */
export const branchOf = (index: number): string => BRANCHES[(((index % 12) + 12) % 12)];

/**
 * 地支对应的生肖。
 *
 * 索引与 `BRANCHES` 一一对应。放在这里而不是各页面自己写一份映射：
 * 12 项的映射表写错一项只会在生肖年显示错，而那种错很难被注意到。
 */
export const ZODIAC_ANIMALS: readonly string[] = [
    "鼠",
    "牛",
    "虎",
    "兔",
    "龙",
    "蛇",
    "马",
    "羊",
    "猴",
    "鸡",
    "狗",
    "猪"
];

/** 地支 → 生肖。 */
export const animalOf = (index: number): string =>
    ZODIAC_ANIMALS[(((index % 12) + 12) % 12)] ?? "";

/**
 * 建元当年的**年干支序号**。
 *
 * 建元（-2696）在库内的 `natural_year.relative = 1`，而
 * `docs/design.md` §2 记的是"建元当天为上元甲子"——甲子即序号 0。
 * 所以：`年序号 = natural_year.relative - 1`。
 *
 * 这个常量写成 0 是**声明**而不是推导：它把"建元是甲子年"这条口径钉在一处，
 * 将来若改了建元口径，只需改这一个数，而不必去翻八个页面。
 */
export const EPOCH_YEAR_INDEX = 0;

/**
 * 日干支序号。
 *
 * 口径：**建元当天是甲子日**（与年同）。日干支按连续日数排，一天不跳——
 * 这也是为什么它比年干支可靠：年干支有换年点的争议，日干支只有一条数轴。
 *
 * @param daysFromEpoch 距建元当天的天数，当天为 0，前一天为 -1
 */
export const daySexagenaryIndex = (daysFromEpoch: number | bigint): number =>
    Number(((BigInt(daysFromEpoch) % 60n) + 60n) % 60n);

/* -------------------------------------------------------------------------- */
/* 五行与十二宫                                                                */
/* -------------------------------------------------------------------------- */

/** 天干五行。 */
export const STEM_ELEMENTS: readonly string[] = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];

/**
 * 天干阴阳。
 *
 * 阳干为甲丙戊庚壬（偶数位）。八字里"阳干见阳干为比肩、见阴干为劫财"就靠这个。
 */
export const STEM_YANG: readonly boolean[] = STEMS.map((_unused, index) => index % 2 === 0);

/** 地支五行。 */
export const BRANCH_ELEMENTS: readonly string[] = [
    "水",
    "土",
    "木",
    "木",
    "土",
    "火",
    "火",
    "土",
    "金",
    "金",
    "土",
    "水"
];

/**
 * 地支藏干（本气、中气、余气）。
 *
 * 顺序是**由强到弱**：第一个是本气。八字取用神时先看本气，
 * 取不到才看中气与余气。顺序错了整套推断都会歪。
 */
export const BRANCH_HIDDEN_STEMS: readonly (readonly number[])[] = [
    [9], // 子：癸
    [5, 9, 7], // 丑：己 癸 辛
    [0, 2, 4], // 寅：甲 丙 戊
    [1], // 卯：乙
    [4, 1, 9], // 辰：戊 乙 癸
    [2, 4, 6], // 巳：丙 戊 庚
    [3, 5], // 午：丁 己
    [5, 1, 3], // 未：己 乙 丁
    [6, 8, 4], // 申：庚 壬 戊
    [7], // 酉：辛
    [4, 3, 7], // 戌：戊 丁 辛
    [8, 0] // 亥：壬 甲
];

/** 十二地支对应的时辰范围（初、正各一小时，从 23 点起）。 */
export const BRANCH_HOURS: readonly { branch: string; from: number; to: number }[] = BRANCHES.map(
    (branch, index) => {
        // 子时跨零点：23:00–01:00。其余每个支覆盖两小时。
        const start = (index * 2 + 23) % 24;
        return { branch, from: start, to: (start + 2) % 24 };
    }
);

/**
 * 由二十四小时制的"小时 + 分钟"求时辰地支序号。
 *
 * **子时的争议**（早子时 / 晚子时）：23:00–24:00 属于哪一天，各家不同。
 * 一种取"日柱从 23:00 换"，另一种取"从 00:00 换"。本函数只回答"是哪个时辰"，
 * 日柱换不换由调用方传入的时间决定——把争议留在调用方，
 * 才能让界面把"我用的是哪条规则"明确显示出来，而不是悄悄替用户选一个。
 */
export const branchIndexOfHour = (hour: number): number => Math.floor(((hour + 1) % 24) / 2);
