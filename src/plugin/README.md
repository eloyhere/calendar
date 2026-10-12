# src/plugin — 依赖与插件汇入口

本目录是第三方 UI 依赖进入 `calendar` 项目的**唯一入口**。三个依赖已经在
`package.json` 的 `dependencies` 里声明、由 `package-lock.json` 锁定、并已安装到
`node_modules`，本目录负责把它们**接进应用**，而不是再装一遍。

## 目录结构

```
src/plugin/
├─ index.ts            插件注册中心：installPlugins(app)
├─ dependencies.ts     三个依赖的统一转发 + 开发期自检
├─ router.ts           路由表：/:module 覆盖 views/entities.ts 的全部实体
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
| `vue-router`              | ^5.4.0  | hash 模式路由，`/:module` 对应一个实体  |

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
| `DEFAULT_MODULE`                | 默认实体模块名                         |
| `ROUTE_NAMES` / `isKnownModule` | 路由名常量与模块名校验                 |

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

| 路径               | 名称       | 说明                                           |
| ------------------ | ---------- | ---------------------------------------------- |
| `/`                | `root`     | 重定向到默认实体                               |
| `/:module`         | `entity`   | 实体页，`module` 必须在 `views/entities.ts` 中 |
| `/:pathMatch(.*)*` | `fallback` | 未匹配路径回到默认实体，避免白屏               |

用 **hash 模式**（URL 形如 `index.html#/temporal`）而不是 history 模式：
Electron 以 `file://` 装载页面，history 模式在刷新与深链时会请求真实文件路径而 404。

非法 `module` 由 `router.beforeEach` 拦下并重定向到默认实体，不会把
`EntityView` 挂起来再让它抛错。

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
