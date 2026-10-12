/**
 * Element Plus 插件。
 *
 * 全量注册 + 中文语言包，与改造前 `main.ts` 里的行为逐字一致：
 * `app.use(ElementPlus, { locale: zhCn })`，样式由 `dependencies.ts` 引入。
 */
import { ElementPlus, elementPlusZhCn } from "../dependencies";
import type { CalendarPlugin } from "./types";

export const elementPlusPlugin: CalendarPlugin = {
    name: "element-plus",
    description: "Element Plus 组件库（中文语言包）",
    install(app) {
        app.use(ElementPlus, { locale: elementPlusZhCn });
    }
};
