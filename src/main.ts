import { createApp } from "vue";
import { createPinia } from "pinia";

import { installPlugins } from "./plugin";
import { installCalendarRunner } from "./datasource/runner";
/*
 * 样式的引入顺序有含义，`tokens.css` 必须在 `main.css` 之前：
 *
 * 1. `element-plus/dist/index.css`——由 `plugin/dependencies.ts` 引入，它定义全部
 *    `--el-*` 变量；
 * 2. `tokens.css`——本项目自己的令牌，**引用** `--el-*` 而不是覆盖它们；
 * 3. `main.css`——全局重置与工具类，引用第 2 步的令牌。
 *
 * CSS 变量未定义时不会报错，只会静默回退成空值，所以顺序不能靠"恰好管用"维持。
 */
import "./assets/tokens.css";
import "./assets/main.css";
import App from "./App.vue";

/**
 * 渲染进程入口。
 *
 * 装配顺序有实际含义：
 * 1. `createPinia()` 先装——插件与视图里的 store 依赖它；
 * 2. `installCalendarRunner()` 把 SQLite 驱动接缝接到主进程的只读连接上
 *    （`src/datasource/runner.ts`）。必须在 `mount()` 之前：页面装配时就会构造
 *    repository / service，它们通过 `runnerOf(模块名)` 取驱动；
 * 3. `installPlugins()` 装 `src/plugin` 的全部插件（Element Plus、图标、路由），
 *    它内部按 `PLUGINS` 数组顺序执行，具体插件在这里不出现；
 * 4. `mount()` 必须在路由装好之后，否则 `App.vue` 里的 `useRoute()` 拿不到实例。
 *
 * Element Plus 的引入、样式与中文语言包都已收进 `src/plugin`，
 * 本文件不再出现任何第三方包名。
 */
const app = createApp(App);

app.use(createPinia());
installCalendarRunner();
installPlugins(app);

app.mount("#app");
