/**
 * `src/plugin` 的依赖汇入口。
 *
 * 本目录是三个第三方 UI 依赖进入项目的唯一入口。渲染进程要用它们，一律从
 * `src/plugin` 取，不要在业务代码里直接写裸包名：
 *
 * 1. 依赖来源单一，升级时只需要看本文件；
 * 2. 裸包名一旦散落到各视图，将来换实现（比如 Element Plus 换 Naive UI）
 *    就得逐个文件改，从这里转发则只改本文件。
 *
 * 版本号与 `package.json` 的 `dependencies` 必须一致，`PLUGIN_VERSIONS` 是
 * 给人看的对照表，`verifyPluginDependencies()` 负责在开发期验证依赖真的能解析。
 */

import "element-plus/dist/index.css";

import type { Component } from "vue";

/** `package.json` 的 `dependencies` 中与插件相关的三项，逐字对照。 */
export const PLUGIN_VERSIONS = {
    "element-plus": "^2.14.7",
    "@element-plus/icons-vue": "^2.3.2",
    "vue-router": "^5.4.0"
} as const;

/** 插件依赖的包名。 */
export type PluginDependencyName = keyof typeof PLUGIN_VERSIONS;

/* -------------------------------------------------------------------------- */
/* ui：Element Plus                                                            */
/* -------------------------------------------------------------------------- */

/** 与 router 段同理：先 import 再 export，本文件内部也要能引用它做自检。 */
import ElementPlus from "element-plus";

export { ElementPlus };

/** 中文语言包；分页、表格空态、日期面板等内置文案靠它本地化。 */
export { default as elementPlusZhCn } from "element-plus/es/locale/lang/zh-cn";

/* -------------------------------------------------------------------------- */
/* icons：@element-plus/icons-vue                                              */
/* -------------------------------------------------------------------------- */

import * as ElementPlusIcons from "@element-plus/icons-vue";

/**
 * 全部图标组件。
 *
 * 是 293 个 Vue 组件对象（每个都有 `name` 与 `setup`，但**没有 `install`**），
 * 所以只能 `app.component(name, icon)` 逐个注册，不能 `app.use(icon)`。
 *
 * 类型写成 `Record<string, Component>` 而不是 `unknown`：`AppIcon.vue` 要按名字
 * 取出组件交给 `<component :is>`，`unknown` 会逼着每个调用点写一次断言。
 */
export const elementPlusIcons: Record<string, Component> = ElementPlusIcons;

/** 图标组件名列表，注册与自检时用。 */
export const elementPlusIconNames: string[] = Object.keys(ElementPlusIcons);

/**
 * 按名字取图标组件。
 *
 * 白名单（`src/plugin/icons.ts`）已经保证名字合法，但白名单是手写的，
 * 万一它与依赖的真实导出漂移了，这里返回 `null` 而不是抛错：
 * 菜单少一个图标不该把整个应用拦在启动阶段。
 */
export function resolveIconComponent(name: string): Component | null {
    return elementPlusIcons[name] ?? null;
}

/* -------------------------------------------------------------------------- */
/* router：vue-router                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 注意这里用"先 import、再 export"而不是 `export { x } from 'vue-router'`：
 * 后者只在模块外可见，本文件内部拿不到 `createRouter` 这些名字，
 * `verifyPluginDependencies()` 就没法引用它们。
 */
import {
    createMemoryHistory,
    createRouter,
    createWebHashHistory,
    RouterLink,
    RouterView,
    useRoute,
    useRouter
} from "vue-router";
import type { RouteRecordRaw, Router as VueRouter, RouterHistory } from "vue-router";

export {
    createMemoryHistory,
    createRouter,
    createWebHashHistory,
    RouterLink,
    RouterView,
    useRoute,
    useRouter
};

export type { RouteRecordRaw, RouterHistory };
export type { VueRouter as Router };

/* -------------------------------------------------------------------------- */
/* 自检                                                                        */
/* -------------------------------------------------------------------------- */

/** 自检失败时抛出，便于在控制台一眼定位是插件层的问题。 */
export class PluginDependencyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PluginDependencyError";
    }
}

/**
 * 验证三个依赖确实被解析到了。
 *
 * 只在开发期调用：生产构建没必要为了自检再把包摸一遍。
 * 版本范围的正式校验交给 npm（`package-lock.json` 已锁定），这里只抓
 * "node_modules 缺失或解析到空模块"这种最常见的故障。
 */
export function verifyPluginDependencies(): void {
    const missing: string[] = [];

    if (!ElementPlus) {
        missing.push("element-plus");
    }
    if (elementPlusIconNames.length === 0) {
        missing.push("@element-plus/icons-vue");
    }
    if (typeof createRouter !== "function" || typeof createWebHashHistory !== "function") {
        missing.push("vue-router");
    }

    if (missing.length > 0) {
        throw new PluginDependencyError(
            `src/plugin 依赖不可用：${missing.join("、")}。请在项目根目录执行 npm install。`
        );
    }
}
