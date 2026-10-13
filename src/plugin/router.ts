/**
 * 路由表：**唯一配置**。
 *
 * 侧栏（`component/AppRail.vue` + `AppDomainPanel.vue`）、命令面板、面包屑、窗口标题
 * 都从这棵树推导，不另写一份列表。新增页面 = 在这里加一条路由，再到
 * `src/entity/domain.ts` 的登记表里加一项（那份表决定它出现在哪个域的面板里，
 * 并会在启动时校验路径真的存在）。
 *
 * ## 结构（43 条）
 *
 * ```
 * /                                  AppShell（窄栏 + 二级面板 + 顶栏 + 内容 + 状态栏）
 * ├─ ""                               今日            工作台
 * ├─ /data/:page                      数据            工作台
 * ├─ /agent                           智能体
 * │  ├─ /agent/chat/:mode?            对话
 * │  ├─ /agent/flow                   工作流
 * │  ├─ /agent/flow/run               运行记录
 * │  ├─ /agent/report                 报告
 * │  └─ /agent/setting                智能体设置
 * ├─ /agent/flow/:id                  编排器          ← 沉浸布局，无窄栏
 * ├─ /calendar/:system/:view?         历法工作区      历法
 * ├─ /calendar/:system/table          历法数据表      历法
 * ├─ /chronology/:page                年表            历法
 * ├─ /astrology/:page                 命理
 * ├─ /divination/:page                数术
 * ├─ /sky/:page                       天象
 * ├─ /history/:page                   历史
 * ├─ /library/:page                   文献
 * ├─ /system/:page                    系统
 * └─ /:pathMatch(.*)*                 兜底回工作台
 * ```
 *
 * ## 为什么八个历法共用一条路由，而命理/数术也共用
 *
 * 它们的**页面形状相同**：一个时间视点、一套体系、一块结果。旧表把 8 套历法
 * × 3 个视图写成 24 条路由 24 个文件，那不是 24 个功能，是 24 份拷贝。
 * 参数化之后"某个体系少一页"这类差异藏进了登记表——所以登记表必须显式
 * （`src/entity/calendar.ts` 与 `src/entity/domain.ts`），而不是靠路由表的行数体现。
 *
 * ## 为什么这张表里没有任何函数
 *
 * 这里是**纯配置**：整棵树逐条写死，没有生成器、没有拼路径的辅助函数。代价是表长，
 * 换来的是**每一页都能被直接检索到**。由此表里每一层的 `path` 都写成**绝对路径**，
 * 菜单与面包屑因此可以直接取 `route.path`，不需要任何拼接。
 *
 * ## 外壳挂在 `/`、今日是它的空路径子页
 *
 * 另外两种写法都实测失败，记在这里免得再试：
 *
 * - 外壳挂 `/overview` + `alias: "/"`：别名会与**已注册的兄弟路由争抢匹配**，
 *   实测 `/agent`、`/calendar` 全被别名抢走落到工作台；
 * - `/` 纯 redirect 到 `/dashboard` + 外壳挂 `/dashboard`：外壳就同时需要
 *   `component` 与 `redirect`，而 `RouteRecordRedirect` 的 `component` 是 `never`。
 *
 * ## 一律懒加载
 *
 * 每个 `component` 都是 `() => import("../view/...")`，且**必须是静态字面量**：
 * 动态模板串 Vite 静态分析不出来，构建期解析不出 chunk。
 *
 * ## 路由模式：hash，而不是 history
 *
 * `createWebHashHistory()`——沿用 electron-vite 模板的约定。URL 形如
 * `app://local/index.html#/calendar/synodic`。桌面应用里多一个 `#` 没有实际代价，
 * 而 hash 模式在任何装载方式下都不会坏。
 */

import { createRouter, createWebHashHistory } from "./dependencies";
import type { RouteRecordRaw, Router, RouterHistory } from "./dependencies";
import type { AppRoute } from "./route-meta";

/**
 * 把路由的 `path` 规范化成可直接用于菜单 index 的绝对路径。
 *
 * 三种输入都要处理，缺一个菜单就指错地方：绝对路径原样返回、相对路径按父链
 * 拼接、空串（今日那种 `path: ""` 的子页）返回父路径本身。
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
 * - `history` 用 **hash 模式**（理由见文件头）；
 * - `list` 默认就是真实路由表，留出来是给测试注入"把 `component` 换成空壳"的
 *   副本——Node 加载不了 `.vue`，而路由解析与组件内容无关。
 */
export function createAppRouter(history?: RouterHistory, list: readonly AppRoute[] = routes): Router {
    return createRouter({
        history: history ?? createWebHashHistory(),
        routes: list as RouteRecordRaw[],
        // 内容区自己在滚，换页后停在上一页的滚动位置会让人以为没跳转
        scrollBehavior: () => ({ top: 0 })
    });
}

/** 路由名。全应用只有这一处写路由名字符串。 */
export const RouteName = {
    home: "home",
    today: "today",
    fallback: "fallback",

    /* 数据 */
    data: "data",
    dataPage: "data-page",

    /* 智能体 */
    agent: "agent",
    agentChat: "agent-chat",
    agentFlow: "agent-flow",
    agentFlowEditor: "agent-flow-editor",
    agentFlowRun: "agent-flow-run",
    agentReport: "agent-report",
    agentSetting: "agent-setting",

    /* 历法 */
    calendar: "calendar",
    calendarSystem: "calendar-system",
    calendarTable: "calendar-table",
    chronology: "chronology",
    chronologyPage: "chronology-page",

    /* 命理 / 数术 / 天象 / 历史 / 文献 */
    astrology: "astrology",
    astrologyPage: "astrology-page",
    divination: "divination",
    divinationPage: "divination-page",
    sky: "sky",
    skyPage: "sky-page",
    history: "history",
    historyPage: "history-page",
    library: "library",
    libraryPage: "library-page",

    /* 系统 */
    system: "system",
    systemPage: "system-page"
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
        // 外壳自己不是页面，也没有标题：登记表不列它，导航按 `locate()` 的结果走。
        meta: { menu: "hidden", chrome: "main" },
        children: [
            {
                // 今日：外壳的默认子页，路径就是 `/`。
                //
                // 没有写成 `/today`，因为那会让"面板里的'今日'该指向哪个 index"
                // 出现两个答案（`/` 与 `/today`），而 `route.path` 只能有一个值，
                // 高亮必然在某一处失效。`/today` 由下面一条 redirect 兜住。
                path: "",
                name: RouteName.today,
                component: () => import("../view/WorkspaceView.vue"),
                meta: {
                    title: "今日",
                    icon: "Odometer",
                    description: "此刻的八套历法表达、今日节气与月相",
                    domain: "home"
                }
            },
            {
                path: "/today",
                redirect: "/",
                meta: { menu: "hidden" }
            },

            /* ── 数据 ─────────────────────────────────────────────────────── */
            {
                path: "/data",
                name: RouteName.data,
                component: () => import("../view/DataView.vue"),
                redirect: "/data/browse",
                meta: { title: "数据", icon: "DataBoard", domain: "home", menu: "hidden" },
                children: [
                    {
                        path: "/data/:page",
                        name: RouteName.dataPage,
                        component: () => import("../view/data/DataPage.vue"),
                        meta: {
                            title: "数据",
                            icon: "DataBoard",
                            domain: "home",
                            titleFrom: "page",
                            keepAlive: true
                        }
                    }
                ]
            },

            /* ── 智能体 ───────────────────────────────────────────────────── */
            {
                path: "/agent",
                name: RouteName.agent,
                component: () => import("../view/AgentView.vue"),
                redirect: "/agent/chat",
                meta: { title: "智能体", icon: "MagicStick", domain: "agent", menu: "hidden" },
                children: [
                    {
                        // 四个对话模式共用一个页面，`:mode` 只影响开场白与右栏，
                        // 三栏壳是同一份。
                        path: "/agent/chat/:mode?",
                        name: RouteName.agentChat,
                        component: () => import("../view/agent/ChatView.vue"),
                        meta: {
                            title: "对话",
                            icon: "ChatDotRound",
                            domain: "agent",
                            description: "与智能体对话；可切换品牌与模型",
                            keepAlive: true
                        }
                    },
                    {
                        path: "/agent/flow",
                        name: RouteName.agentFlow,
                        component: () => import("../view/agent/FlowLibraryView.vue"),
                        meta: {
                            title: "工作流",
                            icon: "Connection",
                            domain: "agent",
                            description: "把多次操作编排成可复用、可回放的流程。可调用项目里的 PowerShell / shell 脚本操作电脑"
                        }
                    },
                    {
                        path: "/agent/flow/run",
                        name: RouteName.agentFlowRun,
                        component: () => import("../view/agent/FlowRunView.vue"),
                        meta: {
                            title: "运行记录",
                            icon: "List",
                            domain: "agent",
                            description: "每次运行的时间线、产出与授权痕迹"
                        }
                    },
                    {
                        path: "/agent/report",
                        name: RouteName.agentReport,
                        component: () => import("../view/agent/ReportView.vue"),
                        meta: {
                            title: "报告",
                            icon: "Collection",
                            domain: "agent",
                            description: "深度研究与课题研究的产出"
                        }
                    },
                    {
                        // 智能体设置：品牌（厂商）+ 模型 + API Key + 预设。
                        //
                        // 放在 `/agent` 下而不是 `/system` 下，是因为它调的是**智能体**
                        // 而不是这台机器：用户来这里是为了"让助手换个模型"，
                        // 去系统设置里找是路径与心智不一致。
                        path: "/agent/setting",
                        name: RouteName.agentSetting,
                        component: () => import("../view/agent/AgentSettingView.vue"),
                        meta: {
                            title: "智能体设置",
                            icon: "Setting",
                            domain: "agent",
                            description: "品牌、模型、API Key 与预设"
                        }
                    }
                ]
            },
            {
                // 编排器：**沉浸布局**，不渲染窄栏与状态栏。
                //
                // 写成 `/agent/flow/:id` 而不是 `/agent/flow` 的子路由，是因为它需要
                // 换一个外壳；作为子路由就会继承带导航的外壳。`/agent/flow/run`
                // 这条静态路由**必须排在它前面**。
                path: "/agent/flow/:id",
                name: RouteName.agentFlowEditor,
                component: () => import("../view/agent/FlowEditorView.vue"),
                meta: {
                    title: "编排器",
                    icon: "Operation",
                    domain: "agent",
                    chrome: "immersive",
                    menu: "hidden",
                    titleFrom: "id"
                }
            },

            /* ── 历法 ─────────────────────────────────────────────────────── */
            {
                path: "/calendar",
                name: RouteName.calendar,
                component: () => import("../view/CalendarView.vue"),
                redirect: "/calendar/natural",
                meta: { title: "历法", icon: "Calendar", domain: "calendar", menu: "hidden" },
                children: [
                    {
                        /*
                         * 历法数据表：某套历法的**逐行表格**，整屏宽。
                         *
                         * 旧版把"数据"做成 `/calendar/:system/data`（`:view` 的取值之一），
                         * 于是表格被挤在带页头的页面里，只剩一半可用宽度。改成独立路由后
                         * 它有整屏。
                         *
                         * **路径写成 `/calendar/table/:system` 而不是
                         * `/calendar/:system/table`**：后者与下面的 `:view?` 冲突
                         * ——`:view` 是可选的，两条规则都能匹配两段路径，命中哪条
                         * 取决于 vue-router 的打分细节而不是读表人的预期。加一段固定前缀
                         * 就彻底没有歧义了。旧地址由下面一条 redirect 兜住。
                         */
                        path: "/calendar/table/:system",
                        name: RouteName.calendarTable,
                        component: () => import("../view/calendar/CalendarTableView.vue"),
                        meta: {
                            title: "历法数据表",
                            icon: "Memo",
                            domain: "calendar",
                            titleFrom: "system",
                            keepAlive: true
                        }
                    },
                    {
                        path: "/calendar/:system/table",
                        redirect: (to) => `/calendar/table/${String(to.params.system)}`,
                        meta: { menu: "hidden" }
                    },
                    {
                        // 八套历法共用这一条。
                        //
                        // 旧版把 8 套 × 3 个视图写成 24 条路由 24 个文件，而它们的
                        // 形状完全相同。新版 `:view` 只承载体裁（周 / 月 / 年），
                        // "简介"与"数据"各自独立成页。
                        //
                        // 非法值**不重定向**，页面渲染空态并给出口——重定向会把拼错的
                        // 地址掩盖掉，用户永远不知道是自己打错了还是应用坏了。
                        path: "/calendar/:system/:view?",
                        name: RouteName.calendarSystem,
                        component: () => import("../view/calendar/CalendarSystemView.vue"),
                        meta: {
                            title: "历法",
                            icon: "Calendar",
                            domain: "calendar",
                            description: "这套历法的日历与口径",
                            titleFrom: "system",
                            // 换体系（`/calendar/natural` → `/calendar/synodic`）必须重建组件，
                            // 缓存会让新体系显示旧体系的数据。`AppShell` 用 `:key="route.path"`
                            // 保证这一点，这里显式写 `false` 是给读表人的说明。
                            keepAlive: false
                        }
                    }
                ]
            },

            /* ── 年表（归在历法域的面板里） ────────────────────────────────── */
            {
                path: "/chronology",
                name: RouteName.chronology,
                component: () => import("../view/ChronologyView.vue"),
                redirect: "/chronology/timeline",
                meta: { title: "年表", icon: "Memo", domain: "calendar", menu: "hidden" },
                children: [
                    {
                        path: "/chronology/:page",
                        name: RouteName.chronologyPage,
                        component: () => import("../view/chronology/ChronologyPage.vue"),
                        meta: {
                            title: "年表",
                            icon: "Memo",
                            domain: "calendar",
                            titleFrom: "page",
                            keepAlive: true
                        }
                    }
                ]
            },

            /* ── 命理 ─────────────────────────────────────────────────────── */
            {
                path: "/astrology",
                name: RouteName.astrology,
                component: () => import("../view/AstrologyView.vue"),
                redirect: "/astrology/bazi",
                meta: { title: "命理", icon: "User", domain: "astrology", menu: "hidden" },
                children: [
                    {
                        path: "/astrology/:page",
                        name: RouteName.astrologyPage,
                        component: () => import("../view/astrology/AstrologyPage.vue"),
                        meta: {
                            title: "命理",
                            icon: "User",
                            domain: "astrology",
                            titleFrom: "page",
                            keepAlive: false
                        }
                    }
                ]
            },

            /* ── 数术 ─────────────────────────────────────────────────────── */
            {
                path: "/divination",
                name: RouteName.divination,
                component: () => import("../view/DivinationView.vue"),
                redirect: "/divination/qimen",
                meta: { title: "数术", icon: "MagicStick", domain: "divination", menu: "hidden" },
                children: [
                    {
                        path: "/divination/:page",
                        name: RouteName.divinationPage,
                        component: () => import("../view/divination/DivinationPage.vue"),
                        meta: {
                            title: "数术",
                            icon: "MagicStick",
                            domain: "divination",
                            titleFrom: "page",
                            keepAlive: false
                        }
                    }
                ]
            },

            /* ── 天象 ─────────────────────────────────────────────────────── */
            {
                path: "/sky",
                name: RouteName.sky,
                component: () => import("../view/SkyView.vue"),
                redirect: "/sky/plane",
                meta: { title: "天象", icon: "Star", domain: "sky", menu: "hidden" },
                children: [
                    {
                        path: "/sky/:page",
                        name: RouteName.skyPage,
                        component: () => import("../view/sky/SkyPage.vue"),
                        meta: {
                            title: "天象",
                            icon: "Star",
                            domain: "sky",
                            titleFrom: "page",
                            keepAlive: false
                        }
                    }
                ]
            },

            /* ── 历史 ─────────────────────────────────────────────────────── */
            {
                path: "/history",
                name: RouteName.history,
                component: () => import("../view/HistoryView.vue"),
                redirect: "/history/cycle",
                meta: { title: "历史", icon: "Collection", domain: "history", menu: "hidden" },
                children: [
                    {
                        path: "/history/:page",
                        name: RouteName.historyPage,
                        component: () => import("../view/history/HistoryPage.vue"),
                        meta: {
                            title: "历史",
                            icon: "Collection",
                            domain: "history",
                            titleFrom: "page",
                            keepAlive: true
                        }
                    }
                ]
            },

            /* ── 文献 ─────────────────────────────────────────────────────── */
            {
                path: "/library",
                name: RouteName.library,
                component: () => import("../view/LibraryView.vue"),
                redirect: "/library/ancient-china",
                meta: { title: "文献", icon: "Reading", domain: "library", menu: "hidden" },
                children: [
                    {
                        path: "/library/:page",
                        name: RouteName.libraryPage,
                        component: () => import("../view/library/LibraryPage.vue"),
                        meta: {
                            title: "文献",
                            icon: "Reading",
                            domain: "library",
                            titleFrom: "page",
                            keepAlive: true
                        }
                    }
                ]
            },

            /* ── 系统 ─────────────────────────────────────────────────────── */
            {
                path: "/system",
                name: RouteName.system,
                component: () => import("../view/SystemView.vue"),
                redirect: "/system/datasource",
                meta: { title: "系统", icon: "Setting", domain: "system", menu: "hidden" },
                children: [
                    {
                        path: "/system/:page",
                        name: RouteName.systemPage,
                        component: () => import("../view/system/SystemPage.vue"),
                        meta: {
                            title: "系统",
                            icon: "Setting",
                            domain: "system",
                            titleFrom: "page",
                            keepAlive: true
                        }
                    }
                ]
            },

            {
                // 兜底：写错的地址回到今日。目标写路径而不是 `{ name }`，
                // 否则当前匹配出的 `pathMatch` 会被带过去并触发一条 router 警告。
                path: "/:pathMatch(.*)*",
                name: RouteName.fallback,
                meta: { menu: "hidden" },
                redirect: "/"
            }
        ]
    }
];
