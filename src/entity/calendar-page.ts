/**
 * 历法页登记表：八套历法在界面上长什么样。
 *
 * ## 与 `entity/calendar.ts` 的分工
 *
 * `entity/calendar.ts` 是**数据**登记表：`system` 的合法值、分库名、年表/月表名。
 * 本文件是**界面**登记表：日历格子里画什么、图例有哪些、简介页说什么。
 *
 * 分两份而不是合成一份，是因为它们变化的理由不同——加一套历法要动数据那份，
 * 调格子里的显示要动界面这份。合成一份的话，改一个配色要读一整张分库表。
 *
 * ## 八套历法共用一个页面
 *
 * 路由是 `/calendar/:system/:view?`，八套历法各自是一个 `CalendarSystem`，
 * 页面按本表取"这套历法在格子里显示什么"。所以新增一套历法 = 加一条登记，
 * 不是加一个 `.vue`。
 */

import type { CalendarSystemId } from "./calendar";
import type { SystemMoment } from "../state/use-system-calendar";

/** 日历格子里的一行叠加信息。 */
export interface CellLayer {
    /** 图层 id */
    id: string;
    /** 图例文案 */
    label: string;
    /** 图例色块的颜色（CSS 值） */
    color: string;
    /**
     * 这个图层在格子里的**字号档**。
     *
     * 三档而不是"大小两个值"：格里最多塞三行叠加信息，
     * 多一行就要么换行要么截断，而截断的数字在历法里等于错误。
     */
    size: "primary" | "secondary" | "tertiary";
}

/** 一套历法在界面上怎么呈现。 */
export interface CalendarPageSpec {
    /** 与 `entity/calendar.ts` 的 `id` 一致 */
    id: CalendarSystemId;
    /** 页头的一句话定位 */
    tagline: string;
    /**
     * 日历格子的**主行**：这一格里最该被看到的那一个数。
     *
     * 八套历法各有各的"一天是什么"：朔望历是月相与农历日，干支历是干支日，
     * 节气历是节气名。把它们统一成"日"是不对的——节气历里一天可能没有节气。
     */
    primary: (context: CellContext) => string;
    /** 叠加行，最多两行 */
    layers: readonly CellLayer[];
    /**
     * **这套历法自己的年份文案**。
     *
     * 不复用同一句：格里高利历的年份是"公元 2026 年"，轩辕历是"第 4723 年"，
     * 干支历是"丙午年"，木星历是"第 399 年"——它们是四套互不相同的纪年。
     * 一开始八套历法共用 `*_year.relative` 当"年号"，于是格里高利历显示了
     * "第 4722 年"（那个数其实只是该表内的相对序号）。
     *
     * 写成函数而不是模板串：干支年要由公历年现推（锚点 1984 = 甲子），
     * 而公历年是查出来的。
     */
    yearLabel: (moment: SystemMoment) => string;
    /** 年视图里每一列（即每一月）的标题怎么写 */
    monthTitle: string;
    /** 简介页的一句话说清"这套历法的规则是什么" */
    rule: string;
    /** 建元 / 分界：年从哪一刻开始 */
    origin: string;
    /** 一年几个月，以及闰的处理 */
    months: string;
    /** 这套历法**为什么存在**——不是"它是什么"，是"什么时候要用它" */
    usage: string;
}

/** 画一格时能拿到的全部信息。 */
export interface CellContext {
    /** 公历年 */
    year: number;
    /** 公历月，1–12 */
    month: number;
    /** 公历日，1–31 */
    day: number;
    /** 星期，0 = 周日 */
    weekday: number;
    /** 这一天的起始 `absolute`（建元起算秒，当天 00:00:00） */
    absolute: bigint;
    /** 这一天的朔望月序号（全局），没有时为 `null` */
    monthIndex: number | null;
    /** 农历日名（初一、初二…），没有时为 `null` */
    lunarDay: string | null;
    /** 农历月名（正月、二月…），没有时为 `null` */
    lunarMonth: string | null;
    /** 月相段名（朔 / 上弦 / 望 / 下弦），没有时为 `null` */
    phase: string | null;
    /** 这一天是不是该月相段的**第一天** */
    phaseBegins: boolean;
    /** 节气段名，没有时为 `null` */
    solarTerm: string | null;
    /** 这一天是不是**交节当天** */
    solarTermBegins: boolean;
    /** 日干支，两字 */
    dayStemBranch: string;
    /** 年干支，两字 */
    yearStemBranch: string;
}

/**
 * 八套历法的界面规格。
 *
 * `primary` 都写成箭头函数而不是模板串：格子里那一行常常是"哪个有显示哪个"
 * （有节气显示节气、没有就显示农历日），写成函数最直白。
 */
export const CALENDAR_PAGES: readonly CalendarPageSpec[] = [
    {
        id: "natural",
        tagline: "以建元为原点的本历",
        yearLabel: (m) => lunarYearOf(m.ceYear),
        primary: (cell) => (cell.lunarDay === "初一" ? (cell.lunarMonth ?? "") : (cell.lunarDay ?? "")),
        layers: [
            { id: "sexagenary", label: "日干支", color: "var(--el-text-color-secondary)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "月",
        rule: "轩辕历以建元 -2696-03-11 为第一年正月初一。月按朔望月，无中气之月为闰月。",
        origin: "建元 -2696-03-11 01:45:49（当天为绝对时间 0）",
        months: "一年 12 或 13 个月；闰月按「无中气置闰」",
        usage: "要看「从建元到现在过了多少年」时用它。它是本应用所有相对时间的基准。"
    },
    {
        id: "synodic",
        tagline: "以朔望月为月，29 万条真实历表",
        /*
         * 初一写月名、其余写日名。
         *
         * 这是历书的排版惯例：一个月的**开头**需要被看见（"三月从这天起"），
         * 其余日子只需要"初几"。每天重复写月名的话，30 格里会有 30 遍同样的两个字，
         * 把格子里最该突出的那个数字淹掉。
         */
        yearLabel: (m) => lunarYearOf(m.ceYear),
        primary: (cell) => (cell.lunarDay === "初一" ? (cell.lunarMonth ?? "") : (cell.lunarDay ?? "")),
        layers: [
            { id: "phase", label: "月相", color: "var(--el-color-warning)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "朔望月",
        rule: "朔望月的长度是实际月长，29 或 30 天，不取平均值——每一条都来自 calendar.xlsx 的实测合朔时刻。",
        origin: "库内第一条为 -2696 年正月朔；共 290,654 个月",
        months: "一年 12 或 13 个月",
        usage: "要查「某天是农历初几、那天月相如何」时用它。"
    },
    {
        id: "gregory",
        tagline: "现代通用参照系",
        yearLabel: (m) => `公元 ${m.ceYear} 年`,
        primary: (cell) => String(cell.day),
        layers: [
            { id: "lunar", label: "农历", color: "var(--el-color-primary)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "月",
        rule: "1582 年 10 月 15 日之前的日期按**儒略历**外推，之后按格里高利历。本库在 1582 年有闰年规则的实际切换。",
        origin: "公元 1 年 1 月 1 日（外推）",
        months: "一年 12 个月",
        usage: "要和文化背景不同的人对齐日期、或读文献里的公元纪年时用它。"
    },
    {
        id: "astronomy",
        tagline: "按天文量推算，其余历法的换算底座",
        yearLabel: (m) => `公元 ${m.ceYear} 年`,
        primary: (cell) => String(cell.day),
        layers: [
            { id: "lunar", label: "朔望", color: "var(--el-color-primary)", size: "secondary" },
            { id: "jupiter", label: "岁星", color: "var(--el-color-warning)", size: "tertiary" }
        ],
        monthTitle: "天文月",
        rule: "天文月的分界是**合朔的实际时刻**，不是朔日的零点。所以一个天文月可能比朔望月差几分钟。",
        origin: "与建元同步的第一条天文合朔",
        months: "一年 12 或 13 个月",
        usage: "要算精确的天数差、或校验其余历法的换算时用它。"
    },
    {
        id: "jupiter",
        tagline: "把地球与木星绑起来：年取回归年，骨架是 11 会合 ≈ 12 年",
        yearLabel: (m) => `公元 ${m.ceYear} 年`,
        primary: (cell) => String(cell.day),
        layers: [
            { id: "lunar", label: "农历", color: "var(--el-color-primary)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "回归月",
        /*
         * 这一页的文案改过两次，每次都因为实测推翻了原来的说法。
         *
         * **第一次**（已废弃的说法）：写的是"以木星视运动定年月，岁星纪年的依据"，
         * 而库里那张表的年长是 4332.5 天——那是木星的**恒星**周期，
         * 不是视运动（视运动是地心所见，周期 398.88 天）。用词错了。
         *
         * **第二次**（已废弃）：改成"以木星公转一周为一年，十二等分"，
         * 并说明"十二个月是等时段，不是十二次"。那两句是对的，
         * 但那样一来这一页就只是"木星公转进度表"，与地球无关，也就不成其为历法。
         *
         * **现在（方案 A）**：年取**回归年**，与回归历、节气历同源；
         * 骨架是 **11 会合 = 12 年**（差 4.82 天）。会合相位由
         * `share/astronomy/jupiter-cycle.ts` 用地木日心黄经之差实时算出。
         *
         * 旧的 4332 天表没有删——它作为「木星恒星年」在侧栏另起一行，
         * 因为实测 4332.5 天与木星公转周期（4332.589 天）吻合，是有效数据。
         */
        rule: "年取**回归年**（365.2422 天），与回归历、节气历同源。骨架是 **11 会合 = 12 年**——11 个地球—木星会合周期共 4387.72 天，12 个回归年共 4382.91 天，**差 4.82 天**。这个差就是「超辰」，它不做闰月校正，直接显示在侧栏。",
        origin: "历元取一次真实合日（2000-11-28），相位由地木日心黄经之差实时算",
        months: "一年 12 个回归月，每月约 30.44 天（实长逐月查表）",
        usage: "要看木星什么时候冲日、什么时候合日、以及岁星纪年偏了多少天时用它。侧栏的**岁星**一行给「岁在X」，**会合**一行给相位与距冲日天数。"
    },
    {
        id: "tropical",
        tagline: "以太阳两次过春分点为一个回归年",
        yearLabel: (m) => `公元 ${m.ceYear} 年`,
        primary: (cell) => String(cell.day),
        layers: [
            { id: "lunar", label: "农历", color: "var(--el-color-primary)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "回归月",
        rule: "回归年长 365.2422 日，与朔望月不能通约——这正是「十九年七闰」要解决的问题。",
        origin: "建元当天起算的春分点",
        months: "一年 12 个月（每宫一个）",
        usage: "要讨论闰法、岁差，或比较不同文明的太阳历时用它。"
    },
    {
        id: "tree",
        tagline: "以立春为界的六十甲子纪年",
        yearLabel: (m) => `${ganzhiYear(m.ceYear)}年`,
        primary: (cell) => cell.dayStemBranch,
        layers: [
            { id: "lunar", label: "农历", color: "var(--el-color-primary)", size: "secondary" },
            { id: "term", label: "节气", color: "var(--el-color-success)", size: "tertiary" }
        ],
        monthTitle: "干支月",
        rule: "年干支的换年点是**立春**而不是正月初一。所以同一天在「农历年」与「干支年」里可能属于不同年份。",
        origin: "与建元同日的干支为上元甲子",
        months: "一年 12 个月，每月一个干支",
        usage: "排八字、看流年时用它。命理页的月柱就是从这套历法取的。"
    },
    {
        id: "climate",
        tagline: "二十四气七十二候",
        yearLabel: (m) => lunarYearOf(m.ceYear),
        primary: (cell) => cell.solarTerm ?? "",
        layers: [
            { id: "phenology", label: "物候", color: "var(--el-color-success)", size: "secondary" },
            { id: "lunar", label: "农历", color: "var(--el-color-primary)", size: "tertiary" }
        ],
        monthTitle: "节气月",
        rule: "节气按太阳黄经每 15° 一个，全年 24 个。节气所在的**时刻**才是分界，不是那一日的零点。",
        origin: "建元当天最近的立春",
        months: "一年 24 个节气（一气一月）",
        usage: "要种地、要定八字月柱、要看物候时用它。它是八套历法里唯一直接绑在太阳上的。"
    }
];

/**
 * 由公历年推**轩辕历（农历）年号**。
 *
 * 建元（-2696-03-11）是**第 1 年**，实测 `natural_year.absolute` 在 2026 年为 4723：
 *
 * ```
 * 2026 + 2697 = 4723   ✓
 * -2696 + 2697 = 1     ✓（建元即第 1 年）
 * ```
 *
 * ## 为什么朔望历与节气历也用它
 *
 * 这两套是**农历的两个面**：朔望历是月相面（一个朔望月 = 农历一个月），
 * 节气历是太阳面（中气决定闰月放在哪）。农历本身就是"以朔望定月、
 * 以中气定闰"的合成历——把它拆成两套历法看的时候，**纪年仍然是同一套**。
 *
 * 对比：格里高利历、天文历、回归历是各自独立的太阳历，各有自己的纪年，
 * 所以它们显示"公元 N 年"而不是农历年号。
 */
const lunarYearOf = (ceYear: number): string => `第 ${ceYear + 2697} 年`;

/**
 * 由公历年推干支年。
 *
 * 锚点 `1984 = 甲子`——公认且可独立核对：1984 甲子、2000 庚辰、
 * 2024 甲辰、2025 乙巳、2026 丙午。等价于 `(年 + 2696) mod 60`，
 * 而建元 -2696 恰好是甲子，与本项目自己的口径自洽。
 *
 * **注意换年点是立春**，不是元旦：`ceYear` 来自 `tree_year.absolute`，
 * 那一行的时间跨度本身就是立春到立春，所以传进来的已经是"干支年的公历年份"。
 */
const ganzhiYear = (ceYear: number): string => {
    const stems = "甲乙丙丁戊己庚辛壬癸";
    const branches = "子丑寅卯辰巳午未申酉戌亥";
    const n = (((ceYear + 2696) % 60) + 60) % 60;
    return `${stems[n % 10]}${branches[n % 12]}`;
};

/** `id` → 界面规格。 */
export const CALENDAR_PAGE_BY_ID: ReadonlyMap<string, CalendarPageSpec> = new Map(
    CALENDAR_PAGES.map((page) => [page.id, page])
);

/** 取一套历法的界面规格。 */
export const calendarPageOf = (id: string | undefined): CalendarPageSpec | undefined =>
    id === undefined ? undefined : CALENDAR_PAGE_BY_ID.get(id);
