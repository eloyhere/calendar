<script setup lang="ts">
/**
 * 应用外壳：侧栏 + 顶栏 + 内容区 + 状态栏，以及两个全局覆盖物。
 *
 * ```
 * .app-shell                                  height:100vh, 横向 flex
 * ├─ AppSidebar                     220/48px  品牌 + 分区菜单 + 助手入口
 * └─ .app-shell__column             flex:1
 *    ├─ AppTopbar                    48px     折叠 / 面包屑 / 搜索 / 助手 / 窗口按钮
 *    ├─ ElMain                       flex:1   <RouterView/> 落在这里，自己不滚
 *    └─ AppStatusBar                 28px     规模 / 视点 / 助手状态
 * ```
 *
 * 两个覆盖物挂在最外层，**不属于任何一栏**：
 *
 * - `AssistantDrawer`：右侧 420px 抽屉，`Ctrl+/` 唤起；
 * - `CommandPalette`：居中模态，`Ctrl+K` 唤起。
 *
 * ## 内容区是弹性宿主，自己不滚
 *
 * `ElMain` 只做一件事：**把剩余高度交给页面**。所以它 `display: flex` +
 * `overflow: hidden`，并且不带内边距。页面（`PageShell`）拿到这段高度后自己安排：
 * 普通页面把内容放进 `ElScrollbar` 在卡片内部滚，对话页那种整屏三栏则各自滚。
 *
 * 于是**窗口永远不出现滚动条，滚动只发生在页面内部**，顶栏与状态栏在任何页面里
 * 都是固定的。内边距也下放给页面——留在这里的话，滚动条会悬在一圈内边距中间，
 * 而不是贴着卡片边缘。
 *
 * ## 沉浸布局
 *
 * 工作流编排器需要尽可能大的画布，所以它有 `meta.chrome === "immersive"`：
 * 不渲染侧栏与状态栏，内容区全宽。判断放在这里而不是让编排器自己写一个外壳，
 * 是为了让"哪些页面没有侧栏"这件事在**一个地方**能看完。
 *
 * ## 窗口标题
 *
 * `document.title` 由 `meta.title` 写。参数化路由（历法工作区、编排器）的标题
 * 要等数据到了才知道，那时由页面自己再写一次——所以这里只在 `meta.title`
 * 存在且**没有** `titleFrom` 时写，避免把页面刚写好的标题覆盖成"历法工作区"。
 */

import { computed, onMounted, onUnmounted, watch } from "vue";

import { useRoute, useRouter } from "../plugin";
import { createMenuTree, flattenMenu } from "../plugin";
import { useShellStore } from "../store/shell.store";
import AppSidebar from "./AppSidebar.vue";
import AppStatusBar from "./AppStatusBar.vue";
import AppTopbar from "./AppTopbar.vue";
import AssistantDrawer from "./overlay/AssistantDrawer.vue";
import CommandPalette from "./overlay/CommandPalette.vue";

const route = useRoute();
const router = useRouter();
const shell = useShellStore();

/**
 * 本应用的名称。窗口标题与品牌共用它，避免两处各写一遍。
 */
const Brand = "轩辕历法";

/** 是否渲染侧栏与状态栏。 */
const immersive = computed(() => route.meta.chrome === "immersive");

/**
 * 菜单高亮项：直接用当前路径。
 *
 * 不要用 `route.matched[0].path`——外壳挂在 `/` 上，那个值永远是 `/`，
 * 高亮会整片失效（这个坑踩过，见 `plugin/README.md`）。
 */
const activePath = computed(() => route.path);

/**
 * 命令面板的跳转候选。
 *
 * `flattenMenu` 把菜单树拍平成"标题 → 路径"，这是"任意页直达任意页"的底座；
 * 面板再叠一层按标题与说明的模糊匹配。
 */
const paletteItems = computed(() => flattenMenu(createMenuTree()));

/* -------------------------------------------------------------------------- */
/* 键盘                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 全局快捷键。
 *
 * | 组合             | 动作        | 依据                                              |
 * | ---------------- | ----------- | ------------------------------------------------- |
 * | `Ctrl/Cmd + K`   | 命令面板    | 本项目自定（§2.3 第 20 条：没有可核验的权威规范） |
 * | `Ctrl/Cmd + /`   | 助手抽屉    | HAX **G7** 高效唤起                               |
 * | `Ctrl/Cmd + B`   | 折叠侧栏    | HAX **G8** 高效关闭                               |
 * | `Escape`         | 关覆盖物    | HAX **G8**；WCAG 2.1.2 无键盘陷阱                 |
 *
 * `Escape` 的处理顺序：**先关覆盖物，再让页面处理**。所以这里只在覆盖物开着时
 * 拦下事件；没开时不 `preventDefault`，页面自己的 `Esc`（停止生成）照常工作。
 */
const onKeydown = (event: KeyboardEvent): void => {
    const modified = event.ctrlKey || event.metaKey;

    if (modified && event.key.toLowerCase() === "k") {
        event.preventDefault();
        shell.togglePalette();
        return;
    }
    if (modified && event.key === "/") {
        event.preventDefault();
        shell.toggleAssistant();
        return;
    }
    if (modified && event.key.toLowerCase() === "b") {
        event.preventDefault();
        shell.toggleSidebar();
        return;
    }
    if (event.key === "Escape") {
        if (shell.paletteOpen) {
            event.preventDefault();
            shell.closePalette();
            return;
        }
        if (shell.assistantOpen) {
            event.preventDefault();
            shell.closeAssistant();
        }
    }
};

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

/* -------------------------------------------------------------------------- */
/* 窗口标题                                                                    */
/* -------------------------------------------------------------------------- */

watch(
    () => [route.meta.title, route.meta.titleFrom] as const,
    ([title, titleFrom]) => {
        // 参数化路由的标题由页面写（它才知道 `:system` 是哪套历法）
        if (typeof title === "string" && title.length > 0 && titleFrom === undefined) {
            document.title = `${title} · ${Brand}`;
            return;
        }
        if (route.path === "/") {
            document.title = Brand;
        }
    },
    { immediate: true }
);
</script>

<template>
    <div class="app-shell">
        <AppSidebar v-if="!immersive" :collapsed="shell.collapsed" :active-path="activePath" />

        <div class="app-shell__column">
            <AppTopbar :collapsed="shell.collapsed" />

            <ElMain class="app-shell__main">
                <RouterView v-slot="{ Component }">
                    <!--
                        `:key` 用路径，否则 `/calendar/synodic/data` 与
                        `/calendar/gregory/data` 会共用同一个组件实例，切体系时
                        数据不刷新（两个路径匹配的是同一条参数化路由）。

                        这里**不套 `KeepAlive`**：路由表的 `meta.keepAlive` 已经
                        声明了"哪些页面要保留状态"，但缓存一个整页组件会让
                        "换体系时数据不刷新"变成"换体系时连旧数据都留着"——
                        那比不缓存更糟。需要保留的是**页内切换器的筛选状态**，
                        它由各页面自己的 store 持有（如 `shell.store`），
                        不靠组件缓存。
                    -->
                    <component :is="Component" :key="route.path" />
                </RouterView>
            </ElMain>

            <AppStatusBar v-if="!immersive" />
        </div>

        <!-- 覆盖物：不属于任何一栏，铺在外壳之上 -->
        <AssistantDrawer />
        <CommandPalette :items="paletteItems" @go="(path: string) => router.push(path)" />
    </div>
</template>

<style scoped>
.app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
}

.app-shell__column {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}

/*
 * 弹性宿主：不滚、不带内边距，只把剩余高度交给页面（见文件头的说明）。
 * `min-height: 0` 不能省——少了它，子元素内容一长就会把这一块顶高，
 * `flex: 1` 会被内容撑破，状态栏被挤出窗口。
 */
.app-shell__main {
    background: var(--el-fill-color-light);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 0;
}
</style>
