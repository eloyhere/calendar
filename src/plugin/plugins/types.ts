/**
 * 插件契约。
 *
 * 每个插件是一个极小的对象：一个名字 + 一个 `install`。不用 Vue 的
 * `Plugin` 类型是因为我们还要在 `installPlugins` 里按名字记录装配日志，
 * 名字是必需的字段而不是可选的。
 */
import type { App } from "vue";

/** 一个可装配到渲染进程的插件。 */
export interface CalendarPlugin {
    /** 插件名，用于日志与排错 */
    name: string;
    /** 说明这个插件做什么，装配日志里会打出来 */
    description: string;
    /** 装配到 Vue 应用实例 */
    install: (app: App) => void;
}
