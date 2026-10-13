/**
 * 菜单树：把路由表推导成能直接 `v-for` 的形状。
 *
 * 这是"路由表即唯一配置"的另一半——菜单不再手写。新增页面只要在
 * `plugin/router.ts` 的 `routes` 里加一条带 `meta.title` 的路由，
 * 菜单自动多一项，面包屑与窗口标题一并跟上。
 *
 * ## `meta.menu` 的三种取值
 *
 * 菜单的深浅**本来就不统一**，所以这里要区分三种情况：
 *
 * | 写法                | 含义                                   | 例子                          |
 * | ------------------- | -------------------------------------- | ----------------------------- |
 * | 不写                | 有标题就露出来                          | 大多数页面、`/calendar` 这类域 |
 * | `menu: false`       | 有子项时**露出自己**（渲染成不可跳转的分组） | `/calendar/astronomy` 天文历   |
 * | `menu: "hidden"`    | 彻底藏起来，孩子提上来                   | `/agent/chat` 聊天出口         |
 *
 * 第二种是为了"三级菜单"：历法 → 天文历 → 简介/日历/数据。天文历自己不是页面
 * （没有 `component`，点它只该展开），但**必须占一个位置**，否则八个历法的
 * 简介/日历/数据会全被拍到同一层，出现八个一模一样的"简介"。
 *
 * 第三种给的是 `/agent/chat` 那种"纯出口"：它自己只是个 `<RouterView/>`，
 * 六个聊天模式应当直接挂在"智能体"下面，中间不要多一层。
 *
 * 菜单顺序**就是 `routes` 里的声明顺序**，没有额外的排序字段。
 */

import type { AppRoute } from "./route-meta";
import type { IconName } from "./icons";
import { routes } from "./router";

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
    /** 子节点；空数组表示这是叶子，渲染成 `<ElMenuItem>` */
    children: MenuNode[];
}

/** 递归构造菜单节点。 */
function buildNodes(list: readonly AppRoute[]): MenuNode[] {
    const nodes: MenuNode[] = [];

    for (const route of list) {
        const children = buildNodes(route.children ?? []);
        const title = route.meta?.title ?? "";
        const hidden = route.meta?.menu === "hidden" || title === "";

        // 隐藏节点：自己不出现在菜单里，把孩子提升到当前位置。
        // 没有标题的节点（外壳 `/`、纯出口 `/agent/chat`）也走这一支。
        if (hidden) {
            nodes.push(...children);
            continue;
        }

        // 自己没有 `component` 却是分组（`/calendar/astronomy` 这类）：
        // 点它只会落到一个空白出口，所以给 `path: null` 让它只展开。
        const isGroupOnly = children.length > 0 && !route.component;

        nodes.push({
            title,
            path: isGroupOnly ? null : route.path,
            icon: route.meta?.icon ?? null,
            description: route.meta?.description ?? null,
            children
        });
    }

    return nodes;
}

/**
 * 菜单树。
 *
 * 顶层是外壳路由 `/`（没有标题），因此它会被当作隐藏节点、把孩子提成顶层——
 * 于是六个业务域成为菜单条上的一级项。
 */
export function createMenuTree(list: readonly AppRoute[] = routes): MenuNode[] {
    return buildNodes(list);
}
