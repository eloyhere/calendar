# src/plugin — 依赖与插件汇入口

本目录是第三方 UI 依赖进入 `calendar` 项目的**唯一入口**。三个依赖已经在
`package.json` 的 `dependencies` 里声明、由 `package-lock.json` 锁定、并已安装到
`node_modules`，本目录负责把它们**接进应用**，而不是再装一遍。

## 目录结构

```
src/plugin/
├─ index.ts            插件注册中心：installPlugins(app)
├─ dependencies.ts     三个依赖的统一转发 + 开发期自检
├─ router.ts           路由表（纯配置）+ createAppRouter()
├─ menu.ts             由路由表推导侧栏/页头菜单树
├─ icons.ts            meta.icon 的图标白名单（IconName）
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
| `vue-router`              | ^5.4.0  | hash 模式路由，嵌套路由树               |

> 版本号在 `dependencies.ts` 的 `PLUGIN_VERSIONS` 里与 `package.json` 逐字对照。
> 升级依赖时两处一起改，`pnpm`/`npm` 的锁文件负责真正的范围校验。

## 使用方式

应用启动（`src/main.ts`）：

```ts
import { createApp } from "vue";
import { createPinia } from "pinia";
import { installPlugins } from "./plugin";
import App from "./App.vue";

installPlugins(createApp(App).use(createPinia())).mount("#app");
```

业务代码取依赖，从 `src/plugin` 走：

```ts
import { ElMessage } from "element-plus"; // ❌ 不要这样
import { useRoute } from "../plugin"; // ✅ 路由工具
import type { Router } from "../plugin/dependencies"; // ✅ 类型从汇入口取
```

`src/plugin/index.ts` 对外公开这些东西：

| 名称                              | 用途                                     |
| --------------------------------- | ---------------------------------------- |
| `installPlugins(app)`             | 应用启动时装配全部插件                   |
| `PLUGINS`                         | 插件清单，按装配顺序排列                 |
| `useRoute` / `useRouter`          | 路由工具                                 |
| `RouterLink` / `RouterView`       | 路由组件（已全局注册，模板里可直接用）   |
| `createAppRouter()`               | 建路由实例；`plugins/router.ts` 用它装配 |
| `routes` / `RouteName`            | 路由表与路由名常量                       |
| `resolveRoutePath(path, parent?)` | 把路由 `path` 规范化成绝对路径           |
| `createMenuTree()`                | 由路由表推导出的菜单树                   |
| `isIconName(name)` / `IconName`   | 图标白名单校验与图标名类型               |

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

路由表在 `router.ts`，是**纯配置**：整棵树逐条写死，每条 `path` 都写成绝对路径，
菜单与面包屑直接取 `route.path`。新增页面 = 在 `routes` 里加一条带 `meta.title`
的路由，菜单与窗口标题自动跟上。

```
/                         AppShell（横向页头 + 内容 + 页脚）
├─ （空路径）             概览
├─ /agent /calendar /numerology /year /performance
└─ /:pathMatch(.*)*       兜底回 /
```

外壳为什么挂在 `/`、概览反而是它的空路径子页，以及另外两种写法为什么不行，
都记在 `router.ts` 顶部的注释里——那三种写法都实测过。

用 **hash 模式**（`createWebHashHistory()`，`dependencies.ts` 转发）——沿用
electron-vite 模板的约定。

打包后页面已改由主进程用自定义协议 **`app://`** 装载（`main/window.ts` 的
`registerSchemesAsPrivileged` + `protocol.handle`），不再是 `loadFile` 的
`file://`；页面因此有正常来源（`origin = app://local`），CSP 的 `'self'` 也成立。
`file://` 那个"来源是 opaque 的"障碍已经不存在，将来若要换 history 模式，只需把
`router.ts` 的 `createWebHashHistory()` 换成 `createWebHistory()`。

当前保持 hash：URL 里多一个 `#` 对桌面应用没有实际代价，而 hash 模式在任何装载
方式下都不会坏。

## 需要注意

- **图标是全量注册的**：293 个都会进产物。`meta.icon` 只能取
  `src/plugin/icons.ts` 白名单里的名字（`IconName` 联合类型），写错在
  `vue-tsc` 阶段就报出来。介意体积就把 `plugins/icons.ts` 的
  `ELEMENT_PLUS_ICONS` 改成 `[...ICON_NAMES]`，循环无需改动。
- **菜单高亮不要用 `route.matched[0].path`**：外壳挂在 `/` 上，那个值永远是
  `/`，高亮会整片失效。用 `route.path`。
- **菜单深浅是不一样的，渲染必须递归**：概览是一级、智能体/命理/年/性能是二级、
  历法是三级（历法 → 天文历 → 简介/日历/数据）。`meta.menu` 因此有三种写法，
  见 `menu.ts` 头部那张表；按"固定两级"手写过一版，结果把三级拍平、八个历法的
  三级项混成同一层。
- **写 `.vue` 注释时不要写完整的 SFC 标签对**：Vue 的 SFC 词法分析只认第一个
  结束标签，注释里写一份示例就等于提前关掉所在块，报错却是文件结尾处的
  `Invalid end tag`。
- **`verifyPluginDependencies()` 只在开发期跑**：生产构建不做自检。

## 已验证

- `electron-vite build` 通过，59 个 `.vue` 各自成懒加载 chunk；
- 60 条路由逐条跑过真实导航：六个域的重定向、`/calendar/astronomy/entry` 这类
  深链、写错地址的兜底都落到预期页面；菜单树 47 项，每项都有图标与可点路径，
  最大深度 3 层，与预期一致；
- `vue-tsc --noEmit -p tsconfig.web.json` 在我的改动范围内无报错。
  剩余报错都在 `src/share/structure/`（5 条既有）与 `src/store/chat.store.ts` /
  `src/view/agent/Chat*View.vue`（会话功能，正在开发中）。

