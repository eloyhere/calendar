<script setup lang="ts">
/**
 * 页面壳：每个业务页面的统一容器。
 *
 * 只做一件事——**状态区**：`loading` 显示 `SkeletonBlock`，`empty` 显示
 * `EmptyState`，`error` 显示 `ErrorState`（带重试），`ready` 才渲染默认插槽。
 *
 * 这样做的直接好处是**不会出现"有的页面忘了写空态、有的页面忘了写加载态"**：
 * 只要新页面用 `<PageShell>`，四种状态就是齐的。内容区留给后续填充，
 * 现在四个状态都能看到效果。
 *
 * ## 为什么这里没有标题区
 *
 * 曾经有过一条"图标 + 标题 + 说明 + 路名/路径标签"的头部卡片（`page-shell__header`），
 * 它把 `meta.title`、`meta.description` 又抄了一遍到页面顶部——而这些信息外壳里
 * 已经有了：窗口标题写 `meta.title`（`AppShell`），页头胶囊与侧栏菜单项写标题
 * 与说明（`AppHeader` / `plugin/menu.ts`）。同一句话在一屏里出现三次，真正的内容
 * 反而被顶到折叠线以下，所以整块删掉了。
 *
 * 要恢复"页面自己的标题"，不要重新加回 `PageShell`——那会让上面三处又变成四处；
 * 页面自己的 `.vue` 里写一个 `<h2>` 更干净，只有它真的需要时才写。
 *
 * 需要绕开这套状态渲染的页面（比如整页画布），直接在 `PageShell` 外写内容即可，
 * 它不是强制的。
 *
 * ## 布局：页面撑满内容区，滚动发生在卡片里
 *
 * 外壳（`AppShell` 的 `ElMain`）是弹性布局的宿主，**自己不滚**。本组件因此要：
 *
 * ```
 * .page-shell            flex:1           吃掉 ElMain 的剩余高度
 * └─ 卡片                flex:1
 *    └─ ElScrollbar      flex:1           真正滚动的那一层
 * ```
 *
 * 内边距落在 `.page-shell__inner` 而不是卡片上，滚动条才能贴着卡片右缘，
 * 而不是悬在一圈内边距里面。
 *
 * `scroll: false` 给"整屏画布"类页面（对话页那种三栏各自滚的）用：此时插槽内容
 * 直接撑满卡片，滚动由页面自己安排。
 *
 * 四种状态里只有 `ready` 进滚动区：骨架屏 / 空态 / 错误态都是固定大小的小块，
 * 没有滚动的必要，给它们套一层 `ElScrollbar` 只会让"没滚动"和"滚动条不出现"
 * 两件事混在一起。
 */

import EmptyState from "./state/EmptyState.vue";
import ErrorState from "./state/ErrorState.vue";
import SkeletonBlock from "./state/SkeletonBlock.vue";
import type { PageState } from "../state/use-page-state";

interface Props {
    /** 当前状态机状态 */
    state?: PageState;
    /** 错误详情（`state === "error"` 时用） */
    errorText?: string;
    /** 骨架屏形状 */
    skeleton?: "card" | "table" | "form";
    /** 空态说明：为什么这里是空的 */
    emptyText?: string;
    /** 空态的数据源名称，会拼进默认说明 */
    source?: string;
    /** 是否渲染卡片外壳；整页画布类页面传 `false` */
    card?: boolean;
    /**
     * `ready` 态的内容是否放进 `ElScrollbar`。
     *
     * 默认 `true`：内容比窗口高时在卡片内部滚动（页面本身不滚）。
     * 传 `false` 则插槽直接撑满卡片，滚动由页面自己安排——对话页那种
     * "左中右三栏各自滚、输入框永远钉在底部"的整屏布局需要它。
     */
    scroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    state: "loading",
    errorText: "",
    skeleton: "card",
    emptyText: "",
    source: "",
    card: true,
    scroll: true
});

const emit = defineEmits<{
    /** 用户在错误态点了重试 */
    retry: [];
}>();
</script>

<template>
    <div class="page-shell">
        <ElCard shadow="never" :class="['page-shell__body', { 'is-bare': !props.card }]">
            <!-- ready 态才需要滚动：骨架屏 / 空态 / 错误态都是固定大小的小块 -->
            <ElScrollbar v-if="props.state === 'ready' && props.scroll" class="page-shell__scroll">
                <div class="page-shell__inner">
                    <slot />
                </div>
            </ElScrollbar>

            <div
                v-else
                class="page-shell__inner"
                :class="{ 'is-fill': props.state === 'ready' }">
                <SkeletonBlock v-if="props.state === 'loading'" :variant="props.skeleton" />

                <EmptyState
                    v-else-if="props.state === 'empty'"
                    :source="props.source"
                    :description="props.emptyText"
                    action-text="重新加载"
                    @action="emit('retry')" />

                <ErrorState
                    v-else-if="props.state === 'error'"
                    :error-text="props.errorText"
                    @retry="emit('retry')" />

                <slot v-else />
            </div>
        </ElCard>
    </div>
</template>

<style scoped>
/*
 * 页面壳是 `ElMain` 的弹性子项：吃掉剩余高度，再把高度分给卡片。
 * 内边距落在这一层（而不是 `ElMain` 或卡片上），滚动条才能贴着卡片右缘。
 */
.page-shell {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 16px 20px;
}

.page-shell__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 260px;
}

/* ElCard 的 body 自带内边距；这里让给滚动区，滚动条才不会被内边距推开 */
.page-shell__body :deep(.el-card__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    padding: 0;
}

.page-shell__body.is-bare {
    background: transparent;
    border: none;
}

.page-shell__scroll {
    flex: 1;
    min-height: 0;
}

/* 滚动区的内容：内边距落在这一层 */
.page-shell__inner {
    padding: 20px;
}

/* 不滚动时（对话页那种整屏 Flex）内容直接撑满，内边距由页面自己安排 */
.page-shell__inner.is-fill {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 0;
}
</style>
