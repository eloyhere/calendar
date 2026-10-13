/**
 * 菜单树：把路由表推导成能直接 `v-for` 的形状。
 *
 * 这是"路由表即唯一配置"的另一半——菜单不再手写。新增页面只要在
 * `plugin/router.ts` 的 `routes` 里加一条带 `meta.title` 的路由，
 * 菜单自动多一项，面包屑与窗口标题一并跟上。
 *
 * ## 两处与本文件旧版的差异（`docs/ui-architecture.md` §5.3）
 *
 * ### 1. 分区
 *
 * 侧栏分三段：「工作区」「数据与工具」「系统」。分区由路由 `meta.domain` 决定
 * （`workspace` / `tool` / `system`），在**域一级**写一次，子路由由 vue-router 的
 * `meta` 合并继承。分区的意义是 chunking——把 9 项一级导航分成三组扫描，
 * 而不是限制项数（`docs/ui-architecture.md` §2.2 第 5 条已经写明
 * "Miller 的 7±2 常被误用，长菜单是可以的"）。
 *
 * ### 2. 参数化项的展开
 *
 * 有一条路由是参数化的：`/calendar/:system/:view?`。菜单要的不是这一条，而是
 * 「朔望历 / 格里高利历 / 节气历 / 更多历法」四项。这一层展开**不在路由表里**
 * （路由表要保持"每一页都能被直接检索到"），而在下面的 `MENU_LAYOUT`：
 * 它只说"哪个菜单项指向哪条路由、带什么参数、叫什么名字"，
 * **不重复定义路由**——`resolve` 拿不到对应路由时直接报错，而不是悄悄少一项。
 *
 * ## `meta.menu` 的三种取值
 *
 * | 写法             | 含义                                       | 例子                |
 * | ---------------- | ------------------------------------------ | ------------------- |
 * | 不写             | 有标题就露出来                              | 大多数页面          |
 * | `menu: false`    | 有子项时**露出自己**（渲染成不可跳转的分组） | 域节点              |
 * | `menu: "hidden"` | 彻底藏起来，孩子提上来                       | `/:pathMatch(.*)*`  |
 */

import type { IconName } from "./icons";
import { routes } from "./router";

/** 分区标识，与 `RouteMeta.domain` 同域。 */
export type MenuDomain = "workspace" | "tool" | "system";

/** 分区标题。 */
export const MENU_DOMAINS: readonly { id: MenuDomain; title: string }[] = [
    { id: "workspace", title: "工作区" },
    { id: "tool", title: "数据与工具" },
    { id: "system", title: "系统" }
];

/** 菜单节点。 */
export interface MenuNode {
    /** 菜单文案，来自 `meta.title` */
    title: string;
    /** 可跳转的绝对路径；分组节点为 `null`（只展开，不跳转）。 */
    path: string | null;
    /** 菜单图标，来自 `meta.icon` */
    icon: IconName | null;
    /** 页面说明，来自 `meta.description`，渲染成菜单项提示 */
    description: string | null;
    /** 归属分区 */
    domain: MenuDomain;
    /** 子节点；空数组表示这是叶子，渲染成 `<ElMenuItem>` */
    children: MenuNode[];
}

/**
 * 把一条注册路径转成正则，用来匹配**具体地址**。
 *
 * `/calendar/:system/:view?` 要能匹配 `/calendar/natural` 与
 * `/calendar/natural/year`；`/agent/chat/:mode?` 要能匹配 `/agent/chat`。
 * 可选参数（`?` 后缀）必须**整体可省**——少一个 `/` 都不行，
 * 否则 `/agent/chat` 会被判为不匹配。
 */
const patternOf = (path: string): RegExp => {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    const parts: string[] = [];

    for (const segment of segments) {
        const optional = segment.endsWith("?");
        const name = optional ? segment.slice(0, -1) : segment;

        if (name.startsWith(":")) {
            // `:pathMatch(.*)*` 这类通配：吞掉后面全部
            if (name.includes("(") || segment.endsWith("*")) {
                parts.push("(?:/.*)?");
                continue;
            }
            parts.push(optional ? "(?:/[^/]+)?" : "/[^/]+");
        } else {
            parts.push(`/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
        }
    }

    return new RegExp(`^${parts.join("") || "/"}/?$`);
};

/**
 * 按**具体地址**取一条路由记录。
 *
 * 关键在于"具体地址"：登记表里写的是 `/calendar/natural`，而路由表里注册的是
 * `/calendar/:system/:view?`。早先的版本按字符串相等比对，于是**每一条具体路径
 * 都判为"不存在"**，`verifyDomainRoutes()` 在启动时抛出四十条错误的清单，
 * 整个应用白屏。这里按 vue-router 的规则做参数匹配。
 *
 * 返回值 `null` 表示"没有这条路由"，`{}` 表示"有这条路由但它没有 `meta`"
 * ——两者要分开：前者是配置错误，后者是合法情况（布局路由就没有 `meta.title`）。
 *
 * 命中多条时按**静态段更多者优先**：`/calendar/table/:system` 与
 * `/calendar/:system/:view?` 都能匹配 `/calendar/table/foo`，
 * 而前者才是作者想指的那条。
 */
export const routeAt = (path: string): { title?: string; icon?: IconName; description?: string } | null => {
    interface Walkable {
        path: string;
        meta?: { title?: string; icon?: IconName; description?: string };
        children?: readonly Walkable[];
    }

    const normalize = (value: string): string =>
        value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;

    let best: Walkable["meta"] | null = null;
    let bestScore = -1;

    const walk = (list: readonly Walkable[]): void => {
        for (const record of list) {
            const registered = normalize(record.path);
            if (registered.length > 0 && patternOf(registered).test(normalize(path))) {
                const score = registered
                    .split("/")
                    .filter((segment) => segment.length > 0 && !segment.startsWith(":")).length;
                if (score > bestScore) {
                    bestScore = score;
                    best = record.meta ?? {};
                }
            }
            walk(record.children ?? []);
        }
    };

    walk(routes as unknown as readonly Walkable[]);
    return best;
};

/** 一个菜单项的声明：指向哪条路由、取什么名字。 */
interface MenuItemDeclaration {
    /** 路由 `path`（参数化路由写带 `:参数` 的原样路径） */
    route: string;
    /**
     * 路由参数。给了就拼进 `path`，例如 `{ system: "synodic" }` 把
     * `/calendar/:system/:view?` 变成 `/calendar/synodic`。
     */
    params?: Record<string, string>;
    /** 菜单文案；不写则取路由的 `meta.title` */
    title?: string;
    /** 图标；不写则取路由的 `meta.icon` */
    icon?: IconName;
    /** 说明；不写则取路由的 `meta.description` */
    description?: string;
    /** 子项 */
    children?: readonly MenuItemDeclaration[];
}

/** 一个分区的声明。 */
interface MenuSectionDeclaration {
    domain: MenuDomain;
    items: readonly MenuItemDeclaration[];
}

/** 把 `params` 填进带 `:` 的路径。 */
const fillPath = (path: string, params?: Record<string, string>): string => {
    if (params === undefined) {
        return path;
    }
    let out = path;
    for (const [name, value] of Object.entries(params)) {
        out = out.replace(`:${name}?`, value).replace(`:${name}`, value);
    }
    return out;
};

/** 把声明解析成菜单节点；路由不存在时抛错，避免菜单悄悄少一项。 */
const resolveItem = (declaration: MenuItemDeclaration): MenuNode => {
    const meta = routeAt(declaration.route);
    if (meta === null) {
        throw new Error(
            `菜单声明指向了不存在的路由 "${declaration.route}"。` +
                `新增菜单项时先在 plugin/router.ts 里加路由，或修正这里的 path。`
        );
    }

    const children = (declaration.children ?? []).map(resolveItem);

    /**
     * 这个节点自己能不能跳。
     *
     * 与 `plugin/menu.ts` 旧版的规则一致：**有子项且自己没有页面**时才渲染成
     * 只展开不跳转的分组。这里唯一的判断依据是"声明里给了 `params` 或路由不含参数"：
     *
     * - `/agent/flow` 有子项？没有。所以它可跳；
     * - `/calendar/:system/:view?` 的"历法"项有子项，但声明里给了
     *   `params: { system: "synodic" }`，所以它**可跳**（跳到朔望历简介）。
     */
    const jumpable = !declaration.route.includes(":") || declaration.params !== undefined;

    return {
        title: declaration.title ?? meta.title ?? fillPath(declaration.route, declaration.params),
        path: jumpable ? fillPath(declaration.route, declaration.params) : null,
        icon: declaration.icon ?? meta.icon ?? null,
        description: declaration.description ?? meta.description ?? null,
        // 分区由所在 section 决定，不从这里取——`domain` 只在域一级写
        domain: "workspace",
        children
    };
};

/**
 * 菜单布局。
 *
 * 顺序即显示顺序（`docs/ui-architecture.md` §2.2 第 6 条：按使用频率排，不按字母序）。
 */
const MENU_LAYOUT: readonly MenuSectionDeclaration[] = [
    {
        domain: "workspace",
        items: [
            // 工作台的路由是外壳的**空路径子页**，所以这里写外壳自己的路径 `/`。
            // 写 `""` 会让菜单项的 index 变成空串——能跳转，但高亮比对的是
            // `route.path`（值是 `/`），两边对不上。
            { route: "/", title: "工作台", icon: "Odometer" },
            { route: "/agent/chat/:mode?", title: "对话", params: { mode: "create" } },
            { route: "/agent/flow", title: "工作流" },
            { route: "/agent/report", title: "报告" }
        ]
    },
    {
        domain: "tool",
        items: [
            { route: "/data/:page", title: "数据浏览", params: { page: "browse" } },
            {
                // 历法：一个有子项的一级项。它自己指向朔望历（唯一有 29 万行真实历表的体系）。
                route: "/calendar/:system/:view?",
                title: "历法",
                params: { system: "synodic", view: "entry" },
                icon: "Calendar",
                children: [
                    {
                        route: "/calendar/:system/:view?",
                        title: "朔望历",
                        params: { system: "synodic", view: "entry" },
                        icon: "MoonNight"
                    },
                    {
                        route: "/calendar/:system/:view?",
                        title: "格里高利历",
                        params: { system: "gregory", view: "entry" },
                        icon: "Sunny"
                    },
                    {
                        route: "/calendar/:system/:view?",
                        title: "节气历",
                        params: { system: "climate", view: "entry" },
                        icon: "Clock"
                    },
                    {
                        // 「更多历法」指向天文历简介，同时收纳其余四套。
                        //
                        // 这会让菜单出现一处三级缩进。`docs/ui-architecture.md` §5.3 有一整段
                        // 论证它为什么不违反"主菜单最多 2 层"：那条规则约束的是**逐级展开**
                        // 的次数，而 Element Plus 的子菜单展开时父级与同级同时可见，
                        // 用户不是在层级之间来回移动。真正被否掉的是旧表的
                        // "历法 → 天文历 → 简介"，那里八个历法各有一个同名子项。
                        route: "/calendar/:system/:view?",
                        title: "更多历法",
                        params: { system: "astronomy", view: "entry" },
                        icon: "Star",
                        children: [
                            {
                                route: "/calendar/:system/:view?",
                                title: "天文历",
                                params: { system: "astronomy", view: "entry" },
                                icon: "Star"
                            },
                            {
                                route: "/calendar/:system/:view?",
                                title: "木星历",
                                params: { system: "jupiter", view: "entry" },
                                icon: "Opportunity"
                            },
                            {
                                route: "/calendar/:system/:view?",
                                title: "轩辕历",
                                params: { system: "natural", view: "entry" },
                                icon: "Guide"
                            },
                            {
                                route: "/calendar/:system/:view?",
                                title: "干支历",
                                params: { system: "tree", view: "entry" },
                                icon: "Connection"
                            },
                            {
                                route: "/calendar/:system/:view?",
                                title: "回归历",
                                params: { system: "tropical", view: "entry" },
                                icon: "Compass"
                            }
                        ]
                    }
                ]
            },
            { route: "/chronology/:page", title: "年表", params: { page: "timeline" } },
            { route: "/numerology/:page", title: "命理", params: { page: "wiki" } }
        ]
    },
    {
        domain: "system",
        items: [{ route: "/system/:page", title: "系统设置", params: { page: "setting" } }]
    }
];

/** 给已解析的节点补上分区（叶子与子节点都要）。 */
const withDomain = (node: MenuNode, domain: MenuDomain): MenuNode => ({
    ...node,
    domain,
    children: node.children.map((child) => withDomain(child, domain))
});

/**
 * 按分区组织的菜单树。
 *
 * 侧栏按这个结果分段渲染。空分区会被去掉——否则将来某个分区被清空时，
 * 界面上会留下一行没有内容的标题。
 */
export const createMenuSections: () => readonly { title: string; nodes: MenuNode[] }[] = () =>
    MENU_DOMAINS.map((section) => ({
        title: section.title,
        nodes: (MENU_LAYOUT.find((item) => item.domain === section.id)?.items ?? []).map((item) =>
            withDomain(resolveItem(item), section.id)
        )
    })).filter((section) => section.nodes.length > 0);

/**
 * 扁平菜单树（旧形状，兼容用）。
 *
 * `docs/ui-architecture.md` §5.3 之后侧栏改用 `createMenuSections()`；
 * 这个函数保留给还需要"一棵树"的调用方（命令面板按标题搜索）。
 */
export function createMenuTree(): MenuNode[] {
    return createMenuSections().flatMap((section) => section.nodes);
}

/** 把菜单树拍平成"标题 → 路径"的列表，命令面板用它做跳转候选。 */
export const flattenMenu = (nodes: readonly MenuNode[]): { title: string; path: string; description: string | null; icon: IconName | null }[] =>
    nodes.flatMap((node) => [
        ...(node.path === null
            ? []
            : [{ title: node.title, path: node.path, description: node.description, icon: node.icon }]),
        ...flattenMenu(node.children)
    ]);
