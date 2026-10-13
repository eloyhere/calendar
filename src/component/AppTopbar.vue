<script setup lang="ts">
/**
 * 顶栏 —— 自绘标题栏的右半部分。
 *
 * ## 与 `AppSidebar` 合起来是完整标题栏
 *
 * 旧版把「品牌 + 横向菜单 + 窗口按钮」塞进一条 48px 的横条（见 `AppHeader.vue`
 * 的长注释）。新架构把主导航搬到侧栏（`docs/ui-architecture.md` §2.2 第 1 条），
 * 于是这一条只剩四样东西：
 *
 * ```
 * [折叠侧栏] [面包屑] ……… [搜索 Ctrl+K] [助手 Ctrl+/] [窗口按钮]
 * ```
 *
 * 品牌在侧栏顶部，与这一条同高，两截拼起来还是一条 48px 的标题栏。
 *
 * ## 拖拽区怎么划（**这条踩过，改动时必须重测**）
 *
 * 规则一句话：**整条都能拖窗口，只有真正能点的元素才收回点击权**。
 *
 * 坑在"抠洞"是按**元素盒子**算的：谁盖住了标题栏，谁的地盘就不是拖拽区。
 * 旧版曾经把菜单容器整条标成 `no-drag` 并 `flex: 1` 铺满剩余宽度，结果
 * 900px 宽的窗口只剩十几像素能拖——用户按在"明显是空白"的地方根本拖不动。
 *
 * 所以现在是反过来标：面包屑容器、右侧按钮组之间的**空白**都保持 `drag`，
 * 只把按钮与面包屑链接标 `no-drag`。这里右侧按钮组用 `gap` 留白而不是
 * 一个铺满的容器，就是让"按钮之间"仍然是可拖的。
 *
 * ## 两种属性名都写
 *
 * `-webkit-app-region` 与无前缀的 `app-region` 在 Chromium 里是同一个属性的两个名字，
 * 但**认不出的声明会被 CSS 解析器直接丢掉**，所以两条都写上。
 *
 * ## 面包屑只在深层页显示
 *
 * `docs/ui-architecture.md` §2.3 第 16 条：面包屑**补充而非替代**全局导航，
 * 且"1–2 层的扁平结构不需要面包屑"。所以这一层只在路径深度 ≥ 2 时渲染它，
 * 顶层页不浪费一条横条。
 */

import { computed } from "vue";

import AppBreadcrumb from "./AppBreadcrumb.vue";
import AppIcon from "./AppIcon.vue";
import AppWindowControls from "./AppWindowControls.vue";
import { useRoute } from "../plugin";
import { useShellStore } from "../store/shell.store";

interface Props {
    /** 侧栏是否折叠，用来决定折叠按钮的图标 */
    collapsed: boolean;
}

const props = withDefaults(defineProps<Props>(), {});

const route = useRoute();
const shell = useShellStore();

/**
 * 是否显示面包屑。
 *
 * 按 `matched` 里带标题的层数算，而不是按 URL 段数：`/calendar/synodic/data`
 * 有三段 URL，但 `matched` 是「外壳 → 历法 → 历法工作区」，只有两层有标题，
 * 面包屑只会显示"历法 / 朔望历"——那是有用的；顶层的 `/data/browse` 同理。
 */
const showBreadcrumb = computed(
    () => route.matched.filter((record) => Boolean(record.meta?.title)).length >= 2
);
</script>

<template>
    <header class="app-topbar">
        <!--
            折叠按钮：`no-drag`（它要点）。图标随状态换：展开时给"收起"，
            收起时给"展开"——图标说的是"点了会变成什么"，不是"现在是什么"。
        -->
        <ElTooltip :content="props.collapsed ? '展开侧栏（Ctrl+B）' : '收起侧栏（Ctrl+B）'" placement="bottom">
            <ElButton class="app-topbar__button" text @click="shell.toggleSidebar()">
                <AppIcon :name="props.collapsed ? 'Expand' : 'Fold'" />
            </ElButton>
        </ElTooltip>

        <div v-if="showBreadcrumb" class="app-topbar__crumbs">
            <AppBreadcrumb />
        </div>

        <!-- 这一块是"弹簧"：它把右侧按钮组推到最右，同时自己整块可拖 -->
        <div class="app-topbar__spring" />

        <ElTooltip content="搜索与跳转（Ctrl+K）" placement="bottom">
            <ElButton class="app-topbar__button" text @click="shell.openPalette()">
                <AppIcon name="Search" />
                <span class="app-topbar__hint">Ctrl+K</span>
            </ElButton>
        </ElTooltip>

        <ElTooltip content="助手（Ctrl+/）" placement="bottom">
            <ElButton class="app-topbar__button" text @click="shell.openAssistant()">
                <AppIcon name="MagicStick" />
                <span class="app-topbar__hint">Ctrl+/</span>
            </ElButton>
        </ElTooltip>

        <AppWindowControls />
    </header>
</template>

<style scoped>
.app-topbar {
    /*
     * 整条可拖拽：只有真正能点的元素才在下面标回 `no-drag`
     * （折叠按钮、面包屑链接、右侧按钮、三颗窗口按钮）。
     */
    -webkit-app-region: drag;
    app-region: drag;
    align-items: center;
    background: var(--el-bg-color);
    box-shadow: inset 0 -1px 0 var(--el-border-color);
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    height: 48px;
    padding-left: 8px;
    padding-right: 0;
    /* 标题栏里的文字不该被选中（拖拽时会出现蓝色选区） */
    user-select: none;
}

/* "弹簧"：撑开剩余宽度，自己也能拖 */
.app-topbar__spring {
    flex: 1 1 auto;
    height: 100%;
}

.app-topbar__button {
    -webkit-app-region: no-drag;
    app-region: no-drag;
    align-items: center;
    display: inline-flex;
    flex-shrink: 0;
    gap: 4px;
    height: 30px;
    padding: 0 8px;
}

.app-topbar__hint {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}

.app-topbar__crumbs {
    -webkit-app-region: drag;
    app-region: drag;
    align-items: center;
    display: flex;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
}

/* 面包屑里的链接要点，收回点击权 */
.app-topbar__crumbs :deep(a) {
    -webkit-app-region: no-drag;
    app-region: no-drag;
}
</style>
