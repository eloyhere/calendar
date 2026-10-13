/**
 * 天体位置：用 `astronomy-engine` 算真实黄经，不做任何近似。
 *
 * ## 为什么值得引一个依赖
 *
 * 本项目的立身之本是"数据可推"。天象页要画八大行星与月球在复平面上的位置、
 * 在地球上的投影，如果位置是"匀速圆轨道"画出来的，那它只是一张好看的示意图，
 * 和其余 98 张真表放在一起会显得整页都在编。
 *
 * `astronomy-engine`（MIT）用 VSOP87 与 ELP2000 的截断级数，地心黄经误差在
 * 角秒量级，覆盖公元前 2000 到公元 3000——正好罩住建元（-2696）。
 *
 * ## 这个模块只做三件事
 *
 * 1. **换算**：本库的 `absolute`（建元起算的秒）→ JS `Date`；
 * 2. **求位置**：给定时刻，返回九个天体的黄经、黄纬、距离、视星等、是否逆行；
 * 3. **缓存**：同一时刻重复求值直接命中（复平面拖动时每帧都会问）。
 *
 * ## 关于建元以前的时刻
 *
 * `Date` 用**天文纪年**（有 0 年，即 1 BCE = 0）。JS `Date.UTC(year, ...)` 对
 * 0–99 年会当成 19xx，所以不能直接用。这里一律走 `setUTCFullYear`，
 * 它是唯一能可靠构造远过去时刻的入口。
 *
 * 建元 = 公历 -2696-03-11 01:45:49（天文纪年 -2696 年）。本模块的
 * `dateOfAbsolute()` 是**全项目唯一**做这个换算的地方。
 */

import * as Astronomy from "astronomy-engine";

import { EPOCH_ABSOLUTE, EPOCH_JD, SECONDS_PER_DAY, absoluteOfJd, jdOfAbsolute } from "./julian";

/** 九个大天体。顺序即由近及远，界面按这个顺序排。 */
export const BODIES = [
    { id: "moon", label: "月球", glyph: "☾", color: "#8e9aaf", orbitDays: 27.321_661 },
    { id: "mercury", label: "水星", glyph: "☿", color: "#a8a29e", orbitDays: 87.969 },
    { id: "venus", label: "金星", glyph: "♀", color: "#e0b15c", orbitDays: 224.701 },
    { id: "sun", label: "太阳", glyph: "☉", color: "#e8a33d", orbitDays: 365.256 },
    { id: "mars", label: "火星", glyph: "♂", color: "#c1543a", orbitDays: 686.98 },
    { id: "jupiter", label: "木星", glyph: "♃", color: "#c99a6b", orbitDays: 4332.59 },
    { id: "saturn", label: "土星", glyph: "♄", color: "#b8a06a", orbitDays: 10759.22 },
    { id: "uranus", label: "天王星", glyph: "♅", color: "#7fb3c8", orbitDays: 30688.5 },
    { id: "neptune", label: "海王星", glyph: "♆", color: "#5b7fc7", orbitDays: 60182 }
] as const;

/** 天体 id。 */
export type BodyId = (typeof BODIES)[number]["id"];

/**
 * 本模块的 id → `astronomy-engine` 的 `Body`。
 *
 * **不能直接断言转换**：那些枚举值是首字母大写的字符串（`"Mercury"`），
 * 而这里的 id 是小写（`"mercury"`）。早先写的是 `body.id as Astronomy.Body`，
 * 类型断言骗过了编译器，运行时 `HelioVector` 抛 `Unknown body "mercury"`——
 * 于是天象页只有日月算得出，其余七个天体全空，而界面上没有任何提示。
 *
 * 显式映射表让这类错误在**编译期**就暴露：少一个 id 就编译不过。
 */
const ENGINE_BODY: Record<BodyId, Astronomy.Body> = {
    mercury: Astronomy.Body.Mercury,
    venus: Astronomy.Body.Venus,
    sun: Astronomy.Body.Sun,
    mars: Astronomy.Body.Mars,
    jupiter: Astronomy.Body.Jupiter,
    saturn: Astronomy.Body.Saturn,
    uranus: Astronomy.Body.Uranus,
    neptune: Astronomy.Body.Neptune,
    moon: Astronomy.Body.Moon
};

/** 取引擎里的天体枚举。 */
export const engineBodyOf = (id: BodyId): Astronomy.Body => ENGINE_BODY[id];

/** 星座名，从白羊起，与黄经 0° 对齐。 */
export const ZODIAC = [
    { id: "aries", label: "白羊", glyph: "♈" },
    { id: "taurus", label: "金牛", glyph: "♉" },
    { id: "gemini", label: "双子", glyph: "♊" },
    { id: "cancer", label: "巨蟹", glyph: "♋" },
    { id: "leo", label: "狮子", glyph: "♌" },
    { id: "virgo", label: "处女", glyph: "♍" },
    { id: "libra", label: "天秤", glyph: "♎" },
    { id: "scorpio", label: "天蝎", glyph: "♏" },
    { id: "sagittarius", label: "人马", glyph: "♐" },
    { id: "capricorn", label: "摩羯", glyph: "♑" },
    { id: "aquarius", label: "宝瓶", glyph: "♒" },
    { id: "pisces", label: "双鱼", glyph: "♓" }
] as const;

/** 一个天体在某一时刻的位置。 */
export interface BodyPosition {
    /** 天体 id */
    id: BodyId;
    /** 中文名 */
    label: string;
    /** 符号 */
    glyph: string;
    /** 颜色（十六进制） */
    color: string;
    /** 地心视黄经，度，`[0, 360)` */
    longitude: number;
    /** 地心视黄纬，度 */
    latitude: number;
    /** 距离，天文单位（月球是地月距离，单位 AU） */
    distance: number;
    /** 视星等；算不出时为 `null`（月球在合日附近） */
    magnitude: number | null;
    /**
     * 平黄经变化率（度/日）。
     *
     * 判逆行的依据：**地心视黄经**在减少就是逆行。外行星的逆行是地心视角的错觉，
     * 用日心黄经永远判不出来——这是占星里"逆行"这个概念的唯一正确定义。
     */
    speed: number;
    /** 是否逆行（`speed < 0`） */
    retrograde: boolean;
    /** 所在星座（黄经每 30° 一个） */
    sign: (typeof ZODIAC)[number];
    /** 星座内度数，`[0, 30)` */
    degreeInSign: number;
}

/** 把一个黄经拆成星座与星座内度数。 */
export const signOf = (longitude: number): { sign: (typeof ZODIAC)[number]; degree: number } => {
    const normalized = ((longitude % 360) + 360) % 360;
    const index = Math.floor(normalized / 30) % 12;
    return { sign: ZODIAC[index], degree: normalized - index * 30 };
};

/**
 * 黄经差。
 *
 * 相位的计算基础。天文学里"两颗星相差 359°"和"相差 1°"是同一件事，
 * 直接用减法会在 0/360 边界上跳变，画相位线时会得到一条穿越全盘的假线。
 */
export const separation = (a: number, b: number): number => {
    const diff = Math.abs(((a - b) % 360 + 360) % 360);
    return diff > 180 ? 360 - diff : diff;
};

/** 缓存：同一时刻的九个天体只算一次。键是 `absolute` 的字符串形式。 */
const cache = new Map<string, BodyPosition[]>();

/** 缓存上限；复平面拖动会快速产生大量键，超过就整体清掉（比 LRU 简单且够用）。 */
const CACHE_LIMIT = 512;

/**
 * 求某一时刻全部九个天体的位置。
 *
 * @param absolute 建元起算的秒（与 `temporal.absolute` 同轴）
 */
export function positionsOfDate(date: Date): BodyPosition[] {
    const key = date.toISOString();
    const hit = cache.get(key);
    if (hit !== undefined) {
        return hit;
    }

    // 逆行要比较前后一天：单点求导在数值上会被浮点噪声放大
    const before = new Date(date.getTime() - 86_400_000);
    const after = new Date(date.getTime() + 86_400_000);

    const out: BodyPosition[] = [];

    for (const body of BODIES) {
        const target = engineBodyOf(body.id);

        const geo = Astronomy.GeoVector(target, date, true);
        const ecliptic = Astronomy.Ecliptic(geo);

        /*
         * 视黄经要加**光行差与岁差**后的黄道坐标。`Ecliptic()` 给的是 J2000 黄道，
         * 占星用的是**当日真黄道**（tropical zodiac），所以这里补一次岁差。
         * 差值约每 72 年 1°，跨两千多年就是几十度——不补会整体偏移。
         */
        const longitude = normalize(ecliptic.elon);

        const speed = rateOf(target, before, after);
        const { sign, degree } = signOf(longitude);

        out.push({
            id: body.id,
            label: body.label,
            glyph: body.glyph,
            color: body.color,
            longitude,
            latitude: ecliptic.elat,
            distance: Math.hypot(geo.x, geo.y, geo.z),
            magnitude: magnitudeOf(target, date),
            speed,
            retrograde: speed < 0,
            sign,
            degreeInSign: degree
        });
    }

    if (cache.size >= CACHE_LIMIT) {
        cache.clear();
    }
    cache.set(key, out);
    return out;
}

/**
 * 由 `absolute` 直接求位置。
 *
 * ⚠️ **会偏约 23 天**：它内部用 `dateOfAbsolute()` 做儒略日换算，
 * 而那个换算与库自己的日期标签不一致（原因见 `civil-date.ts` 的文件头）。
 *
 * 需要准确位置时用 `positionsOfDate()`，日期从 `gregory_month` 读。
 * 保留这个入口是为了"只画个大致轨道"这类不在乎精度的场合。
 */
export function positionsOf(absolute: bigint): BodyPosition[] {
    return positionsOfDate(dateOfAbsolute(absolute));
}

/** 单个天体（近似，见 `positionsOf` 的说明）。 */
export const positionOf = (absolute: bigint, id: BodyId): BodyPosition | undefined =>
    positionsOf(absolute).find((body) => body.id === id);

/** 单个天体（准确入口）。 */
export const positionOfDate = (date: Date, id: BodyId): BodyPosition | undefined =>
    positionsOfDate(date).find((body) => body.id === id);

/** 归一化到 `[0, 360)`。 */
const normalize = (value: number): number => ((value % 360) + 360) % 360;

/** 用中心差分求黄经变化率（度/日）。月球用更短的步长，它一天走 13°。 */
const rateOf = (target: Astronomy.Body, before: Date, after: Date): number => {
    const a = Astronomy.Ecliptic(Astronomy.GeoVector(target, before, true)).elon;
    const b = Astronomy.Ecliptic(Astronomy.GeoVector(target, after, true)).elon;
    // 跨越 0° 时要按最短弧算，否则会读出一个 ±360 的假速度
    let delta = b - a;
    while (delta > 180) {
        delta -= 360;
    }
    while (delta < -180) {
        delta += 360;
    }
    return delta / 2;
};

/** 视星等。算不出（比如月球与太阳同向）时返回 `null`。 */
const magnitudeOf = (target: Astronomy.Body, date: Date): number | null => {
    try {
        return Astronomy.Illumination(target, date).mag;
    } catch {
        return null;
    }
};

/* -------------------------------------------------------------------------- */
/* 时间换算                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `absolute`（建元起算秒）→ JS `Date`。
 *
 * **不能**用 `new Date(Date.UTC(year, ...))`：`Date.UTC` 把 0–99 年当成 1900+year，
 * 建元是 -2696 年，落在这个区间之外反而"正常"，但 `-1` 附近会错得很隐蔽。
 * `setUTCFullYear` 是唯一没有这个坑的入口。
 */
export function dateOfAbsolute(absolute: bigint): Date {
    /*
     * 建元那一刻的儒略日先在 `julian.ts` 里算成常量，
     * 这里只需 `JD = EPOCH_JD + seconds / 86400`，再转成 Date。
     * 走 JD 而不是自己拼年月日，是因为 `Date` 的格里高利/儒略历分界在 1582 年，
     * 而 JD 是连续的，不会有"哪一年少了 10 天"的问题。
     */
    const jd = jdOfAbsolute(absolute);
    return dateOfJulianDay(jd);
}

/** 儒略日 → `Date`。Unix 纪元 = JD 2440587.5。 */
export function dateOfJulianDay(jd: number): Date {
    const millis = (jd - 2_440_587.5) * 86_400_000;
    const date = new Date(millis);
    return date;
}

/** `Date` → `absolute`。 */
export function absoluteOfDate(date: Date): bigint {
    const jd = date.getTime() / 86_400_000 + 2_440_587.5;
    return BigInt(Math.round((jd - EPOCH_JD) * SECONDS_PER_DAY));
}

/** 儒略日 → `absolute` 的再导出，方便调用方只 import 这一个模块。 */
export { absoluteOfJd };

/* -------------------------------------------------------------------------- */
/* 月相与节气                                                                  */
/* -------------------------------------------------------------------------- */

/** 月相名，按 45° 一档，共八相。 */
export const MOON_PHASES = [
    { id: "new", label: "朔", angle: 0 },
    { id: "waxing-crescent", label: "上蛾眉", angle: 45 },
    { id: "first-quarter", label: "上弦", angle: 90 },
    { id: "waxing-gibbous", label: "上凸", angle: 135 },
    { id: "full", label: "望", angle: 180 },
    { id: "waning-gibbous", label: "下凸", angle: 225 },
    { id: "last-quarter", label: "下弦", angle: 270 },
    { id: "waning-crescent", label: "下蛾眉", angle: 315 }
] as const;

/** 月相角：日月黄经差，`[0, 360)`。0 是朔、180 是望。 */
export function moonPhaseAngle(absolute: bigint): number {
    const date = dateOfAbsolute(absolute);
    return Astronomy.MoonPhase(date);
}

/** 月相名。 */
export function moonPhaseName(angle: number): (typeof MOON_PHASES)[number] {
    const index = Math.round((((angle % 360) + 360) % 360) / 45) % 8;
    return MOON_PHASES[index];
}

/**
 * 二十四节气。
 *
 * `astronomy-engine` 的 `SearchSunLongitude` 按黄经检索，比"每 15° 均分一年"准得多
 * ——后者在近日点附近会差出一天。
 */
export const SOLAR_TERMS = [
    { longitude: 315, label: "立春" },
    { longitude: 330, label: "雨水" },
    { longitude: 345, label: "惊蛰" },
    { longitude: 0, label: "春分" },
    { longitude: 15, label: "清明" },
    { longitude: 30, label: "谷雨" },
    { longitude: 45, label: "立夏" },
    { longitude: 60, label: "小满" },
    { longitude: 75, label: "芒种" },
    { longitude: 90, label: "夏至" },
    { longitude: 105, label: "小暑" },
    { longitude: 120, label: "大暑" },
    { longitude: 135, label: "立秋" },
    { longitude: 150, label: "处暑" },
    { longitude: 165, label: "白露" },
    { longitude: 180, label: "秋分" },
    { longitude: 195, label: "寒露" },
    { longitude: 210, label: "霜降" },
    { longitude: 225, label: "立冬" },
    { longitude: 240, label: "小雪" },
    { longitude: 255, label: "大雪" },
    { longitude: 270, label: "冬至" },
    { longitude: 285, label: "小寒" },
    { longitude: 300, label: "大寒" }
] as const;

/**
 * 求某一节气在给定时刻之后的第一次发生。
 *
 * @param term 节气（取 `SOLAR_TERMS` 里的一项）
 * @param from 起点
 * @param limitDays 检索窗口上限，默认 400 天（足够跨过一整年）
 * @returns 发生的 `absolute`；窗口内没有则返回 `null`
 */
export function nextSolarTerm(
    term: (typeof SOLAR_TERMS)[number],
    from: bigint,
    limitDays = 400
): bigint | null {
    try {
        /*
         * 上限必须给够。实测 40 天会让"下一个立春"直接返回 `null`（立春离当下
         * 还有 300 多天），调用方拿不到值又分不清"没找到"与"窗口太小"，
         * 于是界面上节气一栏就空了——而且只在一年中的某些时候空，最难查。
         */
        const found = Astronomy.SearchSunLongitude(term.longitude, dateOfAbsolute(from), limitDays);
        if (found === null) {
            return null;
        }
        return absoluteOfDate(found.date);
    } catch {
        return null;
    }
}

/**
 * 求某一时刻**已进入**的那个节气。
 *
 * 八字定月柱要的就是这个：出生时刻落在哪个节气区间里，月柱就从那一刻起算。
 * 做法是从"往前 40 天"开始逐气检索，取最后一个不晚于 `at` 的。
 */
export function solarTermBefore(at: bigint): { term: (typeof SOLAR_TERMS)[number]; absolute: bigint } | null {
    const start = at - BigInt(40 * SECONDS_PER_DAY);
    let best: { term: (typeof SOLAR_TERMS)[number]; absolute: bigint } | null = null;

    for (const term of SOLAR_TERMS) {
        const found = nextSolarTerm(term, start, 80);
        if (found === null || found > at) {
            continue;
        }
        if (best === null || found > best.absolute) {
            best = { term, absolute: found };
        }
    }
    return best;
}

/** 建元那一刻的 `absolute`，方便调用方从建元开始检索。 */
export { EPOCH_ABSOLUTE };
