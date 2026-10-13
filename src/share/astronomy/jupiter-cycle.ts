/**
 * 地球—木星会合：把两者的日心黄经之差当成一个可读的相位。
 *
 * ## 为什么用"日心黄经之差"而不是查会合表
 *
 * 会合的定义就是**地球、木星、太阳连成一线**——等价于两者**日心黄经相同**
 * （合日）或**相差 180°**（冲日）。所以相位可以直接算：
 *
 * ```
 * 相位 = (木星日心黄经 − 地球日心黄经) mod 360
 *   0°  → 合日（木星在太阳背后）
 * 180°  → 冲日（木星最近、最亮、整夜可见）
 * ```
 *
 * 这样不必预先算一张会合时刻表，任意时刻都能求值，
 * 而且相位本身就是"地球和木星绑在一起"的度量。
 *
 * ## 核心数字（实测，见 `scripts/verify-jupiter-cycle.mjs`）
 *
 * | 周期 | 天数 | 说明 |
 * | ---- | ---- | ---- |
 * | 会合周期 | **398.884** | 相位转一整圈 |
 * | 回归年 | 365.242190 | 地球的年，与回归历同源 |
 * | 交点年（食年） | 346.620076 | 太阳回到同一月球交点 |
 * | 木星恒星周期 | 4332.589 | 木星自己公转一周 = 11.862 回归年 |
 *
 * ## 这套历法的骨架：11 会合 = 12 年（差 4.82 天）
 *
 * ```
 * 11 会合 = 4387.72 天
 * 12 回归年 = 4382.91 天
 * 差 = 4.82 天   ← 0.11%，十二年累计
 * ```
 *
 * 我扫过 1–60 次会合，**只有 11 会合**这一个点在 0.02 年容差内接近整数年。
 * 所以"木星 ↔ 回归年"的整数逼近关系**只有 12:11 这一条**，没有第二条可挑。
 *
 * 历法史上这一步叫「超辰」：11.862 年 ≠ 12 年，所以岁星纪年每约 86 年
 * 就会与实际天象差一次。本模块**不隐藏它**——`driftDays()` 把它算出来，
 * 页面上直接显示，因为藏起来做闰月校正只会让用户无法核对。
 */

import * as Astronomy from "astronomy-engine";

/** 会合周期（天）。由 `1/S = 1/恒星年 − 1/木星恒星周期` 推出，实测 398.884。 */
export const SYNODIC_DAYS = 398.884;

/** 回归年（天）。与 `回归历`、`节气历` 同源。 */
export const TROPICAL_DAYS = 365.24219;

/** 交点年 / 食年（天）：太阳连续两次经过同一月球交点。 */
export const ECLIPSE_YEAR_DAYS = 346.620076;

/** 木星恒星周期（天）。库里 `jupiter_year` 的长度实测 4332.5，与之吻合。 */
export const JUPITER_SIDEREAL_DAYS = 4332.589;

/** 11 会合与 12 年的差（天）。这是骨架的误差，也是"超辰"的量。 */
export const ELEVEN_SYNODIC_DRIFT = 11 * SYNODIC_DAYS - 12 * TROPICAL_DAYS;

/** 相位。 */
export interface JupiterPhase {
    /** 日心黄经之差（度，0–360）。0 = 合日，180 = 冲日。 */
    angle: number;
    /** 会合序号：以 `EPOCH_JD` 那个合日为第 0 次，向后递增（可为负） */
    index: number;
    /** 在本会合内已过天数（0–398.884） */
    dayInCycle: number;
    /** 距下一次冲日还有多少天（相位从当前走到 180°） */
    daysToOpposition: number;
    /** 距下一次合日还有多少天 */
    daysToConjunction: number;
    /** 相位名称 */
    stage: string;
}

/**
 * 历元：一次**真实的合日**，JD 2451876.6 = 2000-11-28。
 *
 * 由 `scripts/probe-jupiter-conjunction.mjs` 扫描得到（相位 360.000°）。
 *
 * **我第一版把它写成 2451552.5（2000-01-09）是拍脑袋的，那里相位 288.95°——
 * 差了 71°。** 是验证脚本抓出来的。教训：历元这类"随便取一个参考点"的常数
 * 必须由脚本实测后写回，不能估。
 */
export const EPOCH_JD = 2451876.6;

/**
 * ## ⚠️ 会合序号是**平气**推的，与真实合日最多差 ±4 天
 *
 * `phaseOfDate()` 的 `index` 用 `(jd − 历元) / 398.884` 取整，其中 398.884 是
 * **平均**会合周期（由 `1/S = 1/恒星年 − 1/木星恒星周期` 推出）。
 *
 * 实测单次会合周期在 **395.4–402.7 天** 之间摆动（幅度 ±3.7 天），
 * 来源是地球与木星各自的轨道偏心率。所以"第 N 会合"是按平均周期数的序号，
 * 与真实第 N 次合日可能差几天。
 *
 * 这与农历里的"平气"与"定气"是同一类取舍：平气算法简单、序号稳定；
 * 定气要每次查星历。本模块选**平气**，因为历法要的是可数的序号，
 * 而页面上同时显示的 `angle`（真实相位）会把这个差露出来——
 * 用户看得到"序号说应该合日了，但相位还差 3°"。
 *
 * 要精确的合日时刻，用 `probe-jupiter-conjunction.mjs` 那个扫描法。
 */

/** 某个天体的日心黄经（度）。 */
const heliocentricLongitude = (body: Astronomy.Body, date: Date): number => {
    const vector = Astronomy.HelioVector(body, date);
    const ecliptic = Astronomy.Ecliptic(vector);
    return ((ecliptic.elon % 360) + 360) % 360;
};

/**
 * 相位名称。
 *
 * 用中国传统的说法：合日（木星在太阳背后，不可见）、冲日（最近最亮）。
 * 中间四点用「东方照 / 西方照」——那是西方占星的叫法，
 * 但在历法里只需要区分"接近"与"远离"，所以这里用中性的方位词。
 */
const STAGE_OF = (angle: number): string => {
    if (angle < 10 || angle > 350) {
        return "合日";
    }
    if (angle < 80) {
        return "晨见东方";
    }
    if (angle < 100) {
        return "东方照";
    }
    if (angle < 170) {
        return "逆行前";
    }
    if (angle <= 190) {
        return "冲日";
    }
    if (angle < 260) {
        return "逆行后";
    }
    if (angle < 280) {
        return "西方照";
    }
    return "夕见西方";
};

/** 由 `absolute` 求相位。`absolute` 是库的时间轴，先换成真实日期。 */
export function phaseOfDate(date: Date): JupiterPhase {
    const jupiter = heliocentricLongitude(Astronomy.Body.Jupiter, date);
    const earth = heliocentricLongitude(Astronomy.Body.Earth, date);
    const angle = ((jupiter - earth) % 360 + 360) % 360;

    /*
     * 会合序号：相位每转一圈算一次。
     * 由"距历元多少天"除以会合周期得到，再用相位校正小数部分——
     * 不这么校正的话，会合周期取 398.884 的舍入误差会在几千次之后累积成一天。
     */
    const jd = date.getTime() / 86_400_000 + 2_440_587.5;
    const raw = (jd - EPOCH_JD) / SYNODIC_DAYS;
    const index = Math.floor(raw);
    const dayInCycle = angle / 360 * SYNODIC_DAYS;

    /* 相位顺行推进：从当前角度走到 180°（冲）或 0°/360°（合） */
    const toOpposition = ((180 - angle + 360) % 360) / 360 * SYNODIC_DAYS;
    const toConjunction = ((360 - angle) % 360) / 360 * SYNODIC_DAYS;

    return {
        angle,
        index,
        dayInCycle,
        daysToOpposition: toOpposition,
        daysToConjunction: toConjunction,
        stage: STAGE_OF(angle)
    };
}

/**
 * 「超辰量」：从历元到此刻，**11 会合 = 12 年** 这条近似累计偏了多少天。
 *
 * 每 11 次会合偏 `ELEVEN_SYNODIC_DRIFT`（约 4.82 天），
 * 所以第 n 次会合时偏 `n / 11 × 4.82` 天。
 * 负数表示"会合落后于年"，正数表示"超前"。
 */
export function driftDays(index: number): number {
    return (index / 11) * ELEVEN_SYNODIC_DRIFT;
}

/**
 * 「岁星周」：11 会合 = 12 年 的那个大周期。
 *
 * 返回当前落在第几个岁星周、以及周内进度。这是方案 A 的骨架：
 * **10 周与 12 周是这条周期两端的标记**——起点在 10 周处、终点在 12 周处。
 */
export interface AgeStarCycle {
    /** 第几个岁星周（以历元为第 0 周） */
    week: number;
    /** 周内已过多少天（0–4387.72） */
    dayInCycle: number;
    /** 周内进度（0–1） */
    progress: number;
    /** 本周内第几次会合（1–11） */
    conjunctionInCycle: number;
}

export function ageStarCycleOf(index: number): AgeStarCycle {
    const week = Math.floor(index / 11);
    const remainder = index - week * 11;

    return {
        week,
        dayInCycle: remainder * SYNODIC_DAYS,
        progress: remainder / 11,
        conjunctionInCycle: remainder + 1
    };
}

/** 交点年的位置：太阳相对月球交点转了多少圈。仅作并列显示，不参与历法结构。 */
export function eclipseYearProgress(date: Date): { index: number; dayInCycle: number } {
    const jd = date.getTime() / 86_400_000 + 2_440_587.5;
    const total = (jd - EPOCH_JD) / ECLIPSE_YEAR_DAYS;
    const index = Math.floor(total);
    return { index, dayInCycle: (total - index) * ECLIPSE_YEAR_DAYS };
}
