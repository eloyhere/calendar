<script setup lang="ts">
/**
 * 页头：品牌 + 横向菜单。
 *
 * ## 为什么只铺两层
 *
 * 本项目的菜单是三层（域 → 历法实体 → 简介/日历/数据）。`ElMenu` 的
 * `mode="horizontal"` 只把第一层铺在菜单条上、第二层放进下拉弹层，第三层在
 * 弹层里已经没有可读的层级了。
 *
 * 所以这里渲染策略是：
 *
 * - **一级**（概览 / 智能体 / 历法 / 命理 / 年 / 性能）留在菜单条上；
 * - **二级**（九个历法、六个聊天模式、排盘页面……）进下拉，每一项都可点，
 *   点了进它自己的默认页（`redirect` 指向的子页）；
 * - **三级**不再挂进菜单——它由进页面之后的面包屑与页面内的 `ElTabs`/页头承担。
 *
 * 这样菜单条恒定一行高，不需要 `ellipsis` 折叠，也不会横向滚动。
 *
 * ## 配色
 *
 * 一律用 Element Plus 的默认浅色变量（`--el-*`），不写死颜色。横向菜单默认
 * 就是白底 + `--el-color-primary` 高亮，无需额外覆盖。
 */

import type { MenuNode } from "../plugin";

interface Props {
    /** 菜单树，来自 `createMenuTree()` */
    items: readonly MenuNode[];
    /** 当前高亮的路径 */
    activePath: string;
    /** 品牌名 */
    brand?: string;
}

const props = withDefaults(defineProps<Props>(), { brand: "日历" });

const emit = defineEmits<{
    /** 用户点了菜单项 */
    select: [path: string];
}>();
</script>

<template>
    <header class="app-header">
        <div class="app-header__brand">
            <ElIcon :size="20" class="app-header__logo"><Calendar /></ElIcon>
            <ElText tag="strong" class="app-header__title">{{ props.brand }}</ElText>
        </div>

        <ElMenu
            :default-active="props.activePath"
            mode="horizontal"
            :ellipsis="false"
            router
            class="app-header__menu">
            <template v-for="group in props.items" :key="group.title">
                <!-- 一级：有子节点的域，渲染成下拉 -->
                <ElSubMenu
                    v-if="group.children.length > 0"
                    :index="`group:${group.title}`"
                    popper-class="app-header__popper">
                    <template #title>
                        <AppIcon v-if="group.icon" :name="group.icon" />
                        <span class="app-header__label">{{ group.title }}</span>
                    </template>

                    <!-- 二级：叶子直接跳转；带子节点的分组也渲染成可点项（走 redirect） -->
                    <ElMenuItem
                        v-for="child in group.children"
                        :key="child.path ?? child.title"
                        :index="child.path ?? child.title"
                        @click="emit('select', child.path ?? '')">
                        <AppIcon v-if="child.icon" :name="child.icon" />
                        <template #title>
                            <span class="app-header__label">{{ child.title }}</span>
                        </template>
                    </ElMenuItem>
                </ElSubMenu>

                <!-- 一级：没有子节点的（概览）直接跳转 -->
                <ElMenuItem
                    v-else
                    :index="group.path ?? group.title"
                    @click="emit('select', group.path ?? '')">
                    <AppIcon v-if="group.icon" :name="group.icon" />
                    <template #title>
                        <span class="app-header__label">{{ group.title }}</span>
                    </template>
                </ElMenuItem>
            </template>
        </ElMenu>
    </header>
</template>

<style scoped>
.app-header {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color);
    display: flex;
    gap: 24px;
    height: 60px;
    padding: 0 20px;
}

.app-header__brand {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.app-header__logo {
    color: var(--el-color-primary);
}

.app-header__title {
    font-size: 16px;
}

.app-header__menu {
    border-bottom: none;
    flex: 1;
    min-width: 0;
}

.app-header__label {
    margin-left: 4px;
}

/* 下拉弹层里的图标与文字对齐 */
.app-header__popper :deep(.el-menu-item) {
    display: flex;
    gap: 6px;
}
</style>
