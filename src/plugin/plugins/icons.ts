/**
 * Element Plus 图标插件。
 *
 * 把图标注册为全局组件，模板里可以直接写 `<ElIcon><Search /></ElIcon>`。
 *
 * 为什么不用 `app.use()`：图标导出的是组件对象，只有 `name` 与 `setup`，
 * 没有 `install`（已实测 293 个全部如此），`app.use()` 会直接抛错，
 * 只能逐个 `app.component(name, icon)`。
 *
 * 代价：全量注册会把 293 个图标打进产物。介意体积时把
 * `ELEMENT_PLUS_ICONS` 改成显式清单——更好的做法是直接填
 * `src/plugin/icons.ts` 的 `ICON_NAMES`，那个白名单正是"项目实际用到的图标"，
 * 下面的循环与校验逻辑都无需改动。
 */
import type { Component } from "vue";
import { elementPlusIcons, resolveIconComponent } from "../dependencies";
import { ICON_NAMES } from "../icons";
import type { CalendarPlugin } from "./types";

/**
 * 需要全局注册的图标名；空数组表示全量注册 293 个。
 *
 * 与 `src/plugin/icons.ts` 的 `ICON_NAMES` 是两个不同的问题：
 * 那边是"路由与菜单允许引用哪些图标"（写错要报错），
 * 这边是"运行时把哪些图标装进应用"（决定产物体积）。
 * 想让产物瘦下来，就把本数组改成 `[...ICON_NAMES]`。
 */
export const ELEMENT_PLUS_ICONS: string[] = [];

/** 取本次要注册的图标名；显式清单里有拼错的会在这里暴露出来。 */
export function resolveIconNames(): string[] {
    if (ELEMENT_PLUS_ICONS.length === 0) {
        return Object.keys(elementPlusIcons);
    }

    const unknown = ELEMENT_PLUS_ICONS.filter((name) => !resolveIconComponent(name));
    if (unknown.length > 0) {
        throw new Error(
            `plugins/icons.ts 的 ELEMENT_PLUS_ICONS 里有不存在的图标：${unknown.join("、")}`
        );
    }
    return ELEMENT_PLUS_ICONS;
}

/**
 * 校验白名单里的名字在依赖里真的存在。
 *
 * 白名单（`ICON_NAMES`）是手写的，依赖升级后可能少掉某个图标。开发期在这里
 * 报出来，胜过菜单里突然少一个图标却没人知道为什么。
 */
function verifyIconWhitelist(): void {
    const missing = ICON_NAMES.filter((name) => !resolveIconComponent(name));
    if (missing.length > 0) {
        throw new Error(
            `src/plugin/icons.ts 的白名单与 @element-plus/icons-vue 不一致，` +
                `下列图标在依赖里不存在：${missing.join("、")}`
        );
    }
}

export const iconsPlugin: CalendarPlugin = {
    name: "element-plus-icons",
    description: "Element Plus 图标全局组件",
    install(app) {
        if (import.meta.env.DEV) {
            verifyIconWhitelist();
        }

        for (const name of resolveIconNames()) {
            app.component(name, elementPlusIcons[name] as Component);
        }
    }
};
