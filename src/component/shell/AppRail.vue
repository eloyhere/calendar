<script setup lang="ts">
/**
 * 第一列：**最外层的 `ElMenu`**（九个域），由一个方形品牌按钮控制展开 / 收起。
 *
 * ## 结构
 *
 * ```
 * ┌────────┬──────────────┬────────────────────┐
 * │ [▲]    │ 历法          │                    │
 * │ 工作台  │  轩辕历        │      内容           │
 * │ 智能体  │  朔望历        │                    │
 * │ 历法    │  …            │                    │
 * └────────┴──────────────┴────────────────────┘
 *  外层 ElMenu   子层 ElMenu
 * ```
 *
 * ## 左上角那个方块
 *
 * 它是**品牌图标 + 展开/收起按钮**两件事合成的一个目标：
 *
 * - 只放图标不做按钮，用户会以为那是装饰，于是去找菜单栏里的折叠项；
 * - 只做按钮不放图标，窗口左上角就空着一块，而那是全窗口视线起点
 *   （左上角是"从哪开始读"的锚点，空着会显得没做完）。
 *
 * 40×40 的方形，远大于 WCAG 2.5.8 的 24×24；`aria-expanded` 让读屏软件
 * 播报当前是展开还是收起；`Ctrl+B` 是同一条动作的键盘入口。
 *
 * ## 为什么展开态也保留图标
 *
 * 收起时只有图标（64px），展开时图标 + 文字（208px）。两种形态都是 `ElMenu`
 * 自己的 `collapse` 行为，不是两套实现——所以过渡、hover、选中态、键盘导航
 * 在两种形态下完全一致。自绘一列 `<button>` 也能画出这个样子，
 * 但拿不到 `ElMenu` 内建的宽度与文字过渡，切换时会硬跳。
 */

import { computed } from "vue";

import type { DomainId } from "../../entity/domain";
import { DOMAINS } from "../../entity/domain";
import { useShellStore } from "../../store/shell.store";
import AppBrandIcon from "../AppBrandIcon.vue";
import AppIcon from "../AppIcon.vue";

interface Props {
    /** 当前所在的域 */
    active: DomainId;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 用户点了某个域 */
    pick: [id: DomainId];
}>();

const shell = useShellStore();

const activeIndex = computed(() => props.active);

const go = (index: string): void => {
    emit("pick", index as DomainId);
};
</script>

<template>
    <nav class="rail" :class="{ 'is-collapsed': shell.collapsed }">
        <!--
            左上角的方块：品牌图标，同时是展开 / 收起按钮。
            它与顶栏同高（48px），所以和右边的面包屑在一条水平线上。
        -->
        <div class="rail__top">
            <ElTooltip
                :content="shell.collapsed ? '展开导航（Ctrl+B）' : '收起导航（Ctrl+B）'"
                placement="right"
                :show-after="260"
                :offset="8">
                <button
                    type="button"
                    class="rail__brand"
                    :aria-expanded="!shell.collapsed"
                    :aria-label="shell.collapsed ? '展开导航' : '收起导航'"
                    @click="shell.toggleSidebar()">
                    <AppBrandIcon :size="22" />
                </button>
            </ElTooltip>
        </div>

        <ElScrollbar class="rail__scroll">
            <ElMenu
                :default-active="activeIndex"
                mode="vertical"
                :collapse="shell.collapsed"
                :collapse-transition="false"
                :unique-opened="false"
                class="rail__menu"
                @select="go">
                <ElMenuItem v-for="domain in DOMAINS" :key="domain.id" :index="domain.id">
                    <AppIcon :name="domain.icon" :size="18" />
                    <template #title>
                        <span class="rail__label">{{ domain.label }}</span>
                    </template>
                </ElMenuItem>
            </ElMenu>
        </ElScrollbar>
    </nav>
</template>

<style scoped>
.rail {
    background: var(--el-bg-color);
    border-right: 1px solid var(--xy-hairline);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    /* 展开 208 / 收起 64。与 `ElMenu` 自己的宽度过渡同时长，才不会一先一后 */
    transition: width var(--xy-duration-base) var(--xy-ease);
    width: 208px;
}

.rail.is-collapsed {
    width: var(--el-menu-collapse-width, 64px);
}

/*
 * 方块所在的一行：与顶栏同高，底部一条分隔线与顶栏的下边框接得上。
 *
 * 收起时方块居中于 64px 宽，展开时靠左 8px 起——两种形态下它都在
 * "左上角"这个位置，不会因为展开而漂到中间。
 */
.rail__top {
    align-items: center;
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    height: var(--xy-topbar-height);
    padding: 0 12px;
    -webkit-app-region: drag;
}

.rail.is-collapsed .rail__top {
    justify-content: center;
    padding: 0;
}

/*
 * 品牌方块。40×40 正方形，圆角与菜单项一致，所以它看起来是"菜单里的第一项"
 * 而不是一个外来按钮。`no-drag` 不能省——它在一个拖拽区里，
 * 不标就点不动（只会开始拖窗口）。
 */
.rail__brand {
    align-items: center;
    background: transparent;
    border: none;
    border-radius: var(--xy-radius-md);
    color: var(--el-color-primary);
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    height: 40px;
    justify-content: center;
    padding: 0;
    transition: background var(--xy-duration-fast) var(--xy-ease);
    width: 40px;
    -webkit-app-region: no-drag;
}

.rail__brand:hover {
    background: var(--el-fill-color-light);
}

.rail__brand:active {
    background: var(--el-fill-color);
}

.rail__scroll {
    flex: 1;
    min-height: 0;
}

/*
 * `ElMenu` 自带右边框（外框由 `.rail` 画）与自己的宽度，这里让它铺满。
 *
 * 项高 46px：收起态下这是图标的点击区，展开态下是"图标 + 文字"的行高。
 * 九个域在 826px 的可用高度里刚好放得下且不用滚；46px 也远超
 * WCAG 2.5.8 的 24×24。
 */
.rail__menu {
    --el-menu-item-height: 46px;
    --el-menu-base-level-padding: 15px;
    --el-menu-collapse-width: 64px;
    border-right: none;
    padding-top: 6px;
    width: 100%;
}

/* 收起态的项：图标居中。`ElMenu` 默认会居中，这里只是把内边距清掉更稳 */
.rail__menu :deep(.el-menu-item.is-collapse-active),
.rail__menu :deep(.el-menu--collapse .el-menu-item) {
    justify-content: center;
    padding: 0 !important;
}

/* 选中态的左侧竖条：形状通道，与颜色通道并存（WCAG 1.4.1） */
.rail__menu :deep(.el-menu-item) {
    position: relative;
}

.rail__menu :deep(.el-menu-item.is-active)::before {
    background: var(--el-color-primary);
    border-radius: 0 2px 2px 0;
    content: "";
    height: 22px;
    left: 0;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
}

.rail__label {
    margin-left: 8px;
}
</style>
