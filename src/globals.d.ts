/**
 * 全局组件与路由元信息的类型扩充。
 *
 * 本文件做两件事，都靠 TypeScript 的**模块扩充**（module augmentation）实现：
 *
 * 1. `vue` 的 `GlobalComponents`——让模板里能写 `<ElTable>`、`<ElSkeleton>`
 *    这类由 `app.use(ElementPlus)` 在运行时全局注册的组件；
 * 2. `vue-router` 的 `RouteMeta`——让 `route.meta.title` / `route.meta.icon`
 *    有确切类型而不是 `unknown`。
 *
 * ⚠️ 文件顶部那个 `import type` 不能删。没有它，本文件就是一份**环境模块声明**
 * （ambient module），下面的 `declare module "vue"` 会**替换**整个 `vue` 模块
 * 而不是扩充它——全项目每一条 `import { computed } from "vue"` 都会变成
 * TS2305 "Module 'vue' has no exported member"。有了 import，本文件是一个模块，
 * `declare module` 才是扩充。这是已经踩过的坑。
 */

import type { IconName } from "./plugin/icons";

/* -------------------------------------------------------------------------- */
/* 1. Element Plus 全局组件                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 只登记模板里**实际用到**的组件：写多了没人维护，写少了 `vue-tsc` 会立刻报出来。
 * 在 `<script setup>` 里显式 import 的组件不受本表影响（显式 import 优先）。
 */
declare module "vue" {
    export interface GlobalComponents {
        // 布局容器
        ElContainer: typeof import("element-plus")["ElContainer"];
        ElHeader: typeof import("element-plus")["ElHeader"];
        ElAside: typeof import("element-plus")["ElAside"];
        ElMain: typeof import("element-plus")["ElMain"];
        ElFooter: typeof import("element-plus")["ElFooter"];
        ElScrollbar: typeof import("element-plus")["ElScrollbar"];
        ElBacktop: typeof import("element-plus")["ElBacktop"];

        // 导航
        ElMenu: typeof import("element-plus")["ElMenu"];
        ElSubMenu: typeof import("element-plus")["ElSubMenu"];
        ElMenuItem: typeof import("element-plus")["ElMenuItem"];
        ElBreadcrumb: typeof import("element-plus")["ElBreadcrumb"];
        ElBreadcrumbItem: typeof import("element-plus")["ElBreadcrumbItem"];

        // 基础
        ElButton: typeof import("element-plus")["ElButton"];
        ElButtonGroup: typeof import("element-plus")["ElButtonGroup"];
        ElIcon: typeof import("element-plus")["ElIcon"];
        ElText: typeof import("element-plus")["ElText"];
        ElLink: typeof import("element-plus")["ElLink"];
        ElTag: typeof import("element-plus")["ElTag"];
        ElDivider: typeof import("element-plus")["ElDivider"];
        ElSpace: typeof import("element-plus")["ElSpace"];
        ElTooltip: typeof import("element-plus")["ElTooltip"];
        ElAffix: typeof import("element-plus")["ElAffix"];
        ElWatermark: typeof import("element-plus")["ElWatermark"];
        ElPopover: typeof import("element-plus")["ElPopover"];

        // 栅格与分隔
        ElRow: typeof import("element-plus")["ElRow"];
        ElCol: typeof import("element-plus")["ElCol"];
        ElSplitter: typeof import("element-plus")["ElSplitter"];
        ElSplitterPanel: typeof import("element-plus")["ElSplitterPanel"];

        // 数据展示
        ElCard: typeof import("element-plus")["ElCard"];
        ElCollapse: typeof import("element-plus")["ElCollapse"];
        ElCollapseItem: typeof import("element-plus")["ElCollapseItem"];
        ElTabs: typeof import("element-plus")["ElTabs"];
        ElTabPane: typeof import("element-plus")["ElTabPane"];
        ElDescriptions: typeof import("element-plus")["ElDescriptions"];
        ElDescriptionsItem: typeof import("element-plus")["ElDescriptionsItem"];
        ElTable: typeof import("element-plus")["ElTable"];
        ElTableColumn: typeof import("element-plus")["ElTableColumn"];
        ElStatistic: typeof import("element-plus")["ElStatistic"];
        ElTimeline: typeof import("element-plus")["ElTimeline"];
        ElTimelineItem: typeof import("element-plus")["ElTimelineItem"];
        ElTree: typeof import("element-plus")["ElTree"];
        ElSegmented: typeof import("element-plus")["ElSegmented"];
        ElCollapseTransition: typeof import("element-plus")["ElCollapseTransition"];
        ElAvatar: typeof import("element-plus")["ElAvatar"];
        ElBadge: typeof import("element-plus")["ElBadge"];
        ElEmpty: typeof import("element-plus")["ElEmpty"];
        ElSkeleton: typeof import("element-plus")["ElSkeleton"];
        ElSkeletonItem: typeof import("element-plus")["ElSkeletonItem"];
        ElResult: typeof import("element-plus")["ElResult"];
        ElAlert: typeof import("element-plus")["ElAlert"];
        ElProgress: typeof import("element-plus")["ElProgress"];
        ElPagination: typeof import("element-plus")["ElPagination"];
        ElCarousel: typeof import("element-plus")["ElCarousel"];
        ElCarouselItem: typeof import("element-plus")["ElCarouselItem"];

        // 表单
        ElForm: typeof import("element-plus")["ElForm"];
        ElFormItem: typeof import("element-plus")["ElFormItem"];
        ElInput: typeof import("element-plus")["ElInput"];
        ElInputNumber: typeof import("element-plus")["ElInputNumber"];
        ElSelect: typeof import("element-plus")["ElSelect"];
        ElOption: typeof import("element-plus")["ElOption"];
        ElRadioGroup: typeof import("element-plus")["ElRadioGroup"];
        ElRadio: typeof import("element-plus")["ElRadio"];
        ElRadioButton: typeof import("element-plus")["ElRadioButton"];
        ElCheckbox: typeof import("element-plus")["ElCheckbox"];
        ElSwitch: typeof import("element-plus")["ElSwitch"];
        ElSlider: typeof import("element-plus")["ElSlider"];
        ElDatePicker: typeof import("element-plus")["ElDatePicker"];
        ElTimePicker: typeof import("element-plus")["ElTimePicker"];
        ElCascader: typeof import("element-plus")["ElCascader"];

        // 反馈
        ElDialog: typeof import("element-plus")["ElDialog"];
        ElDrawer: typeof import("element-plus")["ElDrawer"];
        ElPopconfirm: typeof import("element-plus")["ElPopconfirm"];
    }
}

/* -------------------------------------------------------------------------- */
/* 2. 路由元信息                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 扩充 vue-router 的 `RouteMeta`。
 *
 * 不这样做的话 `route.meta.title` 是 `unknown`，`route.meta.icon` 更没法直接交给
 * `<AppIcon :name>`——每个读取点都要写一次断言。扩充之后**读取有类型**，
 * 而**写入在 `plugin/router.ts` 里由 `AppRoute` 把关**（`AppRoute` 用的是真正
 * 带泛型的 `RouteRecordRaw`，`meta` 会被逐个字段检查）。
 */
declare module "vue-router" {
    export interface RouteMeta {
        /** 页面标题；菜单文案、面包屑节点、`document.title` 共用这一个字段 */
        title?: string;
        /** 菜单图标，取值必须来自 `src/plugin/icons.ts` 的白名单 */
        icon?: IconName;
        /**
         * 是否出现在菜单里。
         *
         * - 不写：有 `title` 就出现；
         * - `false`：**有子项时露出自己**（渲染成只展开、不跳转的分组），
         *   用于 `历法 → 天文历 → 简介/日历/数据` 这种三级结构；
         * - `"hidden"`：彻底藏起来，子项提升到上一层，用于 `/agent/chat` 这种纯出口。
         */
        menu?: boolean | "hidden";
        /** 页面说明，用于菜单项提示与页头副标题 */
        description?: string;
    }
}
