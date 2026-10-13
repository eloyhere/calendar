<script setup lang="ts">
/**
 * 顶栏（48px）：面包屑 + 搜索 + 助手 + 窗口按钮。
 *
 * ## 为什么面包屑在这里，而不是"当前页胶囊"
 *
 * 旧版顶栏放的是"当前是哪一页"的胶囊——那是**位置**。面包屑给的是**路径**：
 * `历法 / 轩辕历`。分了两栏导航之后，"我在哪一层"比"我在哪一页"更重要，
 * 因为用户可能刚刚折叠了面板。
 *
 * ## 搜索框是按钮，不是输入框
 *
 * 顶栏里放真输入框会抢走 `Ctrl+K` 的位置感，而且它永远只有一半宽、打不全命令名。
 * 这里放一个长得像输入框的按钮，点了打开命令面板——面板里有模糊匹配、分组与
 * 键盘操作，功能是输入框的超集。
 *
 * ## 品牌名只在工作台显示
 *
 * 窗口标题里已经有"轩辕历法"了（`AppShell` 写 `document.title`）。顶栏再写一遍
 * 就是同一句话在一屏里出现两次，而顶栏的每个像素都该用来给内容。
 * 唯一例外是工作台——那是"首页"，识别感有价值。
 */

import { computed } from "vue";

import { useRoute, useRouter } from "../../plugin";
import { useShellStore } from "../../store/shell.store";
import type { Domain } from "../../entity/domain";
import AppIcon from "../AppIcon.vue";
import AppWindowControls from "../AppWindowControls.vue";

interface Props {
    /** 当前域（面包屑第一段） */
    domain: Domain;
    /** 当前页标题（面包屑第二段）；为空时只画一段 */
    pageTitle: string;
}

const props = defineProps<Props>();

const route = useRoute();
const router = useRouter();
const shell = useShellStore();

/** 是不是工作台。它显示品牌名而不是面包屑。 */
const atHome = computed(() => route.path === "/");

/** 品牌名。窗口标题与这里共用同一个字符串。 */
const brand = "轩辕历法";

const back = (): void => {
    // `back()` 在直接打开应用（没有历史）时什么都不做，此时退回工作台
    if (window.history.length <= 1) {
        void router.push("/");
        return;
    }
    router.back();
};
</script>

<template>
    <header class="topbar">
        <!-- 折叠面板。`Ctrl+B` 是它的键盘入口 -->
        <ElTooltip :content="shell.collapsed ? '展开导航（Ctrl+B）' : '收起导航（Ctrl+B）'" placement="bottom" :show-after="400">
            <button
                type="button"
                class="topbar__icon-button"
                :aria-label="shell.collapsed ? '展开导航' : '收起导航'"
                :aria-expanded="!shell.collapsed"
                @click="shell.toggleSidebar()">
                <AppIcon :name="shell.collapsed ? 'Expand' : 'Fold'" :size="16" />
            </button>
        </ElTooltip>

        <button type="button" class="topbar__icon-button" aria-label="后退" @click="back">
            <AppIcon name="Back" :size="16" />
        </button>

        <!-- 品牌（仅工作台）或面包屑 -->
        <div v-if="atHome" class="topbar__brand">
            <span class="topbar__brand-name">{{ brand }}</span>
            <span class="topbar__brand-sub numeral">建元 -2696-03-11 01:45:49</span>
        </div>

        <nav v-else class="topbar__crumbs" aria-label="面包屑">
            <span class="topbar__crumb">{{ props.domain.label }}</span>
            <template v-if="props.pageTitle.length > 0">
                <AppIcon name="ArrowRight" :size="12" class="topbar__crumb-sep" />
                <span class="topbar__crumb is-current">{{ props.pageTitle }}</span>
            </template>
        </nav>

        <!--
            命令面板入口。长得像输入框但其实是按钮：真输入框在顶栏里
            永远只有一半宽、打不全命令名，而面板有模糊匹配与分组。
        -->
        <button type="button" class="topbar__search" @click="shell.openPalette()">
            <AppIcon name="Search" :size="14" />
            <span class="topbar__search-text">搜索页面、表、事件…</span>
            <kbd class="topbar__kbd numeral">Ctrl K</kbd>
        </button>

        <div class="topbar__tail">
            <ElTooltip content="助手（Ctrl+/）" placement="bottom" :show-after="400">
                <button
                    type="button"
                    class="topbar__icon-button"
                    aria-label="打开助手"
                    @click="shell.toggleAssistant()">
                    <AppIcon name="MagicStick" :size="16" />
                </button>
            </ElTooltip>

            <AppWindowControls />
        </div>
    </header>
</template>

<style scoped>
.topbar {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 6px;
    height: var(--xy-topbar-height);
    padding: 0 8px 0 10px;
    /*
     * 整条顶栏是拖拽区（无边框窗口靠自己拖）。按钮必须显式 `no-drag`，
     * 否则点不动——这个坑在 `AppWindowControls` 里也记了一遍。
     */
    -webkit-app-region: drag;
}

.topbar button,
.topbar__search,
.topbar__kbd {
    -webkit-app-region: no-drag;
}

.topbar__icon-button {
    align-items: center;
    background: transparent;
    border: none;
    border-radius: var(--xy-radius-md);
    color: var(--el-text-color-regular);
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    height: 30px;
    justify-content: center;
    padding: 0;
    transition: background var(--xy-duration-fast) var(--xy-ease);
    width: 30px;
}

.topbar__icon-button:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
}

.topbar__brand {
    align-items: baseline;
    display: flex;
    gap: 8px;
    margin-left: 4px;
    min-width: 0;
}

.topbar__brand-name {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-md);
    font-weight: var(--xy-weight-semibold);
    letter-spacing: 0.02em;
}

.topbar__brand-sub {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
}

.topbar__crumbs {
    align-items: center;
    display: flex;
    gap: 6px;
    margin-left: 4px;
    min-width: 0;
}

.topbar__crumb {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.topbar__crumb.is-current {
    color: var(--el-text-color-primary);
    font-weight: var(--xy-weight-medium);
}

.topbar__crumb-sep {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
}

/* 中段留白，搜索框居中偏右——视线扫完左侧标题之后自然落到它身上 */
.topbar__search {
    align-items: center;
    background: var(--el-fill-color-light);
    border: 1px solid transparent;
    border-radius: var(--xy-radius-md);
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    display: flex;
    flex: 1;
    gap: 6px;
    height: 30px;
    margin: 0 8px;
    max-width: 420px;
    min-width: 120px;
    padding: 0 8px;
    transition:
        background var(--xy-duration-fast) var(--xy-ease),
        border-color var(--xy-duration-fast) var(--xy-ease);
}

.topbar__search:hover {
    background: var(--el-fill-color);
    border-color: var(--el-border-color);
}

.topbar__search-text {
    flex: 1;
    font-size: var(--xy-font-sm);
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.topbar__kbd {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-sm);
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-family: var(--xy-font-ui);
    font-size: var(--xy-font-2xs);
    padding: 1px 5px;
}

.topbar__tail {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    margin-left: auto;
}
</style>
