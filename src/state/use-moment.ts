/**
 * 命理与数术共用的"起课输入"：一个时刻 + 一个地点。
 *
 * ## 为什么四张盘、六种课共用一份输入
 *
 * 用户输入一次出生/起课时刻，然后在八字、紫微、七政四余、星盘、奇门、六壬之间来回切。
 * 每换一页就重输一遍是这类应用最常被抱怨的地方（研究里 问真八字 被夸的正是
 * "八字盘 ↔ 六爻盘可以来回切"）。所以输入是一份**共享状态**，不是每页各一份。
 *
 * ## 三项换算必须在界面上显式可见
 *
 * 研究里反复出现的痛点都指向同一件事：**排盘软件悄悄替用户做了选择**，
 * 而那几个选择会改变结果。所以这里把它们算出来并**显示**出来：
 *
 * | 换算         | 影响                               |
 * | ------------ | ---------------------------------- |
 * | 真太阳时     | 时柱（可能跨时辰）、日柱（跨子时） |
 * | 节气交节时刻 | 月柱（可能跨月）                   |
 * | 换日时点     | 日柱                               |
 *
 * 这三项在 `deriveMoment()` 里算，由页面显示成一行"口径"。
 *
 * ## 换日规则：23:00 起算次日，**规则唯一、不提供选项**
 *
 * 原先界面上有个单选：`晚子时（23:00 换日）` / `早子时（00:00 换日）`。
 * 那是把一条有争议的规则**摆在用户面前让他选**——听起来尊重用户，
 * 实际是把责任推给了他：他既不知道两派的依据，也无从判断该选哪个。
 *
 * 更关键的是它是**错的**：一个时辰是两个整小时，子时是 23:00–01:00。
 * 把 23:00–24:00 切出来当"早子时"、00:00–01:00 当"晚子时"，
 * 等于把一个时辰劈成两半，而另外十一个时辰都不拆——
 * 同一条时间轴上只有子时享受特殊待遇，这件事本身没有依据。
 *
 * 所以：**子时就是 23:00–01:00，23:00 起算次日**。
 * 规则唯一，但仍然写进口径行——规则唯一不等于可以不说。
 */

import { queryModule } from "../datasource/runner";
import { bigOf } from "../datasource/sqlite";
import { BRANCHES, branchIndexOfHour, sexagenary, STEMS } from "../share/calendar/sexagenary";

/** 起课输入。 */
export interface MomentInput {
    /** 公历年（天文纪年） */
    year: number;
    /** 公历月 */
    month: number;
    /** 公历日 */
    day: number;
    /** 时（0–23，北京时间） */
    hour: number;
    /** 分 */
    minute: number;
    /** 出生地经度（东经为正）；`null` 表示不做真太阳时换算 */
    longitude: number | null;
    /** 性别，紫微与大运要用 */
    gender: "male" | "female";
}

/** 一个时刻的完整历法表达。 */
export interface MomentFacts {
    /** `YYYY-MM-DD` */
    key: string;
    /** 当天的 `absolute`（0 点） */
    absolute: bigint;
    /** 真太阳时偏移（秒）；未给经度时为 `0` */
    solarOffsetSeconds: number;
    /** 换算后的时（可能为负或 ≥24，表示跨日） */
    trueSolarHour: number;
    /** 换算后的分 */
    trueSolarMinute: number;
    /** 时支序号 0–11 */
    hourBranch: number;
    /** 时辰干支（时柱），两字 */
    hourPillar: string;
    /** 日干支（日柱），两字 */
    dayPillar: string;
    /** 月干支（月柱），两字 */
    monthPillar: string;
    /** 年干支（年柱），两字 */
    yearPillar: string;
    /** 年柱对应的公历年 */
    ceYear: number;
    /** 当前所属节气 */
    solarTerm: string;
    /** 交节时刻与此刻的距离（秒，正数表示已过） */
    sinceTermSeconds: number;
    /** 是不是因为真太阳时过 23:00 而进了次日 */
    rolledOver: boolean;
    /** 口径说明的行，逐条列出换算 */
    notes: { label: string; value: string }[];
}

/** 默认输入：现在。 */
export function defaultMomentInput(): MomentInput {
    const now = new Date();
    return {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
        minute: now.getMinutes(),
        longitude: null,
        gender: "male"
    };
}

/**
 * 由输入解出全部历法事实。
 *
 * 数据全部来自分库（`tree_year` / `tree_month` / `phenology`），
 * **不在界面里推**——干支的换年点是立春、换月点是交节，两者都是库里的精确时刻。
 */
export async function deriveMoment(input: MomentInput): Promise<MomentFacts | null> {
    /* 这一天的 `absolute`：查 `gregory_month`，不自己算（见 civil-date.ts 的说明） */
    const monthRows = await queryModule(
        "gregory",
        `SELECT "start", "lengthOfDay" FROM "gregory_month" WHERE "year" = :year AND "ordinal" = :month LIMIT 1`,
        { year: input.year + 10_000, month: input.month }
    );
    const monthRow = monthRows[0];
    if (monthRow === undefined) {
        return null;
    }
    const dayStart = bigOf(monthRow.start) + BigInt(input.day - 1) * 86_400n;
    const key = `${String(input.year).padStart(4, "0")}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")}`;

    /*
     * 真太阳时 = 钟表时间 + 经度差。
     *
     * 东经 1° ≈ 4 分钟；中国标准时以东经 120° 为基准，
     * 所以偏移秒数 = (经度 − 120) × 240（提前为正）。
     *
     * 只做经度差，**不做均时差**（轨道偏心与黄赤交角造成的 ±16 分钟摆动）——
     * 那要查星历，而命理传统上忽略它。与其算一个半对的，不如只算经度并写明。
     */
    const solarOffsetSeconds = input.longitude === null ? 0 : Math.round((input.longitude - 120) * 240);
    const clockSeconds = input.hour * 3600 + input.minute * 60;
    const trueSeconds = clockSeconds + solarOffsetSeconds;
    const trueHour = Math.floor(trueSeconds / 3600);

    /*
     * 换日：**23:00 起算次日**。
     *
     * 判断放在真太阳时之后——跨不跨日取决于真太阳时，不是钟表时间。
     */
    const rolledOver = trueHour >= 23;
    const dayBase = rolledOver ? dayStart + 86_400n : dayStart;

    /* 时支：真太阳时决定 */
    const normalizedHour = ((trueHour % 24) + 24) % 24;
    const hourBranch = branchIndexOfHour(normalizedHour);

    /* 年柱、月柱：取自库的精确时刻 */
    const [yearRows, monthPillarRows, termRows] = await Promise.all([
        queryModule(
            "tree",
            `SELECT "absolute" FROM "tree_year" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            { a: dayBase }
        ),
        queryModule(
            "tree",
            `SELECT "relative" FROM "tree_month" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            { a: dayBase }
        ),
        queryModule(
            "phenology",
            `SELECT "name", "start", "end" FROM "phenology" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            { a: dayBase }
        )
    ]);

    /*
     * 年柱：**由公历年按公认锚点推**，不从 `tree_year.relative` 取。
     *
     * `tree_year.absolute` 是**该干支年所在的公历年**（实测含 2026 的那一行 = 2026），
     * 而 `relative` 只是该表内的序号（同一行是 4718）。
     * 原先写 `sexagenary(relative - 1)` 得到 4717 → 37 → **辛丑**，
     * 而 2026 应是**丙午**（index 42）。
     *
     * 锚点用 `1984 = 甲子`——公认且可独立核对：
     * 1984 甲子、2000 庚辰、2024 甲辰、2025 乙巳、2026 丙午。
     * 它与本项目自己的建元口径自洽：建元 -2696 是甲子
     * （`-2696 + 2696 = 0 → 甲子`），与 `src/entity/natural.ts` 的"上元甲子"一致。
     */
    const yearRow = yearRows[0];
    const ceYear = yearRow === undefined ? input.year : Number(bigOf(yearRow.absolute));
    const yearPillar = sexagenary(ceYear + 2696);

    /* 月柱：`tree_month.relative` 从 1 起，序号减一 */
    const monthIndex = monthPillarRows[0] === undefined ? 0 : Number(bigOf(monthPillarRows[0].relative)) - 1;
    const monthPillar = sexagenary(monthIndex);

    /*
     * 日柱：建元当天为甲子日，而建元当天的 0 点是 `absolute` 86400
     * （建元 -2696-03-11 01:45:49 = 92749，当天 0 点 = 92749 − 6349 = 86400）。
     * 所以日序号 = `absolute / 86400 − 1`。
     */
    const dayIndex = Number(dayBase / 86_400n) - 1;
    const dayPillar = sexagenary(dayIndex);

    /* 时柱：日干决定时干起点（甲己还加甲、乙庚丙作初…） */
    const dayStem = ((dayIndex % 10) + 10) % 10;
    const hourStem = ((dayStem % 5) * 2 + hourBranch) % 10;
    const hourPillar = `${STEMS[hourStem]}${BRANCHES[hourBranch]}`;

    const term = termRows[0];
    const termName = term === undefined ? "" : String(term.name);
    const termStart = term === undefined ? dayBase : bigOf(term.start);

    const displayHour = Math.floor((((trueSeconds % 86_400) + 86_400) % 86_400) / 3600);
    const displayMinute = Math.floor(((((trueSeconds % 86_400) + 86_400) % 86_400) % 3600) / 60);
    const offsetMinutes = Math.round(solarOffsetSeconds / 60);
    const offsetText =
        input.longitude === null
            ? "未填经度，按北京时间"
            : `${offsetMinutes >= 0 ? "+" : "−"}${Math.abs(Math.floor(offsetMinutes / 60))}h${String(Math.abs(offsetMinutes % 60)).padStart(2, "0")}m`;

    return {
        key,
        absolute: dayBase,
        solarOffsetSeconds,
        trueSolarHour: trueHour,
        trueSolarMinute: displayMinute,
        hourBranch,
        hourPillar,
        dayPillar,
        monthPillar,
        yearPillar,
        ceYear,
        solarTerm: termName,
        sinceTermSeconds: Number(dayBase - termStart),
        rolledOver,
        notes: [
            {
                label: "钟表时间",
                value: `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}（东经 120° 基准）`
            },
            {
                label: "真太阳时",
                value: `${String(displayHour).padStart(2, "0")}:${String(displayMinute).padStart(2, "0")}（${offsetText}，未含均时差）`
            },
            { label: "时辰", value: `${BRANCHES[hourBranch]}时 · ${hourPillar}` },
            {
                label: "换日",
                value: rolledOver ? "真太阳时已过 23:00，进次日" : "23:00 起算次日（子时不拆）"
            },
            {
                label: "所处节气",
                value:
                    termName.length > 0
                        ? `${termName}（交节后 ${Math.floor(Number(dayBase - termStart) / 86_400)} 天）`
                        : "—"
            }
        ]
    };
}

/** 建元当天的 `absolute`。 */
export const EPOCH_DAY = 86_400n;

/** 由日柱反推旬空（空亡）。 */
export const voidBranchesOf = (dayIndex: number): string => {
    const stem = ((dayIndex % 10) + 10) % 10;
    const branch = ((dayIndex % 12) + 12) % 12;
    const offset = branch - stem;
    const start = (((offset % 12) + 12) % 12);
    return `${BRANCHES[(start + 10) % 12]}${BRANCHES[(start + 11) % 12]}`;
};
