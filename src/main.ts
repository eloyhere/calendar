import { createApp } from "vue";
import { createPinia } from "pinia";

import { installPlugins } from "./plugin";
import "./assets/main.css";
import App from "./App.vue";

/**
 * 渲染进程入口。
 *
 * 装配顺序有实际含义：
 * 1. `createPinia()` 先装——插件与视图里的 store 依赖它；
 * 2. `installPlugins()` 装 `src/plugin` 的全部插件（Element Plus、图标、路由），
 *    它内部按 `PLUGINS` 数组顺序执行，具体插件在这里不出现；
 * 3. `mount()` 必须在路由装好之后，否则 `App.vue` 里的 `useRoute()` 拿不到实例。
 *
 * Element Plus 的引入、样式与中文语言包都已收进 `src/plugin`，
 * 本文件不再出现任何第三方包名。
 */
const app = createApp(App);

app.use(createPinia());
installPlugins(app);

app.mount("#app");
