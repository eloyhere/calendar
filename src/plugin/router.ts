/**
 * 路由表：**唯一配置**。
 *
 * 侧栏菜单（`plugin/menu.ts`）、命令面板、面包屑（`component/AppBreadcrumb.vue`）、
 * 窗口标题都从这棵树推导，不另写一份列表。新增页面 = 在这里加一条路由。
 *
 * 本表按 `docs/ui-architecture.md` §4 重建。与旧表的差异逐条记在那份文档的 §3.2 与 §11.1，
 * 这里只记**读表时需要知道的约定**。
 *
 * ## 结构（35 条）
 *
 * ```
 * /                              AppShell（侧栏 + 顶栏 + 内容 + 状态栏）
 * ├─ ""                          工作台/               工作区
 * ├─ /agent                      智能体                 工作区
 * │  ├─ /agent/chat/:mode?        对话
 * │  ├─ /agent/flow               工作流（定义库）
 * │  ├─ /agent/flow/run           运行记录
 * │  └─ /agent/report             报告
 * ├─ /agent/flow/:id             编排器                ← 沉浸布局，无侧栏
 * ├─ /calendar                   历法                   工具
 * │  └─ /calendar/:system/:view?  历法工作区
 * ├─ /chronology                 年表                   工具
 * │  └─ /chronology/:page
 * ├─ /numerology                 命理                   工具
 * │  └─ /numerology/:page
 * ├─ /data                       数据                   工具
 * │  └─ /data/:page
 * ├─ /system                     系统                   系统
 * │  └─ /system/:page
 * └─ /:pathMatch(.*)*             兜底回工作台
 * ```
 *
 * ## 三种节点
 *
 * 1. **布局**：`/` 与 `/agent/flow/:id`，前者是常规三区，后者全宽。用 `meta.chrome` 标；
 * 2. **域**：`/calendar`、`/chronology` … `component` 指向 `view/<Domain>View.vue`，
 *    那个文件只写一个 `<RouterView/>`（见 `component/DomainOutlet.vue` 的说明）。
 *    域自身带 `redirect`，直接访问时落到默认子页。
 * 3. **页**：真正要写内容的页面。参数化的域（历法/年表/命理/数据/系统）用一个
 *    `:page` 或 `:system` 参数吃掉同一形状的多页，形状来自 `src/entity/` 的登记表。
 *
 * ## 为什么参数化而不是逐页写死
 *
 * 旧表把 8 套历法 × 3 个视图写成 24 条路由、24 个页面文件，而它们的形状完全相同。
 * `docs/ui-architecture.md` §2.2 第 3 条（渐进披露的两层规则）与第 4 条（Hick 定律的
 * 分组策略）都指向同一结论：**同一形状的东西不该在菜单里平铺**。
 * 代价是"某个体系少一页"这类差异藏进了登记表——所以登记表必须显式
 * （`src/entity/calendar.ts` 的 `CalendarSystems`），而不是靠路由表的行数体现。
 *
 * ## 为什么这张表里没有任何函数
 *
 * 这里是**纯配置**：整棵树逐条写死，没有生成器、没有拼路径的辅助函数。代价是表长一些，
 * 换来的是**每一页都能被直接检索到**——读路由表时不必先在心里跑一遍生成器。
 * 由此表里每一层的 `path` 都写成**绝对路径**，菜单与面包屑因此可以直接取
 * `route.path`，不需要任何拼接。
 *
 * ## 外壳挂在 `/`、工作台是它的空路径子页
 *
 * 另外两种写法都实测失败，记在这里免得再试：
 *
 * - 外壳挂 `/overview` + `alias: "/"`：别名会与**已注册的兄弟路由争抢匹配**，
 *   实测 `/agent`、`/calendar` 全被别名抢走落到工作台；
 * - `/` 纯 redirect 到 `/dashboard` + 外壳挂 `/dashboard`：外壳就同时需要
 *   `component` 与 `redirect`，而 `RouteRecordRedirect` 的 `component` 是 `never`。
 *
 * 所以外壳占 `/`，工作台是它的空路径子页。`/dashboard` 由外壳上的
 * `alias` 之外的**一条显式 redirect**兜住：点菜单里的"工作台"仍然跳得回来，
 * 而菜单项的 `path` 就是 `/`。
 *
 * ## 一律懒加载
 *
 * 每个 `component` 都是 `() => import("../view/...")`，且**必须是静态字面量**：
 * 动态模板串 Vite 静态分析不出来，构建期解析不出 chunk。
 *
 * ## 路由模式：hash，而不是 history
 *
 * `createWebHashHistory()`——沿用 electron-vite 模板的约定。URL 形如
 * `app://local/index.html#/calendar/synodic/data`。
 *
 * `main/window.ts` 现在用自定义协议 `app://` 装载，页面有正常来源，
 * 所以 `createWebHistory()` 也能用了；但这里**保持 hash 不变**：URL 里多一个 `#`
 * 对桌面应用没有实际代价，而 hash 模式在任何装载方式下都不会坏。真要换 history，
 * 只改本文件这一处即可。
 */

import { createRouter, createWebHashHistory } from "./dependencies";
import type { RouteRecordRaw, Router, RouterHistory } from "./dependencies";
import type { AppRoute } from "./route-meta";

/**
 * 把路由的 `path` 规范化成可直接用于菜单 index 的绝对路径。
 *
 * 三种输入都要处理，缺一个菜单就指错地方：绝对路径原样返回、相对路径按父链
 * 拼接、空串（工作台那种 `path: ""` 的子页）返回父路径本身。
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
        // 内容区是 `ElMain` 自己在滚，换页后停在上一页的滚动位置会让人以为没跳转
        scrollBehavior: () => ({ top: 0 })
    });
}

/** 路由名。全应用只有这一处写路由名字符串。 */
export const RouteName = {
    home: "home",
    workspace: "workspace",
    fallback: "fallback",

    /* 工作区 */
    agent: "agent",
    agentChat: "agent-chat",
    agentFlow: "agent-flow",
    agentFlowEditor: "agent-flow-editor",
    agentFlowRun: "agent-flow-run",
    agentReport: "agent-report",

    /* 工具 */
    calendar: "calendar",
    calendarSystem: "calendar-system",
    chronology: "chronology",
    chronologyPage: "chronology-page",
    numerology: "numerology",
    numerologyPage: "numerology-page",
    data: "data",
    dataPage: "data-page",

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
        // 外壳自己不是页面，也没有标题：`menu.ts` 会把没有标题的节点当隐藏节点，
        // 把孩子提升成侧栏的一级项。
        meta: { menu: "hidden", chrome: "main" },
        children: [
            {
                // 工作台：外壳的默认子页，路径就是 `/`。
                //
                // 没有写成 `/dashboard`，因为那会让"侧栏的'工作台'项该指向哪个 index"
                // 出现两个答案（`/` 与 `/dashboard`），而 `route.path` 只能有一个值，
                // 高亮必然在某一处失效。`/dashboard` 由下面一条 redirect 兜住。
                path: "",
                name: RouteName.workspace,
                component: () => import("../view/WorkspaceView.vue"),
                meta: {
                    title: "工作台",
                    icon: "Odometer",
                    description: "库规模、数据健康、最近活动与上次停下的地方",
                    domain: "workspace"
                }
            },
            {
                // 让 `/dashboard` 也能进来：命令面板与外部链接用它。
                path: "/dashboard",
                redirect: "/",
                meta: { menu: "hidden" }
            },

            /* ── 智能体 ───────────────────────────────────────────────────── */
            {
                path: "/agent",
                name: RouteName.agent,
                component: () => import("../view/AgentView.vue"),
                redirect: "/agent/chat",
                meta: { title: "助手", icon: "MagicStick", domain: "workspace" },
                children: [
                    {
                        // 四个对话模式共用一个页面，`:mode` 决定右栏与开场白。
                        // 旧表把五个模式写成五条路由五个文件，形状完全相同的部分是
                        // 三栏壳——那正是 `view/agent/ChatView.vue` 与
                        // `view/agent/chat/ChatPage.vue` 已经在做的事，所以这里不再复制。
                        path: "/agent/chat/:mode?",
                        name: RouteName.agentChat,
                        component: () => import("../view/agent/ChatView.vue"),
                        meta: {
                            title: "对话",
                            icon: "ChatDotRound",
                            description: "新建对话 / 深度研究 / 数据调研 / 课题研究",
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
                            description: "把多次操作编排成可复用、可回放的流程"
                        }
                    },
                    {
                        path: "/agent/flow/run",
                        name: RouteName.agentFlowRun,
                        component: () => import("../view/agent/FlowRunView.vue"),
                        meta: {
                            title: "运行记录",
                            icon: "List",
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
                            description: "深度研究与课题研究的产出"
                        }
                    }
                ]
            },
            {
                // 编排器：**沉浸布局**，不渲染侧栏与状态栏。
                //
                // 放在 `/agent/flow/:id` 而不是 `/agent/flow/:id` 的子路由下，是因为
                // 它需要换一个外壳；写成 `/agent` 的子路由就会继承带侧栏的外壳。
                // `:id` 放在 `/agent/flow` 之后，所以 `/agent/flow/run` 这条静态路由
                // **必须排在它前面**（vue-router 按声明顺序匹配，静态优先于动态是它的
                // 打分规则，但把静态写在前面能让读表的人一眼看出这个优先级）。
                path: "/agent/flow/:id",
                name: RouteName.agentFlowEditor,
                component: () => import("../view/agent/FlowEditorView.vue"),
                meta: {
                    title: "编排器",
                    icon: "Operation",
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
                redirect: "/calendar/synodic",
                meta: { title: "历法", icon: "Calendar", domain: "tool" },
                children: [
                    {
                        // 八套历法 + 年表共用这一条。合法 `system` 与 `view` 的取值来自
                        // `src/entity/calendar.ts` 的登记表；非法值**不重定向**，
                        // 页面渲染 `ElResult` 空态并给出口——重定向会把拼错的地址掩盖掉。
                        path: "/calendar/:system/:view?",
                        name: RouteName.calendarSystem,
                        component: () => import("../view/calendar/CalendarSystemView.vue"),
                        meta: {
                            title: "历法工作区",
                            icon: "Calendar",
                            description: "这套历法的简介、日历与数据",
                            titleFrom: "system",
                            keepAlive: true
                        }
                    }
                ]
            },

            /* ── 年表 ─────────────────────────────────────────────────────── */
            {
                path: "/chronology",
                name: RouteName.chronology,
                component: () => import("../view/ChronologyView.vue"),
                redirect: "/chronology/timeline",
                meta: { title: "年表", icon: "Memo", domain: "tool" },
                children: [
                    {
                        path: "/chronology/:page",
                        name: RouteName.chronologyPage,
                        component: () => import("../view/chronology/ChronologyPage.vue"),
                        meta: { title: "年表", icon: "Memo", titleFrom: "page", keepAlive: true }
                    }
                ]
            },

            /* ── 命理 ─────────────────────────────────────────────────────── */
            {
                path: "/numerology",
                name: RouteName.numerology,
                component: () => import("../view/NumerologyView.vue"),
                redirect: "/numerology/wiki",
                meta: { title: "命理", icon: "MagicStick", domain: "tool" },
                children: [
                    {
                        path: "/numerology/:page",
                        name: RouteName.numerologyPage,
                        component: () => import("../view/numerology/NumerologyPage.vue"),
                        meta: { title: "命理", icon: "MagicStick", titleFrom: "page", keepAlive: true }
                    }
                ]
            },

            /* ── 数据 ─────────────────────────────────────────────────────── */
            {
                path: "/data",
                name: RouteName.data,
                component: () => import("../view/DataView.vue"),
                redirect: "/data/browse",
                meta: { title: "数据", icon: "DataBoard", domain: "tool" },
                children: [
                    {
                        path: "/data/:page",
                        name: RouteName.dataPage,
                        component: () => import("../view/data/DataPage.vue"),
                        meta: { title: "数据", icon: "DataBoard", titleFrom: "page", keepAlive: true }
                    }
                ]
            },

            /* ── 系统 ─────────────────────────────────────────────────────── */
            {
                path: "/system",
                name: RouteName.system,
                component: () => import("../view/SystemView.vue"),
                redirect: "/system/performance",
                meta: { title: "系统", icon: "Setting", domain: "system" },
                children: [
                    {
                        path: "/system/:page",
                        name: RouteName.systemPage,
                        component: () => import("../view/system/SystemPage.vue"),
                        meta: { title: "系统", icon: "Setting", titleFrom: "page", keepAlive: true }
                    }
                ]
            },

            {
                // 兜底：写错的地址回到工作台。目标写路径而不是 `{ name }`，
                // 否则当前匹配出的 `pathMatch` 会被带过去并触发一条 router 警告。
                path: "/:pathMatch(.*)*",
                name: RouteName.fallback,
                meta: { menu: "hidden" },
                redirect: "/"
            }
        ]
    }
];
