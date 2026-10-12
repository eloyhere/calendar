/**
 * 路由表：**唯一配置**。
 *
 * 侧栏菜单（`plugin/menu.ts`）、面包屑（`component/AppBreadcrumb.vue`）、窗口标题
 * 都从这棵树推导，不另写一份列表。新增页面 = 在这里加一条路由。
 *
 * ## 结构
 *
 * ```
 * /                       AppShell（ElContainer + 页头 + 面包屑 + <RouterView/>）
 * ├─ （空路径）           概览
 * ├─ /agent              智能体
 * ├─ /calendar           历法
 * ├─ /numerology         命理
 * ├─ /year               年
 * └─ /performance        性能
 * ```
 *
 * 三种节点：
 *
 * 1. **域**（`/calendar`）：`component` 指向 `view/<Domain>View.vue`，
 *    那个文件只写一个 `<RouterView />` 把渲染委托给下一层。域自身带 `redirect`，
 *    直接访问时落到默认子页。
 * 2. **页**：真正要写内容的页面。
 * 3. **分组**（`/calendar/astronomy` 这类历法实体）：没有 `component`，
 *    只负责在菜单里收纳"简介 / 日历 / 数据"三项，点它只展开不跳转。
 *    菜单侧由 `plugin/menu.ts` 判 `component` 是否存在。
 *
 * ## 为什么这张表里没有任何函数
 *
 * 这里是**纯配置**：整棵树逐条写死，没有生成器、没有拼路径的辅助函数。8 个历法
 * 实体的三件套形状相同，本可以循环生成，但那会让"某个实体少一页""标题写成别的"
 * 这类差异藏在参数里而非表里——读路由表时得先在心里跑一遍生成器。代价是这张表
 * 长一些，换来的是**每一页都能被直接检索到**。
 *
 * 由此表里每一层的 `path` 都写成**绝对路径**（`/calendar/astronomy/entry`），
 * 相对路径与空路径不再出现，菜单与面包屑因此可以直接取 `route.path`，
 * 不需要任何拼接。
 *
 * ## 外壳挂在 `/`、概览反而是它的子页
 *
 * 更直觉的两种写法都不成立，记在这里免得再试：
 *
 * - 外壳挂 `/overview` + `alias: "/"`：别名会与**已注册的兄弟路由争抢匹配**，
 *   实测 `/agent`、`/calendar` 全被别名抢走落到概览；
 * - `/` 纯 redirect 到 `/overview` + 外壳挂 `/overview`：外壳就同时需要
 *   `component` 与 `redirect`，而 `RouteRecordRedirect` 的 `component` 是 `never`。
 *
 * 所以外壳占 `/`，概览是它的空路径子页；写错的地址由域内的兜底拉回 `/`。
 *
 * ## 一律懒加载
 *
 * 每个 `component` 都是 `() => import("../view/...")`，且**必须是静态字面量**：
 * 动态模板串 Vite 静态分析不出来，构建期解析不出 chunk。
 *
 * ## history 模式与 `file://` 的冲突（打包前必读）
 *
 * 路由用 `createWebHistory()`。开发期（dev server）与 `electron-vite preview`
 * 都是 http，history 模式完全正常。
 *
 * 但打包后主进程是 `loadFile(...)`，页面跑在 `file://` 下，而 `file://` 的
 * 来源是 opaque 的：`history.pushState` 会抛 SecurityError，刷新与深链也会去请求
 * 真实文件路径而 404。**要让打包产物也能用 history 模式，必须让主进程用自定义
 * 协议（`protocol.handle("app://")` + `registerSchemesAsPrivileged`）装载页面，
 * 而不是 `loadFile`。** 只改这里不够，详见 `main/window.ts` 的 `loadRenderer`。
 */

import { createRouter, createWebHashHistory } from "./dependencies";
import type { RouteRecordRaw, Router, RouterHistory } from "./dependencies";
import type { AppRoute } from "./route-meta";

/**
 * 把路由的 `path` 规范化成可直接用于菜单 index 的绝对路径。
 *
 * 三种输入都要处理，缺一个菜单就指错地方：绝对路径原样返回、相对路径按父链
 * 拼接、空串（概览那种 `path: ""` 的子页）返回父路径本身。
 */
export function resolveRoutePath(path: string, parentPath = ""): string {
    const base = parentPath.endsWith("/") && parentPath !== "/" ? parentPath.slice(0, -1) : parentPath;

    if (path === "") {
        return base === "" ? "/" : base;
    }
    if (path.startsWith("/")) {
        return path;
    }
    return base === "/" ? `/${path}` : `${base}/${path}`;
}

/**
 * 创建应用路由实例。
 *
 * - `history` 用 **hash 模式**：应用由 Electron 以 `file://` 装载 `index.html`，
 *   history 模式在刷新与深链时会去请求真实文件路径而 404；
 * - `list` 默认就是真实路由表，留出来是给测试注入"把 `component` 换成空壳"的
 *   副本——Node 加载不了 `.vue`，而路由解析与组件内容无关。
 */
export function createAppRouter(history?: RouterHistory, list: readonly AppRoute[] = routes): Router {
    return createRouter({
        history: history ?? createWebHashHistory(),
        routes: list as RouteRecordRaw[],
        // 内容区是 `ElMain` 自己在滚，换页后停在上一页的滚动位置会让人以为没跳转
        scrollBehavior: () => ({ top: 0 })
    });
}

/** 路由名。全应用只有这一处写路由名字符串。 */
export const RouteName = {
    home: "home",
    overview: "overview",
    fallback: "fallback",

    agent: "agent",
    agentChat: "agent-chat",
    agentChatCreate: "agent-chat-create",
    agentChatHistory: "agent-chat-history",
    agentChatResearch: "agent-chat-research",
    agentChatSurvey: "agent-chat-survey",
    agentChatThought: "agent-chat-thought",
    agentChatTopic: "agent-chat-topic",
    agentFlow: "agent-flow",

    calendar: "calendar",
    calendarAstronomy: "calendar-astronomy",
    calendarAstronomyEntry: "calendar-astronomy-entry",
    calendarAstronomyCalendar: "calendar-astronomy-calendar",
    calendarAstronomyData: "calendar-astronomy-data",
    calendarGregory: "calendar-gregory",
    calendarGregoryEntry: "calendar-gregory-entry",
    calendarGregoryCalendar: "calendar-gregory-calendar",
    calendarGregoryData: "calendar-gregory-data",
    calendarJupiter: "calendar-jupiter",
    calendarJupiterEntry: "calendar-jupiter-entry",
    calendarJupiterCalendar: "calendar-jupiter-calendar",
    calendarJupiterData: "calendar-jupiter-data",
    calendarNatural: "calendar-natural",
    calendarNaturalEntry: "calendar-natural-entry",
    calendarNaturalCalendar: "calendar-natural-calendar",
    calendarNaturalData: "calendar-natural-data",
    calendarSynodic: "calendar-synodic",
    calendarSynodicEntry: "calendar-synodic-entry",
    calendarSynodicCalendar: "calendar-synodic-calendar",
    calendarSynodicData: "calendar-synodic-data",
    calendarTree: "calendar-tree",
    calendarTreeEntry: "calendar-tree-entry",
    calendarTreeCalendar: "calendar-tree-calendar",
    calendarTreeData: "calendar-tree-data",
    calendarTropical: "calendar-tropical",
    calendarTropicalEntry: "calendar-tropical-entry",
    calendarTropicalCalendar: "calendar-tropical-calendar",
    calendarTropicalData: "calendar-tropical-data",
    calendarChronology: "calendar-chronology",
    calendarChronologyEntry: "calendar-chronology-entry",
    calendarChronologyData: "calendar-chronology-data",
    calendarClimate: "calendar-climate",
    calendarClimateEntry: "calendar-climate-entry",
    calendarClimateData: "calendar-climate-data",

    numerology: "numerology",
    numerologyWiki: "numerology-wiki",
    numerologyBazi: "numerology-bazi",
    numerologyZiwei: "numerology-ziwei",
    numerologyQizheng: "numerology-qizheng",
    numerologyGua: "numerology-gua",
    numerologyHoroscope: "numerology-horoscope",

    year: "year",
    yearTropical: "year-tropical",

    performance: "performance",
    performanceOverview: "performance-overview",
    performanceDatasource: "performance-datasource"
} as const;

/**
 * 应用路由树。
 *
 * 每条 `path` 都是绝对路径，菜单与面包屑直接取用，不做拼接。
 */
export const routes: AppRoute[] = [
    {
        path: "/",
        name: RouteName.home,
        component: () => import("../component/AppShell.vue"),
        // 外壳自己不是页面，标题挂在下面那个空路径子页上
        meta: { menu: false },
        children: [
            {
                // 概览：外壳的默认子页，路径就是 `/`
                path: "",
                name: RouteName.overview,
                component: () => import("../view/OverviewView.vue"),
                meta: {
                    title: "概览",
                    icon: "Odometer",
                    description: "全库规模、数据源与最近的构建状态"
                }
            },

            /* ── 智能体 ───────────────────────────────────────────────────── */
            {
                path: "/agent",
                name: RouteName.agent,
                component: () => import("../view/AgentView.vue"),
                redirect: "/agent/chat/create",
                meta: { title: "智能体", icon: "MagicStick" },
                children: [
                    {
                        // 六个聊天模式的共同出口，本身不进菜单
                        path: "/agent/chat",
                        name: RouteName.agentChat,
                        component: () => import("../view/agent/ChatView.vue"),
                        redirect: "/agent/chat/create",
                        meta: { title: "对话", icon: "ChatLineSquare", menu: false },
                        children: [
                            {
                                path: "/agent/chat/create",
                                name: RouteName.agentChatCreate,
                                component: () => import("../view/agent/ChatCreateView.vue"),
                                meta: {
                                    title: "新建对话",
                                    icon: "ChatDotRound",
                                    description: "与助手自由对话，快速开始任务"
                                }
                            },
                            {
                                path: "/agent/chat/history",
                                name: RouteName.agentChatHistory,
                                component: () => import("../view/agent/ChatHistoryView.vue"),
                                meta: {
                                    title: "历史对话",
                                    icon: "Clock",
                                    description: "检索、继续或清理此前的会话"
                                }
                            },
                            {
                                path: "/agent/chat/research",
                                name: RouteName.agentChatResearch,
                                component: () => import("../view/agent/ChatResearchView.vue"),
                                meta: {
                                    title: "深度研究",
                                    icon: "Search",
                                    description: "检索可信资料，深入分析课题并生成报告"
                                }
                            },
                            {
                                path: "/agent/chat/survey",
                                name: RouteName.agentChatSurvey,
                                component: () => import("../view/agent/ChatSurveyView.vue"),
                                meta: {
                                    title: "数据调研",
                                    icon: "TrendCharts",
                                    description: "查找相关数据，建立统计模型并输出分析结果"
                                }
                            },
                            {
                                path: "/agent/chat/thought",
                                name: RouteName.agentChatThought,
                                component: () => import("../view/agent/ChatThoughtView.vue"),
                                meta: {
                                    title: "思维碰撞",
                                    icon: "Promotion",
                                    description: "助手向你提问，帮你梳理和拓展思考链路"
                                }
                            },
                            {
                                path: "/agent/chat/topic",
                                name: RouteName.agentChatTopic,
                                component: () => import("../view/agent/ChatTopicView.vue"),
                                meta: {
                                    title: "课题研究",
                                    icon: "Collection",
                                    description: "围绕指定课题检索资料并生成分析"
                                }
                            }
                        ]
                    },
                    {
                        path: "/agent/flow",
                        name: RouteName.agentFlow,
                        component: () => import("../view/agent/FlowView.vue"),
                        meta: {
                            title: "工作流",
                            icon: "Connection",
                            description: "把多次对话编排成可复用的流程"
                        }
                    }
                ]
            },

            /* ── 历法 ─────────────────────────────────────────────────────── */
            {
                path: "/calendar",
                name: RouteName.calendar,
                component: () => import("../view/CalendarView.vue"),
                redirect: "/calendar/astronomy/entry",
                meta: { title: "历法", icon: "Calendar" },
                children: [
                    /* 天文历 */
                    {
                        path: "/calendar/astronomy",
                        name: RouteName.calendarAstronomy,
                        redirect: "/calendar/astronomy/entry",
                        meta: { title: "天文历", icon: "Star", menu: false },
                        children: [
                            {
                                path: "/calendar/astronomy/entry",
                                name: RouteName.calendarAstronomyEntry,
                                component: () => import("../view/calendar/astronomy/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "天文历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/astronomy/calendar",
                                name: RouteName.calendarAstronomyCalendar,
                                component: () => import("../view/calendar/astronomy/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "天文历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/astronomy/data",
                                name: RouteName.calendarAstronomyData,
                                component: () => import("../view/calendar/astronomy/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "天文历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 格里高丽历 */
                    {
                        path: "/calendar/gregory",
                        name: RouteName.calendarGregory,
                        redirect: "/calendar/gregory/entry",
                        meta: { title: "格里高丽历", icon: "Sunny", menu: false },
                        children: [
                            {
                                path: "/calendar/gregory/entry",
                                name: RouteName.calendarGregoryEntry,
                                component: () => import("../view/calendar/gregory/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "格里高丽历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/gregory/calendar",
                                name: RouteName.calendarGregoryCalendar,
                                component: () => import("../view/calendar/gregory/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "格里高丽历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/gregory/data",
                                name: RouteName.calendarGregoryData,
                                component: () => import("../view/calendar/gregory/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "格里高丽历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 木星历 */
                    {
                        path: "/calendar/jupiter",
                        name: RouteName.calendarJupiter,
                        redirect: "/calendar/jupiter/entry",
                        meta: { title: "木星历", icon: "Opportunity", menu: false },
                        children: [
                            {
                                path: "/calendar/jupiter/entry",
                                name: RouteName.calendarJupiterEntry,
                                component: () => import("../view/calendar/jupiter/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "木星历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/jupiter/calendar",
                                name: RouteName.calendarJupiterCalendar,
                                component: () => import("../view/calendar/jupiter/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "木星历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/jupiter/data",
                                name: RouteName.calendarJupiterData,
                                component: () => import("../view/calendar/jupiter/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "木星历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 轩辕历 */
                    {
                        path: "/calendar/natural",
                        name: RouteName.calendarNatural,
                        redirect: "/calendar/natural/entry",
                        meta: { title: "轩辕历", icon: "Guide", menu: false },
                        children: [
                            {
                                path: "/calendar/natural/entry",
                                name: RouteName.calendarNaturalEntry,
                                component: () => import("../view/calendar/natural/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "轩辕历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/natural/calendar",
                                name: RouteName.calendarNaturalCalendar,
                                component: () => import("../view/calendar/natural/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "轩辕历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/natural/data",
                                name: RouteName.calendarNaturalData,
                                component: () => import("../view/calendar/natural/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "轩辕历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 朔望历 */
                    {
                        path: "/calendar/synodic",
                        name: RouteName.calendarSynodic,
                        redirect: "/calendar/synodic/entry",
                        meta: { title: "朔望历", icon: "MoonNight", menu: false },
                        children: [
                            {
                                path: "/calendar/synodic/entry",
                                name: RouteName.calendarSynodicEntry,
                                component: () => import("../view/calendar/synodic/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "朔望历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/synodic/calendar",
                                name: RouteName.calendarSynodicCalendar,
                                component: () => import("../view/calendar/synodic/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "朔望历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/synodic/data",
                                name: RouteName.calendarSynodicData,
                                component: () => import("../view/calendar/synodic/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "朔望历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 干支历 */
                    {
                        path: "/calendar/tree",
                        name: RouteName.calendarTree,
                        redirect: "/calendar/tree/entry",
                        meta: { title: "干支历", icon: "Connection", menu: false },
                        children: [
                            {
                                path: "/calendar/tree/entry",
                                name: RouteName.calendarTreeEntry,
                                component: () => import("../view/calendar/tree/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "干支历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/tree/calendar",
                                name: RouteName.calendarTreeCalendar,
                                component: () => import("../view/calendar/tree/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "干支历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/tree/data",
                                name: RouteName.calendarTreeData,
                                component: () => import("../view/calendar/tree/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "干支历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 回归历 */
                    {
                        path: "/calendar/tropical",
                        name: RouteName.calendarTropical,
                        redirect: "/calendar/tropical/entry",
                        meta: { title: "回归历", icon: "Compass", menu: false },
                        children: [
                            {
                                path: "/calendar/tropical/entry",
                                name: RouteName.calendarTropicalEntry,
                                component: () => import("../view/calendar/tropical/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "回归历的规则、建元与换算"
                                }
                            },
                            {
                                path: "/calendar/tropical/calendar",
                                name: RouteName.calendarTropicalCalendar,
                                component: () => import("../view/calendar/tropical/CalendarView.vue"),
                                meta: {
                                    title: "日历",
                                    icon: "Grid",
                                    description: "回归历的年 / 月 / 日视图"
                                }
                            },
                            {
                                path: "/calendar/tropical/data",
                                name: RouteName.calendarTropicalData,
                                component: () => import("../view/calendar/tropical/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "回归历的历表数据"
                                }
                            }
                        ]
                    },

                    /* 年表与节气表没有"日历"页：它们是表，不是一个历法体系的年月视图 */
                    {
                        path: "/calendar/chronology",
                        name: RouteName.calendarChronology,
                        redirect: "/calendar/chronology/entry",
                        meta: { title: "年表", icon: "Memo", menu: false },
                        children: [
                            {
                                path: "/calendar/chronology/entry",
                                name: RouteName.calendarChronologyEntry,
                                component: () => import("../view/calendar/chronology/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "年表的口径与收录范围"
                                }
                            },
                            {
                                path: "/calendar/chronology/data",
                                name: RouteName.calendarChronologyData,
                                component: () => import("../view/calendar/chronology/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "朝代、年号与事件的年表数据"
                                }
                            }
                        ]
                    },
                    {
                        path: "/calendar/climate",
                        name: RouteName.calendarClimate,
                        redirect: "/calendar/climate/entry",
                        meta: { title: "节气表", icon: "Sunny", menu: false },
                        children: [
                            {
                                path: "/calendar/climate/entry",
                                name: RouteName.calendarClimateEntry,
                                component: () => import("../view/calendar/climate/EntryView.vue"),
                                meta: {
                                    title: "简介",
                                    icon: "Notebook",
                                    description: "节气与物候的划分依据"
                                }
                            },
                            {
                                path: "/calendar/climate/data",
                                name: RouteName.calendarClimateData,
                                component: () => import("../view/calendar/climate/DataView.vue"),
                                meta: {
                                    title: "数据",
                                    icon: "DataLine",
                                    description: "节气、物候的时刻表"
                                }
                            }
                        ]
                    }
                ]
            },

            /* ── 命理 ─────────────────────────────────────────────────────── */
            {
                path: "/numerology",
                name: RouteName.numerology,
                component: () => import("../view/NumerologyView.vue"),
                redirect: "/numerology/wiki",
                meta: { title: "命理", icon: "MagicStick" },
                children: [
                    {
                        path: "/numerology/wiki",
                        name: RouteName.numerologyWiki,
                        component: () => import("../view/numerology/WikiView.vue"),
                        meta: {
                            title: "命理百科",
                            icon: "Reading",
                            description: "术语、流派与推演方法的总览"
                        }
                    },
                    {
                        path: "/numerology/bazi",
                        name: RouteName.numerologyBazi,
                        component: () => import("../view/numerology/BaziView.vue"),
                        meta: {
                            title: "八字排盘",
                            icon: "Coin",
                            description: "以出生时刻排出四柱与大运"
                        }
                    },
                    {
                        path: "/numerology/ziwei",
                        name: RouteName.numerologyZiwei,
                        component: () => import("../view/numerology/ZiweiView.vue"),
                        meta: {
                            title: "紫微斗数",
                            icon: "Star",
                            description: "安十二宫与诸星，推演命盘"
                        }
                    },
                    {
                        path: "/numerology/qizheng",
                        name: RouteName.numerologyQizheng,
                        component: () => import("../view/numerology/QizhengView.vue"),
                        meta: {
                            title: "七政四余",
                            icon: "Opportunity",
                            description: "日月五星与四余的躔度"
                        }
                    },
                    {
                        path: "/numerology/gua",
                        name: RouteName.numerologyGua,
                        component: () => import("../view/numerology/GuaView.vue"),
                        meta: {
                            title: "卦象分析",
                            icon: "Connection",
                            description: "起卦、装卦与卦象解读"
                        }
                    },
                    {
                        path: "/numerology/horoscope",
                        name: RouteName.numerologyHoroscope,
                        component: () => import("../view/numerology/HoroscopeView.vue"),
                        meta: {
                            title: "星盘",
                            icon: "Compass",
                            description: "以天文坐标绘制星盘"
                        }
                    }
                ]
            },

            /* ── 年 ───────────────────────────────────────────────────────── */
            {
                path: "/year",
                name: RouteName.year,
                component: () => import("../view/YearView.vue"),
                redirect: "/year/tropical",
                meta: { title: "年", icon: "Timer" },
                children: [
                    {
                        path: "/year/tropical",
                        name: RouteName.yearTropical,
                        component: () => import("../view/year/TropicalView.vue"),
                        meta: {
                            title: "回归年",
                            icon: "Timer",
                            description: "太阳两次过春分点的时间长度"
                        }
                    }
                ]
            },

            /* ── 性能 ─────────────────────────────────────────────────────── */
            {
                path: "/performance",
                name: RouteName.performance,
                component: () => import("../view/PerformanceView.vue"),
                redirect: "/performance/overview",
                meta: { title: "性能", icon: "Monitor" },
                children: [
                    {
                        path: "/performance/overview",
                        name: RouteName.performanceOverview,
                        component: () => import("../view/performance/OverviewView.vue"),
                        meta: {
                            title: "概览",
                            icon: "Histogram",
                            description: "查询耗时、缓存命中与内存占用"
                        }
                    },
                    {
                        path: "/performance/datasource",
                        name: RouteName.performanceDatasource,
                        component: () => import("../view/performance/DatasourceView.vue"),
                        meta: {
                            title: "数据信息",
                            icon: "DataBoard",
                            description: "22 个分库的表结构、行数与构建时间"
                        }
                    }
                ]
            },

            {
                // 兜底：写错的地址回到概览。目标写路径而不是 `{ name }`，
                // 否则当前匹配出的 `pathMatch` 会被带过去并触发一条 router 警告。
                path: "/:pathMatch(.*)*",
                name: RouteName.fallback,
                meta: { menu: false },
                redirect: "/"
            }
        ]
    }
];
