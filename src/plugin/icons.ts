/**
 * 图标白名单：路由 `meta.icon` 能写的名字，全部登记在这里。
 *
 * 为什么要白名单而不是"随便写个字符串"：
 *
 * 1. `@element-plus/icons-vue` 导出 293 个组件，`plugins/icons.ts` 会把它们
 *    全部注册为全局组件。名字写错在模板里只会得到一句 Vue 警告加一个空白，
 *    不会报错——白名单把这类拼写错误交给 `vue-tsc` 拦住；
 * 2. `IconName` 这个联合类型让 `meta.icon` 只能取字面量，改名字编辑器会直接报。
 *
 * 增删图标：只改本文件的数组，菜单侧不需要任何改动。
 */

/** 允许在 `meta.icon` 里使用的图标名。 */
export const ICON_NAMES = [
    // ── 领域 ────────────────────────────────────────────────────────────────
    "Odometer",
    "MagicStick",
    "Calendar",
    "Timer",
    "Monitor",

    // ── 页面动作：简介 / 日历 / 数据 ─────────────────────────────────────────
    "Notebook",
    "Grid",
    "DataLine",
    "DataBoard",
    "Histogram",
    "Memo",
    "Reading",
    "Collection",

    // ── 历法意象 ────────────────────────────────────────────────────────────
    "Star",
    "Sunny",
    "Moon",
    "MoonNight",
    "Opportunity",
    "Guide",
    "Compass",
    "Connection",
    "Coin",
    "Clock",

    // ── 智能体 ──────────────────────────────────────────────────────────────
    "ChatDotRound",
    "ChatLineSquare",
    "Search",
    "TrendCharts",
    "Promotion",

    // ── 外壳与状态 ──────────────────────────────────────────────────────────
    "Fold",
    "Expand",
    "HomeFilled",
    "Refresh",
    "WarningFilled",
    "CircleCheckFilled"
] as const;

/** 图标名联合类型；`meta.icon` 只能取这里的字面量。 */
export type IconName = (typeof ICON_NAMES)[number];

/** 名字 -> 是否合法。 */
export function isIconName(name: string): name is IconName {
    return (ICON_NAMES as readonly string[]).includes(name);
}
