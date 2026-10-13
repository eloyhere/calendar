/**
 * 历法体系登记表：八套历法的**唯一来源**。
 *
 * ## 为什么需要它
 *
 * `docs/ui-architecture.md` §4.3.2 把原来 24 条历法路由（8 套体系 × 简介/日历/数据）
 * 压成了一条参数化路由 `/calendar/:system/:view?`。压完必须有东西回答
 * "`system` 的合法值有哪些、每套叫什么、用哪个分库、图标是什么"——
 * 那就是本文件。
 *
 * 做法与 `src/entity/chat.ts` 的 `ChatChannels` 一致：**形状 + 文案 + 图标 + 顺序的唯一来源**，
 * 路由只做参数匹配，页面对登记表取值。好处写在 `chat.ts` 的文件头里，这里同样适用。
 *
 * ## 行数是实测的，不是抄文档
 *
 * 每个体系的主表行数来自 `.temporary/probe-tables.tsv`（用 Electron 的 `node:sqlite`
 * 逐个 `COUNT(*)`）。`docs/design.md` §3 的表格是**构建当时**的快照，其中六个历法
 * 标着"0（换算法则待实现）"——那已经过时了，实测它们都有数据。
 * 界面上的行数一律**实时查**（`src/datasource/runner.ts` 的 `readModuleStates()`），
 * 这里只作为"库还没打开时"的显示兜底。
 */

import type { IconName } from "../plugin/icons";

/** 历法工作区的三个视图，与路由的 `:view` 参数一一对应。 */
export type CalendarViewId = "entry" | "calendar" | "data";

/** 八套历法的标识。 */
export type CalendarSystemId =
    | "synodic"
    | "gregory"
    | "climate"
    | "astronomy"
    | "jupiter"
    | "natural"
    | "tree"
    | "tropical"
    | "chronology";

/** 一套历法的描述。 */
export interface CalendarSystem {
    /** 标识，与路由参数、分库模块名一致 */
    id: CalendarSystemId;
    /** 中文名 */
    label: string;
    /** 图标，取值来自 `src/plugin/icons.ts` 的白名单 */
    icon: IconName;
    /** 一句话说明，出现在菜单提示与页头 */
    description: string;
    /** 这套历法在哪个分库里 */
    module: string;
    /** 主表（年表）与月表 */
    yearTable: string;
    monthTable: string;
    /** 主表实测行数，仅作兜底显示 */
    rows: number;
    /**
     * 这套历法的年有多长。
     *
     * 写在这里是因为**"一年几个月"本身就是要显示给用户的信息**：
     * 朔望历 12–13 个月（有闰月）、节气历 24、格里高利历 12。
     */
    monthsPerYear: string;
    /** 分界依据：年从哪一刻开始 */
    yearStart: string;
    /** 是否进入侧栏菜单（`docs/ui-architecture.md` §4.3.2 的"菜单里只出 4 项"） */
    inMenu: boolean;
}

/**
 * 八套历法。
 *
 * 顺序即菜单顺序（使用频率：朔望历有 29 万行真实历表，其次是现代参照系格里高利历，
 * 再是节气表，其余五套收进"更多历法"）。
 */
export const CalendarSystems: readonly CalendarSystem[] = [
    {
        id: "synodic",
        label: "朔望历",
        icon: "MoonNight",
        description: "以朔望月为月的历法，来自 calendar.xlsx 的 29 万条历表",
        module: "synodic",
        yearTable: "synodic_calendar_year",
        monthTable: "synodic_month",
        rows: 290_654,
        monthsPerYear: "12 或 13 个月（闰月按无中气置闰）",
        yearStart: "正月朔日",
        inMenu: true
    },
    {
        id: "gregory",
        label: "格里高利历",
        icon: "Sunny",
        description: "现代通用参照系，全库时间的对外表达",
        module: "gregory",
        yearTable: "gregory_year",
        monthTable: "gregory_month",
        rows: 23_501,
        monthsPerYear: "12 个月",
        yearStart: "1 月 1 日",
        inMenu: true
    },
    {
        id: "climate",
        label: "节气表",
        icon: "Clock",
        description: "以节气定年月；五天一气候，一年二十四气",
        module: "climate",
        yearTable: "climate_year",
        monthTable: "climate_month",
        rows: 1_743_926,
        monthsPerYear: "24 个月（一个节气一个月）",
        yearStart: "立春",
        inMenu: true
    },
    {
        id: "astronomy",
        label: "天文历",
        icon: "Star",
        description: "按天文量推算的年月，是其余历法的换算底座",
        module: "astronomy",
        yearTable: "astronomy_year",
        monthTable: "astronomy_month",
        rows: 23_500,
        monthsPerYear: "12 或 13 个月",
        yearStart: "天文合朔",
        inMenu: true
    },
    {
        id: "jupiter",
        label: "木星历",
        icon: "Opportunity",
        description: "以木星视运动定年月，岁星纪年的依据",
        module: "jupiter",
        yearTable: "jupiter_year",
        monthTable: "jupiter_month",
        rows: 1_982,
        monthsPerYear: "12 个月",
        yearStart: "木星与太阳同度",
        inMenu: false
    },
    {
        id: "natural",
        label: "轩辕历",
        icon: "Guide",
        description: "以建元 -2696-03-11 为起点的本历",
        module: "natural",
        yearTable: "natural_year",
        monthTable: "natural_month",
        rows: 290_654,
        monthsPerYear: "12 或 13 个月",
        yearStart: "建元同日",
        inMenu: false
    },
    {
        id: "tree",
        label: "干支历",
        icon: "Connection",
        description: "以立春为分界的干支纪年，六十甲子循环",
        module: "tree",
        yearTable: "tree_year",
        monthTable: "tree_month",
        rows: 281_273,
        monthsPerYear: "12 个月",
        yearStart: "立春",
        inMenu: false
    },
    {
        id: "tropical",
        label: "回归历",
        icon: "Compass",
        description: "以回归年（太阳两次过春分点）定年月",
        module: "tropical",
        yearTable: "tropical_year",
        monthTable: "tropical_month",
        rows: 23_500,
        monthsPerYear: "12 个月",
        yearStart: "春分",
        inMenu: false
    }
];

/** 编年表也在 `/calendar/:system` 下有一个入口，但它不是一个历法体系。 */
export const ChronologySystem: CalendarSystem = {
    id: "chronology",
    label: "年表",
    icon: "Memo",
    description: "每朔望年一条编年记录，串起朝代、年号与事件",
    module: "chronology",
    yearTable: "chronology",
    monthTable: "chronology",
    rows: 23_500,
    monthsPerYear: "—",
    yearStart: "—",
    inMenu: false
};

/** 全部合法 `system` 值（含年表）。路由与页面用它校验参数。 */
export const ALL_SYSTEMS: readonly CalendarSystem[] = [...CalendarSystems, ChronologySystem];

/** `system` → 登记项。 */
export const SYSTEM_BY_ID: ReadonlyMap<string, CalendarSystem> = new Map(
    ALL_SYSTEMS.map((system) => [system.id, system])
);

/** 取一套历法；非法 `id` 返回 `undefined`（页面据此渲染空态，而不是重定向）。 */
export const systemOf = (id: string | undefined): CalendarSystem | undefined =>
    id === undefined ? undefined : SYSTEM_BY_ID.get(id);

/** 三个视图的登记表，页内切换器与 URL 同步都用它。 */
export const CalendarViews: readonly { id: CalendarViewId; label: string; icon: IconName; description: string }[] = [
    {
        id: "entry",
        label: "简介",
        icon: "Notebook",
        description: "这套历法的规则、建元与换算口径"
    },
    {
        id: "calendar",
        label: "日历",
        icon: "Grid",
        description: "年 / 月 / 日三级视图，节气与月相作为叠加层"
    },
    {
        id: "data",
        label: "数据",
        icon: "DataLine",
        description: "这套历法的历表原始数据"
    }
];

/** 视图 id 是否合法。 */
export const isCalendarViewId = (value: string | undefined): value is CalendarViewId =>
    CalendarViews.some((view) => view.id === value);

/** 默认视图：简介。`/calendar/synodic` 会落到它。 */
export const DefaultCalendarView: CalendarViewId = "entry";
