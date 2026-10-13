/**
 * vue-router 插件。
 *
 * 装配 `src/plugin/router.ts` 里定义好的路由表。这里不重复写路由，
 * 只负责"把 router 装到 app 上"这件事——路由表与装配分开，测试里就能
 * 用 `createMemoryHistory()` 单独构造一套路由来跑。
 */
import { createAppRouter } from "../router";
import type { CalendarPlugin } from "./types";

export const routerPlugin: CalendarPlugin = {
    name: "vue-router",
    description: "hash 模式路由（嵌套路由树 + 菜单由路由表生成）",
    install(app) {
        app.use(createAppRouter());
    }
};
