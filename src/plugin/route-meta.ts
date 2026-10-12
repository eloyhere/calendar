/**
 * 路由记录类型：路由表里每个节点都应当是这个类型。
 *
 * 这里是"路由表即唯一事实来源"的落点：菜单不再手写，而是由 `plugin/menu.ts`
 * 从路由树推导。因此菜单需要的每个字段（标题、图标、排序、是否入菜单）
 * 都必须声明在路由的 `meta` 上，而不是散在某个 `.vue` 的模板里。
 *
 * 字段类型本身定义在 `src/globals.d.ts` 的 `declare module "vue-router"` 里——
 * 那份扩充让**读取**端（`route.meta.title` / `route.meta.icon`）也有类型，
 * 不必在每个读取点写断言。本文件负责**写入**端：`AppRoute` 是
 * `RouteRecordRaw` 本身（联合类型），所以 `plugin/router.ts` 里每一条 `meta`
 * 都会在赋值时被逐个字段检查，`icon` 写错名字在 `vue-tsc` 阶段就会报出来。
 */

import type { RouteRecordRaw } from "./dependencies";

/**
 * 带子路由的路由记录。
 *
 * 刻意**不写成** `RouteRecordRaw & { meta?: RouteMeta }`：`RouteRecordRaw` 的默认
 * 泛型参数会把 `meta` 退化成 `RouteMeta | undefined`，于是 `route.meta?.title`
 * 处处要加 `?.`，而 `route.component` 又不在类型上（校验 `buildNodes` 里
 * "分组节点不该被点走"时要用到它）。直接用联合类型反而更准。
 *
 * 也刻意**不自己取** `RouteRecordRaw` 的泛型参数：那是 vue-router 内部签名，
 * 跟着它走会在升级时被动损坏；`children?: AppRoute[]` 这一层递归足够表达
 * "树"这件事，赋值点的 `meta` 检查一样成立。
 */
export type AppRoute = RouteRecordRaw & { children?: AppRoute[] };
