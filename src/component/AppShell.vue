<script setup lang="ts">
/**
 * 应用外壳：横向页头 + 内容区 + 页脚。
 *
 * ```
 * ElContainer direction=vertical     height:100vh
 * ├─ AppHeader（ElHeader）            品牌 + 横向菜单
 * ├─ ElMain                          overflow:auto，<RouterView/> 落在这里
 * └─ ElFooter                        数据规模 / 构建信息
 * ```
 *
 * 布局与菜单是两件事：菜单内容来自路由表（`plugin/menu.ts` 推导），
 * 本文件只把它交给 `AppHeader` 并传当前路径用于高亮。
 */

import { computed, watch } from "vue";
import { useRoute } from "../plugin";
import { createMenuTree } from "../plugin";
import AppFooter from "./AppFooter.vue";
import AppHeader from "./AppHeader.vue";

const route = useRoute();

/** 菜单树由路由表推导；`routes` 是模块常量，算一次即可。 */
const menuItems = createMenuTree();

/**
 * 菜单高亮项：直接用当前路径。
 *
 * 不要用 `route.matched[0].path`——外壳挂在 `/` 上，那个值永远是 `/`，
 * 高亮会整片失效（这个坑踩过）。
 */
const activePath = computed(() => route.path);

/** 页面标题：`meta.title` + 应用名，写到窗口标题栏。 */
watch(
    () => route.meta.title,
    (title) => {
        document.title = title ? `${title} · 日历` : "日历";
    },
    { immediate: true }
);
</script>

<template>
    <ElContainer direction="vertical" class="app-shell">
        <ElHeader class="app-shell__header">
            <AppHeader :items="menuItems" :active-path="activePath" />
        </ElHeader>

        <ElMain class="app-shell__main">
            <RouterView />
        </ElMain>

        <ElFooter class="app-shell__footer">
            <AppFooter />
        </ElFooter>
    </ElContainer>
</template>

<style scoped>
.app-shell {
    height: 100vh;
    overflow: hidden;
}

/* AppHeader 自带内边距与底边，ElHeader 只负责"这一条是页头" */
.app-shell__header {
    height: auto;
    padding: 0;
}

.app-shell__main {
    background: var(--el-fill-color-light);
    overflow: auto;
    padding: 16px 20px;
}

.app-shell__footer {
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);
    height: auto;
    padding: 8px 20px;
}
</style>
