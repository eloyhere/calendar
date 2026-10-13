<script setup lang="ts">
/**
 * 页头 —— 同时也是这个无边框窗口的**自绘标题栏**。
 *
 * ## 为什么只有一条横条
 *
 * 窗口是无边框的（见 `main/window.ts` 的 `frame: false`），所以"品牌 + 导航 +
 * 窗口按钮"没有第二处可放。曾经设想过"标题栏一条 + 导航栏一条"，但窗口默认只有
 * 900×670，两条横条会把内容区压掉 100px 以上，而且品牌会在两条里各出现一次。
 * 合成一条后：左边品牌、中间导航、右边窗口按钮，横向空间本来就是够的。
 *
 * ## 拖拽区怎么划
 *
 * 整条 `app-region: drag`，再把**每个可交互元素**标回 `no-drag`（导航是 `<ElMenu>`、
 * 品牌是链接、右边是三颗按钮）。反过来做——只留一条空白 spacer 可拖——在导航项不
 * 够宽的时候几乎没有可拖的地方。被标了 `no-drag` 的元素不会触发拖拽，也就不会
 * 抢掉点击。
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

        <span v-if="pageTitle" class="app-header__divider" aria-hidden="true"></span>

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
     * 整条可拖拽。子元素里凡是能点的都标了 `no-drag`（菜单、品牌图标、窗口按钮），
     * 剩下导航右侧那段空白就是拖窗口 / 双击最大化用的地方。
     */
    app-region: drag;
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color);
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
    app-region: no-drag;
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

/* 品牌与当前页之间的细竖线：两者层级不同，需要一道分隔 */
.app-header__divider {
    background: var(--el-border-color);
    flex-shrink: 0;
    height: 16px;
    width: 1px;
}

.app-header__page {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 13px;
    max-width: 160px;
}

.app-header__menu {
    app-region: no-drag;
    /*
     * Element Plus 的横向菜单写死了 60px 高（那是"页头"的规格），会把 48px 的
     * 标题栏撑出去、菜单项文字被上下裁掉。压回标题栏高度。
     */
    --el-menu-horizontal-height: 48px;
    border-bottom: none;
    flex: 1;
    min-width: 0;
}

/*
 * 菜单项本身也要压扁：`.el-menu--horizontal > .el-menu-item` 的 60px 高度与
 * 2px 选中下划线都属于"独立页头"，在标题栏里会顶出边框、下划线也贴不到底。
 */
.app-header__menu :deep(.el-menu--horizontal > .el-menu-item),
.app-header__menu :deep(.el-menu--horizontal > .el-sub-menu .el-sub-menu__title) {
    border-bottom: none;
    height: 48px;
    line-height: 48px;
    padding: 0 12px;
}

/* 横向菜单容器自己也要压扁（它在 Element Plus 里同样是 60px） */
.app-header__menu :deep(.el-menu--horizontal) {
    height: 48px;
}
</style>
