# src/plugin — 依赖与插件汇入口

本目录是第三方 UI 依赖进入 `calendar` 项目的**唯一入口**。三个依赖已经在
`package.json` 的 `dependencies` 里声明、由 `package-lock.json` 锁定、并已安装到
`node_modules`，本目录负责把它们**接进应用**，而不是再装一遍。

## 目录结构

```
src/plugin/
├─ index.ts            插件注册中心：installPlugins(app)
├─ dependencies.ts     三个依赖的统一转发 + 开发期自检
├─ router.ts           路由表（纯配置）与路由实例 router
├─ plugins/
│  ├─ types.ts         CalendarPlugin 契约
│  ├─ element-plus.ts  Element Plus（中文语言包）
│  ├─ icons.ts         293 个图标注册为全局组件
│  └─ router.ts        装配 vue-router
└─ README.md           本文件
```

## 接入的依赖

| 包                        | 版本    | 作用                                    |
| ------------------------- | ------- | --------------------------------------- |
| `element-plus`            | ^2.14.7 | 组件库，样式在 `dependencies.ts` 里引入 |
| `@element-plus/icons-vue` | ^2.3.2  | 293 个图标，全量注册为全局组件          |
| `vue-router`              | ^5.4.0  | history 模式路由，嵌套路由树  |

> 版本号在 `dependencies.ts` 的 `PLUGIN_VERSIONS` 里与 `package.json` 逐字对照。
> 升级依赖时两处一起改，`pnpm`/`npm` 的锁文件负责真正的范围校验。

## 使用方式

应用启动（`src/renderer/src/main.ts`）：

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import { installPlugins } from "../../plugin";
import App from "./App.vue";

installPlugins(createApp(App).use(createPinia())).mount("#app");
```

业务代码取依赖，从 `src/plugin` 走：

```ts
import { ElMessage } from "element-plus"; // ❌ 不要这样
import { useRoute } from "../../plugin"; // ✅ 路由工具
import type { Router } from "../../plugin/dependencies"; // ✅ 类型从汇入口取
```

`src/plugin/index.ts` 对外公开这些东西：

| 名称                            | 用途                                   |
| ------------------------------- | -------------------------------------- |
| `installPlugins(app)`           | 应用启动时装配全部插件                 |
| `PLUGINS`                       | 插件清单，按装配顺序排列               |
| `useRoute` / `useRouter`        | 路由工具                               |
| `RouterLink` / `RouterView`     | 路由组件（已全局注册，模板里可直接用） |
| `routes` / `RouteName`          | 路由表与路由名常量                     |
| `router`                        | 路由实例，由 `plugins/router.ts` 装配  |
| `createMenuTree()`              | 由路由表推导出的侧栏菜单树             |

模板里图标已是全局组件，直接用：

```vue
<el-icon><Search /></el-icon>
```

## 加一个依赖 / 插件

1. `npm install <pkg>`，`package.json` 与锁文件自动更新；
2. 在 `dependencies.ts` 转发该包，并把版本写进 `PLUGIN_VERSIONS`；
3. 在 `plugins/` 下新建一个文件，导出 `CalendarPlugin`；
4. 加进 `index.ts` 的 `PLUGINS` 数组。

`main.ts` 与 `App.vue` 都不需要改。

## 路由

路由表在 `router.ts`，是**纯配置**：整棵树逐条写死，没有生成器、没有拼路径的
辅助函数；每条 `path` 都写成绝对路径，菜单与面包屑直接取 `route.path`。
新增页面 = 在 `routes` 里加一条带 `meta.title` 的路由。

```
/                         AppShell
├─ （空路径）             概览
├─ /agent /calendar /numerology /year /performance
└─ /:pathMatch(.*)*       兜底回 /
```

用 **history 模式**（`createWebHistory()`）。开发期走 dev server、`npm start`
走 `electron-vite preview`，都是 http，history 模式完全正常。

> ⚠️ **打包前必读**：打包后主进程用 `loadFile(...)` 装载页面，页面跑在 `file://`
> 下，而 `file://` 的来源是 opaque 的——`history.pushState` 会抛 `SecurityError`，
> 刷新与深链也会去请求真实文件路径而 404。要让打包产物也能用 history 模式，
> 必须把 `main/window.ts` 的 `loadRenderer` 从 `loadFile` 换成自定义协议
> （`registerSchemesAsPrivileged` + `protocol.handle("app://")`，并对非文件路径
> 回退到 `index.html`）。只改路由表不够。

## 需要注意

- **图标是全量注册的**：293 个都会进产物。介意体积就把 `plugins/icons.ts` 的
  `ELEMENT_PLUS_ICONS` 改成显式清单，循环逻辑无需改动。
- **`EntityView` 的 `:key` 必须是模块名**：改造前靠 `:key="current.module"` 强制
  重新挂载以避免上一个实体的状态残留；换成路由后这个 `:key` 仍然必需。
- **不要用 RouterView 的插槽参数取路由 props**：vue-router 5 的插槽参数是
  `{ Component, route }`，给的是路由对象本身。所有 `module` 由 `App.vue` 显式传入。
- **`verifyPluginDependencies()` 只在开发期跑**：生产构建不做自检。

## 已验证

- `vue-tsc --noEmit -p tsconfig.web.json` 通过；
- `electron-vite build` 通过，`EntityView` 被拆成独立懒加载 chunk（约 17 kB）；
- 用 Vite 的 SSR 加载器真实跑过路由：`/` 重定向、22/22 个实体可达、
  非法模块被守卫重定向、多层路径兜底、`installPlugins()` 注册 293 个全局组件。
- `src/datasource/*.sqlite.ts` 原先的 `TS2451 Cannot redeclare block-scoped variable` 已修复：
  生成器改成一表一个文件（`astronomy.sqlite.ts` -> `astronomy.year.sqlite.ts` +
  `astronomy.month.sqlite.ts`），年月两张表的同名语句不再落在同一个模块里。
- 仍有几处与 `src/plugin` 无关的既有报错：`TS5097`（`src/repository/*.ts` 为绕开同名的
  `.sqlite` 数据库文件而显式写了 `.ts` 扩展名，需要开 `allowImportingTsExtensions`）、
  `event` / `person` 两个 repository 的水合方法漏 import `textOf`、
  `src/main.ts` 解析不到 `../../plugin` 与 `./App.vue`。
