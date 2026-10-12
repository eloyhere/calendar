/**
 * 菜单树：把路由表推导成侧栏能直接 `v-for` 的形状。
 *
 * 这是"路由表即唯一配置"的另一半——菜单不再手写。新增页面只要在
 * `plugin/router.ts` 的 `routes` 里加一条带 `meta.title` 的路由，
 * 菜单自动多一项，面包屑与窗口标题一并跟上。
 *
 * 推导只做两件事（都是路由树的形状对渲染不友好的地方）：
 *
 * 1. 把 `meta.menu === false` 的节点自己藏起来、孩子提上来；
 * 2. 把"没有 `component` 的分组节点"标成不可跳转（点它只展开）。
 *
 * 路径**不做任何拼接**：路由表里每一条 `path` 都已经是绝对路径，
 * 直接取 `route.path` 即可。
 *
 * 菜单顺序**就是 `routes` 里的声明顺序**，没有额外的排序字段。
 */

import type { AppRoute } from "./route-meta";
import type { IconName } from "./icons";
import { routes } from "./router";

/** 侧栏菜单节点。 */
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
        // 先递归：当前节点自己不进菜单时，它的子节点要能顶上来
        const children = buildNodes(route.children ?? []);
        const visible = route.meta?.menu !== false && Boolean(route.meta?.title);

        if (!visible) {
            nodes.push(...children);
            continue;
        }

        nodes.push({
            title: route.meta?.title ?? "",
            // 没有 `component` 的分组节点（`/calendar/astronomy` 这类）
            // 被点走会落到一个空白出口，所以给 `null` 让它只展开
            path: children.length > 0 && !route.component ? null : route.path,
            icon: route.meta?.icon ?? null,
            description: route.meta?.description ?? null,
            children
        });
    }

    return nodes;
}

/**
 * 侧栏菜单树。
 *
 * 顶层是外壳路由 `/`（`meta.menu: false`，没有标题），所以它会被当作隐藏节点、
 * 把六个业务域直接提成顶层——正是侧栏想要的形状。
 */
export function createMenuTree(list: readonly AppRoute[] = routes): MenuNode[] {
    return buildNodes(list);
}
