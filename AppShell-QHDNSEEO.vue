<script setup lang="ts">
/**
 * 应用外壳：满高 `ElContainer`，左侧栏 + 右（页头 / 内容 / 页脚）。
 *
 * ## 与上一版的差别
 *
 * 上一版把菜单放在 `<ElHeader>` 里、`<ElMain>` 里直接放 `<RouterView/>`，
 * 于是：横向菜单放不下、没有面包屑、也没有"内容区自己滚"的落点。
 * 现在的层次是：
 *
 * ```
 * ElContainer                       height:100vh
 * ├─ AppAside（ElAside）             侧栏，自己滚
 * └─ ElContainer direction=vertical
 *    ├─ ElHeader                     面包屑 + 全局操作
 *    ├─ ElMain                       overflow:auto，RouterView 落在这里
 *    └─ ElFooter                     数据规模 / 构建信息
 * ```
 *
 * ## 缓存
 *
 * 内容区的 `<RouterView>` 外面套 `<KeepAlive>`：历表页面切来切去最贵的是
 * 重新查库与重建表格，`meta.keepAlive` 默认开启，占位页也不例外——等真正接上
 * 数据以后，用户从"日历"切到"数据"再切回来不该重新加载。需要每次重建的页面
 * （表单类）在路由 `meta` 里写 `keepAlive: false`。
 *
 * `:key` 取路由名而不是路径：同一个组件被不同路径复用时要区分，
 * 而组件级缓存应当以"哪个页面"为单位。
 */

import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "../plugin";
import { findActivePath, createMenuTree } from "../plugin";
import AppAside from "./AppAside.vue";
import AppBreadcrumb from "./AppBreadcrumb.vue";
import AppFooter from "./AppFooter.vue";

/** 侧栏折叠状态；后续接 `localStorage` 时只改这里。 */
const collapsed = ref(false);

const route = useRoute();
const router = useRouter();

/** 菜单树，用于把"当前路径"折算成"该高亮哪一项"。 */
const menuItems = createMenuTree();

/** 当前高亮的菜单路径；分组页高亮它的第一个可点后代。 */
const activePath = computed(() => findActivePath(menuItems, route.path) ?? route.path);

/** 内容区是否需要缓存。 */
const keepAlive = computed(() => route.meta.keepAlive !== false);

/** 页面标题：`meta.title` + 应用名，写到窗口标题栏。 */
watch(
    () => route.meta.title,
    (title) => {
        document.title = title ? `${title} · 日历` : "日历";
    },
    { immediate: true }
);

/** 折叠侧栏。 */
function toggleCollapse(): void {
    collapsed.value = !collapsed.value;
}

/** 重新加载当前页面：替换同一条路由会重新挂载组件（配合 `:key`）。 */
function reload(): void {
    const name = route.name;
    if (typeof name === "string") {
        void router.replace({ name, query: { ...route.query, reload: Date.now() } });
    }
}

/** 全屏切换。 */
function toggleFullscreen(): void {
    if (document.fullscreenElement) {
        void document.exitFullscreen();
    } else {
        void document.documentElement.requestFullscreen();
    }
}
</script>

<template>
    <ElContainer class="app-shell">
        <AppAside
            :active-path="activePath"
            :collapse="collapsed"
            @toggle-collapse="toggleCollapse" />

        <ElContainer direction="vertical" class="app-shell__right">
            <ElHeader class="app-shell__header">
                <AppBreadcrumb />

                <ElSpace class="app-shell__actions" :size="4">
                    <ElTooltip content="重新加载当前页面" placement="bottom">
                        <ElButton text circle aria-label="重新加载" @click="reload">
                            <ElIcon><Refresh /></ElIcon>
                        </ElButton>
                    </ElTooltip>
                    <ElTooltip content="全屏切换" placement="bottom">
                        <ElButton text circle aria-label="全屏切换" @click="toggleFullscreen">
                            <ElIcon><FullScreen /></ElIcon>
                        </ElButton>
                    </ElTooltip>
                </ElSpace>
            </ElHeader>

            <ElMain class="app-shell__main">
                <!--
                    两种渲染路径，条件互斥，所以组件只会被挂载一次：
                    需要缓存的走 KeepAlive，不需要的直接渲染。
                    `:key` 取路由名：同一个组件被不同路径复用时也要各自成页。
                -->
                <RouterView v-slot="{ Component }">
                    <KeepAlive v-if="keepAlive" :max="12">
                        <component :is="Component" :key="String(route.name)" />
                    </KeepAlive>
                    <component :is="Component" v-else :key="String(route.name)" />
                </RouterView>
            </ElMain>

            <ElFooter class="app-shell__footer">
                <AppFooter />
            </ElFooter>
        </ElContainer>
    </ElContainer>
</template>

<style scoped>
.app-shell {
    height: 100vh;
    overflow: hidden;
}

.app-shell__right {
    min-width: 0;
}

.app-shell__header {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    height: 60px;
    justify-content: space-between;
    padding: 0 20px;
}

.app-shell__actions {
    flex-shrink: 0;
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
