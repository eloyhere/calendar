/**
 * 插件注册中心。
 *
 * `src/plugin` 是第三方 UI 依赖进入项目的唯一入口。业务代码（视图、组件）从
 * `src/plugin/dependencies` 取依赖，应用启动时调用本文件的 `installPlugins()`，
 * 由它按顺序装配所有插件。
 *
 * 加一个新依赖的完整流程只有两步：
 * 1. 在 `dependencies.ts` 里把它转发出来；
 * 2. 在 `plugins/` 下写一个 `CalendarPlugin`，然后加进本文件的 `PLUGINS`。
 *
 * `main.ts` 不需要改——它只调用 `installPlugins()`，不认识具体插件。
 */
import type { App } from "vue";
import { elementPlusPlugin } from "./plugins/element-plus";
import { iconsPlugin } from "./plugins/icons";
import { routerPlugin } from "./plugins/router";
import type { CalendarPlugin } from "./plugins/types";
import { verifyPluginDependencies } from "./dependencies";

export type { CalendarPlugin } from "./plugins/types";

/**
 * 对外公开的依赖、路由与菜单工具。
 *
 * 业务代码只需要 import 本模块，不必再去认 `./dependencies`、`./router`
 * 或 `./menu` 的具体路径——换实现时只需要改这一处转发。
 */

/* 依赖与路由实例 */
export { useRoute, useRouter, RouterLink, RouterView } from "./dependencies";
export type { RouteRecordRaw, Router, RouterHistory } from "./dependencies";
export { createAppRouter } from "./router";

/* 路由表 */
export { RouteName, routes, resolveRoutePath } from "./router";
export type { AppRoute } from "./route-meta";

/* 菜单树 */
export { createMenuTree, createMenuSections, flattenMenu, MENU_DOMAINS } from "./menu";
export type { MenuNode, MenuDomain } from "./menu";

/* 图标：`meta.icon` 只能取白名单里的名字 */
export { isIconName } from "./icons";
export type { IconName } from "./icons";

/**
 * 装配顺序即数组顺序，后装的可以覆盖先装的（例如同名全局组件）。
 * 图标排在 Element Plus 之后，避免图标名与组件名冲突时被反向覆盖。
 */
export const PLUGINS: CalendarPlugin[] = [elementPlusPlugin, iconsPlugin, routerPlugin];

/** 单个插件装配失败时抛出的错误，带上插件名便于定位。 */
export class PluginInstallError extends Error {
    constructor(plugin: string, cause: unknown) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        super(`插件 ${plugin} 装配失败：${detail}`);
        this.name = "PluginInstallError";
        this.cause = cause;
    }
}

/**
 * 把所有插件装配到应用实例上。
 *
 * 开发期先做一次依赖自检：依赖缺失时在启动阶段就报清楚，
 * 而不是等某个视图渲染时才抛 `Failed to resolve import`。
 */
export function installPlugins(app: App): App {
    if (import.meta.env.DEV) {
        verifyPluginDependencies();
    }

    for (const plugin of PLUGINS) {
        try {
            plugin.install(app);
        } catch (error) {
            throw new PluginInstallError(plugin.name, error);
        }
    }

    return app;
}
