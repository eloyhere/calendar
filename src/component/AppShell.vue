<script setup lang="ts">
/**
 * 应用外壳：窄栏 + 二级面板 + 顶栏 + 内容区 + 状态栏，以及两个全局覆盖物。
 *
 * ```
 * .shell                                       height:100vh, 横向 flex
 * ├─ AppRail                            56px   九个域的图标（一级导航）
 * ├─ AppDomainPanel                 240/0px    当前域的页面列表（二级导航）
 * └─ .shell__column                    flex:1
 *    ├─ AppTopbar                       48px   折叠 / 面包屑 / 搜索 / 助手 / 窗口按钮
 *    ├─ ElMain                          flex:1  <RouterView/> 落在这里，自己不滚
 *    └─ AppStatusBar                    26px   规模 / 视点 / 助手状态
 * ```
 *
 * 两个覆盖物挂在最外层，**不属于任何一栏**：
 * `AssistantDrawer`（右侧 420px 抽屉，`Ctrl+/`）与 `CommandPalette`（居中模态，`Ctrl+K`）。
 *
 * ## 内容区是弹性宿主，自己不滚
 *
 * `ElMain` 只做一件事：**把剩余高度交给页面**。所以它 `display: flex` +
 * `overflow: hidden`，并且不带内边距。页面（`PageShell`）拿到这段高度后自己安排。
 * 于是**窗口永远不出现滚动条，滚动只发生在页面内部**，顶栏与状态栏在任何页面里
 * 都是固定的。
 *
 * ## 当前域从路径推
 *
 * `locate(route.path)` 给出当前落在哪个域。**不是**从 `route.meta.domain` 推：
 * 那条路要求每条路由都写对 `domain`，而写错了不会报错，只表现为"窄栏高亮错了"。
 * `locate` 靠的是 `entity/domain.ts` 的登记表，那张表在启动时已经被
 * `verifyDomainRoutes()` 校验过，路径一定存在。
 *
 * ## 沉浸布局
 *
 * 编排器需要尽可能大的画布，所以它有 `meta.chrome === "immersive"`：
 * 不渲染窄栏、面板与状态栏，内容区全宽。判断放在这里而不是让编排器自己写一个外壳，
 * 是为了让"哪些页面没有导航"这件事在**一个地方**能看完。
 *
 * ## 窗口标题
 *
 * `document.title` 由 `meta.title` 写。参数化路由（历法工作区、编排器）的标题
 * 要等数据到了才知道，那时由页面自己再写一次——所以这里只在 `meta.title`
 * 存在且**没有** `titleFrom` 时写，避免把页面刚写好的标题覆盖成"历法"。
 */

import { computed, onMounted, onUnmounted, watch } from "vue";

import { useRoute, useRouter } from "../plugin";
import { createMenuTree, flattenMenu } from "../plugin";
import { DOMAIN_BY_ID, locate, verifyDomainRoutes } from "../entity/domain";
import { useShellStore } from "../store/shell.store";
import AppDomainPanel from "./shell/AppDomainPanel.vue";
import AppRail from "./shell/AppRail.vue";
import AppStatusBar from "./AppStatusBar.vue";
import AppTopbar from "./shell/AppTopbar.vue";
import AssistantDrawer from "./overlay/AssistantDrawer.vue";
import CommandPalette from "./overlay/CommandPalette.vue";

/*
 * 启动时校验领域登记表的每条路径都真的存在。
 *
 * **只报告，不抛错。** 导航配置错了的正确反应是"这一项不出现"，
 * 不是让整个应用白屏——这条教训是实测来的：`routeAt` 曾经按字符串相等比对，
 * 而路由表注册的是 `/calendar/:system/:view?`，于是四十条路径全判为不存在，
 * `verifyDomainRoutes()` 一 throw，用户看到的是一片空白。
 *
 * 构建期由 `scripts/verify-nav.mjs` 把它当错误；运行时打到控制台即可。
 */
const missingRoutes = verifyDomainRoutes();
if (missingRoutes.length > 0) {
    console.warn(
        `[导航] 领域登记表里有 ${missingRoutes.length} 条路径找不到对应路由，` +
            `这些项在面板里不会出现：\n  ${missingRoutes.join("\n  ")}`
    );
}

const route = useRoute();
const router = useRouter();
const shell = useShellStore();

/** 本应用的名称。窗口标题与顶栏品牌共用它，避免两处各写一遍。 */
const Brand = "轩辕历法";

/** 是否渲染导航与状态栏。 */
const immersive = computed(() => route.meta.chrome === "immersive");

/**
 * 当前所在的域与页面。
 *
 * 找不到时回退到工作台——**不抛错**：用户可能手打了一个奇怪的 URL，
 * 那时该看到一个能用的界面，而不是一屏报错。
 */
const located = computed(() => locate(route.path) ?? { domain: DOMAIN_BY_ID.get("home")!, page: null });

const currentDomain = computed(() => located.value.domain);
/** 当前页标题。参数化路由的 `meta.title` 是泛称（"历法"），页面会自己写更准的。 */
const pageTitle = computed(() => {
    const page = located.value.page;
    if (page !== null) {
        return page.title;
    }
    const title = route.meta.title;
    return typeof title === "string" && route.meta.titleFrom === undefined ? title : "";
});

/**
 * 命令面板的跳转候选。
 *
 * `flattenMenu` 把菜单树拍平成"标题 → 路径"，这是"任意页直达任意页"的底座。
 * 命令面板是**加速器**，不是导航的替代品：它建立在可见导航之上
 * （NN/g 的 recognition-over-recall：没有可见导航时用户想不起要搜什么）。
 */
const paletteItems = computed(() => flattenMenu(createMenuTree()));

/* -------------------------------------------------------------------------- */
/* 键盘                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 全局快捷键。
 *
 * | 组合           | 动作     | 理由                                              |
 * | -------------- | -------- | ------------------------------------------------- |
 * | `Ctrl/Cmd + K` | 命令面板 | 本项目自定（没有可核验的权威规范）                |
 * | `Ctrl/Cmd + /` | 助手抽屉 | 高效唤起                                          |
 * | `Ctrl/Cmd + B` | 折叠面板 | 高效关闭                                          |
 * | `Escape`       | 关覆盖物 | WCAG 2.1.2 无键盘陷阱                             |
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
    () => [route.meta.title, route.meta.titleFrom, route.path] as const,
    ([title, titleFrom, path]) => {
        if (path === "/") {
            document.title = Brand;
            return;
        }
        // 参数化路由的标题由页面写（它才知道 `:system` 是哪套历法）
        if (typeof title === "string" && title.length > 0 && titleFrom === undefined) {
            document.title = `${title} · ${Brand}`;
        }
    },
    { immediate: true }
);

/**
 * 点第一列的域图标。
 *
 * 语义是"进入这个域"，所以跳到该域登记表里的**第一项**——
 * 而不是只把第二列换掉却不导航：那样点下去画面只有第二列在变，
 * 内容区还停在上一页，看起来像"点了没反应"。
 */
const pickDomain = (id: string): void => {
    const first = DOMAIN_BY_ID.get(id)?.pages[0];
    if (first !== undefined) {
        void router.push(first.path);
    }
};
</script>

<template>
    <div class="shell">
        <AppRail v-if="!immersive" :active="currentDomain.id" @pick="pickDomain" />
        <AppDomainPanel
            v-if="!immersive"
            :domain="currentDomain"
            :active-path="route.path"
            @go="(path: string) => router.push(path)" />

        <div class="shell__column">
            <AppTopbar v-if="!immersive" :domain="currentDomain" :page-title="pageTitle" />

            <ElMain class="shell__main">
                <RouterView v-slot="{ Component }">
                    <!--
                        `:key` 用路径，否则 `/calendar/natural` 与
                        `/calendar/synodic` 会共用同一个组件实例，切体系时数据不刷新
                        （两个路径匹配的是同一条参数化路由）。

                        这里**不套 `KeepAlive`**：路由表的 `meta.keepAlive` 声明了
                        "哪些页面要保留状态"，但缓存一个整页组件会让
                        "换体系时数据不刷新"变成"换体系时连旧数据都留着"——
                        那比不缓存更糟。需要保留的是页内筛选状态，
                        它由各页面自己的 store 持有。
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
.shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
}

.shell__column {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
}

/*
 * 弹性宿主：不滚、不带内边距，只把剩余高度交给页面。
 * `min-height: 0` 不能省——少了它，子元素内容一长就会把这一块顶高，
 * `flex: 1` 会被内容撑破，状态栏被挤出窗口。
 */
.shell__main {
    background: var(--xy-layer-page);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 0;
}
</style>
