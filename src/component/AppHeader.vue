<script setup lang="ts">
/**
 * 页头 —— 同时也是这个无边框窗口的**自绘标题栏**。
 *
 * ## 为什么只有一条横条
 *
 * 窗口是无边框的（见 `main/window.ts` 的 `frame: false`），所以"品牌 + 导航 +
 * 窗口按钮"没有第二处可放。曾经设想过"标题栏一条 + 导航栏一条"，但两条横条会把
 * 内容区压掉 100px 以上，而且品牌会在两条里各出现一次。
 * 合成一条后：左边品牌、中间导航、右边窗口按钮，横向空间本来就是够的
 * （窗口默认 1440×720）。
 *
 * ## 拖拽区怎么划：整条可拖，只把"能点的"抠掉（这里踩过一个坑）
 *
 * 规则一句话：**标题栏整条都能拖窗口，只有真正能点的元素才收回点击权**——品牌、
 * 当前页胶囊、菜单项旁边的空白、菜单与窗口按钮之间的空白，全都能拖；不能拖的只有
 * 菜单项本身（`<ElMenu>` 的一级项）和右边三颗窗口按钮。
 *
 * 坑在"抠洞"是按**元素盒子**算的：谁盖住了标题栏，谁的地盘就不是拖拽区。一级菜单
 * 以前整条被标成 `no-drag`（还把 `flex: 1` 铺满剩余宽度），于是菜单项右边那一大片
 * 看着是空白的地方也归它——实测 900px 宽的窗口只剩十几像素的缝隙能拖，用户按在
 * "明显是空白"的地方根本拖不动窗口。这就是"标题栏不能拖动"的成因。
 *
 * 所以现在是反过来标：菜单**容器**保持 `drag`，只把 `.el-menu-item` /
 * `.el-sub-menu__title` 标成 `no-drag`。拖动菜单项之间的空白、菜单项右侧的空白，
 * 都会拖动整个窗口；点菜单项本身照常跳转。
 *
 * ## 两种属性名都写
 *
 * `-webkit-app-region` 与无前缀的 `app-region` 在 Chromium 里是同一个属性的两个
 * 名字（Electron 39 / Chromium 142 两个都认），但**认不出的声明会被 CSS 解析器
 * 直接丢掉**，所以两条都写上，不必赌运行时的 Chromium 版本。
 *
 * ## 菜单深浅不一，交给递归组件
 *
 * 一级（概览 / 智能体 / 历法 / 命理 / 年 / 性能）铺在菜单条上，之后每一层都交给
 * `AppMenuTree` 递归渲染——因为菜单本身的深度就不统一：
 *
 * - 概览：**一级**，没有子项，直接跳转；
 * - 智能体、命理、年、性能：**二级**（智能体下有"工作流"，命理下是六个排盘页）；
 * - 历法：**三级**（历法 → 天文历 → 简介 / 日历 / 数据）。
 *
 * 这里因此不写任何 `v-if="第几层"` 的分支；多深、哪里深，全由
 * `plugin/router.ts` 的嵌套决定。
 *
 * ## 配色
 *
 * 一律用 Element Plus 的默认浅色变量（`--el-*`），不写死颜色。横向菜单默认
 * 就是白底 + `--el-color-primary` 高亮，无需额外覆盖。
 */

import { computed, watch } from "vue";

import type { MenuNode } from "../plugin";
import { useRoute } from "../plugin";
import AppBrandIcon from "./AppBrandIcon.vue";
import AppMenuTree from "./AppMenuTree.vue";
import AppWindowControls from "./AppWindowControls.vue";

interface Props {
    /** 菜单树，来自 `createMenuTree()` */
    items: readonly MenuNode[];
    /** 当前高亮的路径 */
    activePath: string;
    /** 品牌名 */
    brand?: string;
}

const props = withDefaults(defineProps<Props>(), { brand: "轩辕历法" });

const emit = defineEmits<{
    /** 用户点了菜单项 */
    select: [path: string];
}>();

const route = useRoute();

/** 当前页面标题，显示在品牌右边，给这条 48px 的横条一点信息量。 */
const pageTitle = computed(() => {
    const title = route.meta.title;
    return title ? String(title) : "";
});

/** 页面标题同时写进 `document.title`（任务栏悬停、窗口列表都用它）。 */
watch(
    pageTitle,
    (title) => {
        document.title = title ? `${title} · ${props.brand}` : props.brand;
    },
    { immediate: true }
);
</script>

<template>
    <header class="app-header">
        <div class="app-header__brand">
            <AppBrandIcon :size="24" />
            <ElText tag="strong" class="app-header__title">{{ props.brand }}</ElText>
        </div>

        <span v-if="pageTitle" class="app-header__page is-truncated">{{ pageTitle }}</span>

        <ElMenu
            :default-active="props.activePath"
            mode="horizontal"
            :ellipsis="false"
            router
            class="app-header__menu">
            <AppMenuTree :items="props.items" @select="emit('select', $event)" />
        </ElMenu>

        <AppWindowControls />
    </header>
</template>

<style scoped>
.app-header {
    /*
     * 整条可拖拽：只有真正能点的元素才在下面标回 `no-drag`（菜单项、三颗窗口按钮）。
     * 品牌、当前页胶囊、菜单的空白处都跟着这一条走。
     *
     * 两种写法都给：`-webkit-app-region` 与无前缀的 `app-region` 在 Chromium 里是
     * 同一个属性的两个名字，而**认不出的声明会被 CSS 解析器直接丢掉**——两条都写
     * 才不用赌运行时的 Chromium 版本（Electron 39 两个都认）。
     */
    -webkit-app-region: drag;
    app-region: drag;
    align-items: center;
    background: var(--el-bg-color);
    /*
     * 底边用 inset 阴影而不是 border-bottom：border 会占掉 1px 高度，让"贴满高度"
     * 的窗口按钮比整条高出 1px、被溢出裁掉。阴影不参与布局，48px 就是 48px。
     */
    box-shadow: inset 0 -1px 0 var(--el-border-color);
    display: flex;
    flex-shrink: 0;
    gap: 12px;
    height: 48px;
    padding-left: 14px;
    padding-right: 14px;
    /* 标题栏里的文字不该被选中（拖拽时会出现蓝色选区） */
    user-select: none;
}

.app-header__brand {
    /*
     * 品牌也留可拖：它是纯装饰（图标 + 名字），不是链接、不是按钮。标题栏左边那一块
     * 按下去能拖窗口，才符合"整条标题栏只有能点的东西才不拖"这条规则。
     */
    -webkit-app-region: drag;
    app-region: drag;
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.app-header__title {
    font-size: 15px;
    letter-spacing: 0.02em;
    white-space: nowrap;
}

/*
 * 当前页：一枚浅底小胶囊。
 *
 * 原来这里是一行灰色小字加一道竖线，层级信息全靠颜色深浅表达，远看和品牌名糊在
 * 一起。换成胶囊之后，品牌（深、大字）与当前页（浅底、小字）一眼能分开，也省掉了
 * 那道竖线——它本来就是为这个目的加的。
 *
 * 它落在拖拽区里，点击事件会被拖拽区吃掉——徽标本来也不该可点，没有损失。
 */
.app-header__page {
    background: var(--el-fill-color-light);
    border-radius: 999px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 12px;
    line-height: 20px;
    max-width: 180px;
    padding: 0 10px;
}

.app-header__menu {
    /*
     * 菜单**容器**保持可拖，只有菜单项本身收回去（见下面那条规则）。
     *
     * 拖拽区是按元素盒子抠洞的：谁盖住了标题栏，谁就不是拖拽区。以前这里是
     * `no-drag` + `flex: 1`，菜单盒子横跨整个剩余宽度——连菜单项右边那一大片看着是
     * 空白的地方也归它，全是 no-drag。实测 900px 的窗口只剩十几像素的缝隙能拖，
     * 用户按在"明显是空白"的地方根本拖不动，这就是"标题栏不能拖动"。
     *
     * 反过来标记才是对的：能点的（菜单项）收成 no-drag，剩下的一律跟着标题栏走。
     * 于是"拖菜单右边的空白"和"拖菜单项之间的空白"都能拖窗口。
     */
    -webkit-app-region: drag;
    app-region: drag;
    /* 铺满菜单到窗口按钮之间的空间：这片空白就是标题栏的主拖拽区 */
    flex: 1 1 auto;
    /* 窗口窄到摆不下一级菜单时：先裁菜单尾巴，不要把三颗窗口按钮顶出窗口 */
    min-width: 0;
    overflow: hidden;
    /*
     * Element Plus 的横向菜单写死了 60px 高（那是"页头"的规格），会把 48px 的
     * 标题栏撑出去、菜单项文字被上下裁掉。压回标题栏高度。
     * 变量声明在 `:root` 上，这里靠 scoped 选择器多出来的属性选择器压过它。
     */
    --el-menu-horizontal-height: 48px;
    border-bottom: none;
}

/*
 * 一级菜单项：唯一要收回点击权的地方，同时收一点内边距——Element Plus 的横向项按
 * "独立页头"给了左右各 20px，在标题栏里显得散。
 *
 * `no-drag` 标在整个菜单项盒子上，而不是只标文字：菜单项的 hover 底色、点击热区
 * 本来就是整块，只把文字标成可点会让"看着能点的地方点不动"。
 *
 * 选择器只能从 `.app-header__menu` **往下**找——`.el-menu--horizontal` 就是菜单根
 * 元素本身，写成 `.app-header__menu :deep(.el-menu--horizontal > …)` 永远匹配不到
 * （这条死规则原来就在这里，顺手删了）。
 */
.app-header__menu :deep(.el-menu-item),
.app-header__menu :deep(.el-sub-menu__title) {
    -webkit-app-region: no-drag;
    app-region: no-drag;
    font-size: 14px;
    padding: 0 12px;
}
</style>
