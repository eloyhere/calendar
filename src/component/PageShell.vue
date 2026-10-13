<script setup lang="ts">
/**
 * 页面壳：每个业务页面的统一容器，负责**加载遮罩**与三种兜底状态。
 *
 * ## 加载不再销毁内容
 *
 * 早先这里是四选一渲染：`loading` 渲染骨架屏、`empty` 渲染空态、
 * `error` 渲染错误态、`ready` 才渲染插槽。那等于**每次取数都把内容卸载再重建**，
 * 代价有三个，都不小：
 *
 * 1. **滚动位置丢失**——翻一页回到顶部；
 * 2. **表格的列宽与勾选状态重置**——`ElTable` 重建后列宽要重新算，画面会跳一下；
 * 3. **DOM 重建的开销**——历表有几百行，重建一次几十毫秒，翻月时看得出来。
 *
 * 现在改成：**内容始终挂载**，加载中盖一层 `v-loading`。
 * 于是"取数"这个动作在视觉上只是遮罩出现又消失，内容本身不动。
 * 只有真正**没有内容可显示**时才换成兜底（首次进入的空库、打不开的库），
 * 因为那时底下确实没有东西可盖。
 *
 * ## 骨架屏只在"从没加载过"时用
 *
 * `SkeletonBlock` 留给了 `skeleton` 分支：首次进入（还没有任何数据）时
 * 骨架屏比遮罩更能说明"这里将来会有什么"。已经有数据之后再取数，
 * 用遮罩——因为用户已经知道那里有什么了。
 */

import { computed, ref, watch } from "vue";

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
     * 传 `false` 则插槽直接撑满卡片，滚动由页面自己安排。
     */
    scroll?: boolean;
    /**
     * 加载遮罩的文案。
     *
     * 写成可配的而不是固定"加载中"：不同页面的等待时间差很大
     * （查 98 张表的结构要几百毫秒，查一个月的日历只要几十毫秒），
     * 一句更具体的文案能让等待感觉更短。
     */
    loadingText?: string;
}

const props = withDefaults(defineProps<Props>(), {
    state: "loading",
    errorText: "",
    skeleton: "card",
    emptyText: "",
    source: "",
    card: true,
    scroll: true,
    loadingText: "正在读分库…"
});

const emit = defineEmits<{
    /** 用户在错误态点了重试 */
    retry: [];
}>();

/**
 * 有没有**加载成功过**。
 *
 * 这一个标记区分了两种"加载中"：
 *
 * - 从没成功过 → 骨架屏（告诉用户这里将来会有什么）；
 * - 成功过又再取数 → 遮罩（内容留着，用户已经知道那里有什么）。
 *
 * 不区分的话，翻月时整页闪成骨架屏，比不动还难受。
 */
const everReady = ref(false);
watch(
    () => props.state,
    (state) => {
        if (state === "ready" || state === "empty") {
            everReady.value = true;
        }
    },
    { immediate: true }
);

/** 首次加载：还没有任何内容可显示，用骨架屏。 */
const showSkeleton = computed(() => props.state === "loading" && !everReady.value);

/**
 * 加载遮罩。
 *
 * 只在"有内容可盖"时出现。`empty` 与 `error` 不盖遮罩——
 * 它们本身就是兜底内容，再盖一层遮罩会挡住那句解释。
 */
const loading = computed(
    () => props.state === "loading" && everReady.value
);

/**
 * 兜底：真正没有内容可显示时才替换插槽。
 *
 * - `empty` 且从没成功过 → 空态（库是空的，底下没东西）；
 * - `error` 且从没成功过 → 错误态（打不开，底下没东西）；
 * - 其余情况一律渲染插槽，靠遮罩表达加载中。
 */
const fallback = computed<"none" | "empty" | "error">(() => {
    if (everReady.value) {
        return "none";
    }
    if (props.state === "error") {
        return "error";
    }
    if (props.state === "empty") {
        return "empty";
    }
    return "none";
});
</script>

<template>
    <div class="page-shell">
        <ElCard shadow="never" :class="['page-shell__body', { 'is-bare': !props.card }]">
            <!-- 首次加载：骨架屏 -->
            <div v-if="showSkeleton" class="page-shell__inner">
                <SkeletonBlock :variant="props.skeleton" />
            </div>

            <!-- 从没成功过的空态 / 错误态：底下确实没有内容 -->
            <div v-else-if="fallback === 'empty'" class="page-shell__inner">
                <EmptyState
                    :source="props.source"
                    :description="props.emptyText"
                    action-text="重新加载"
                    @action="emit('retry')" />
            </div>

            <div v-else-if="fallback === 'error'" class="page-shell__inner">
                <ErrorState :error-text="props.errorText" @retry="emit('retry')" />
            </div>

            <!--
                正常路径：**内容始终挂载**，加载中的表现是上面盖一层遮罩。
                这样翻月 / 换体系时滚动位置、列宽、勾选状态都不会丢。
            -->
            <ElScrollbar
                v-else-if="props.scroll"
                v-loading="loading"
                :element-loading-text="props.loadingText"
                class="page-shell__scroll">
                <div class="page-shell__inner">
                    <slot />
                </div>
            </ElScrollbar>

            <div v-else v-loading="loading" :element-loading-text="props.loadingText" class="page-shell__inner is-fill">
                <slot />
            </div>
        </ElCard>
    </div>
</template>

<style scoped>
/*
 * 页面壳是 `ElMain` 的弹性子项：吃掉剩余高度，再把高度分给卡片。
 * 内边距落在这一层（而不是 `ElMain` 或卡片上），滚动条才能贴着卡片右缘。
 *
 * 内边距 12/14 而不是 16/20：这一圈是**纯消耗**——它不承载任何信息，
 * 而 1440 宽的窗口里它一年吃掉约 40px 的可用宽度。历表要的是宽度。
 */
.page-shell {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 10px 12px;
}

.page-shell__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 200px;
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

/* 滚动区的内容：内边距落在这一层。同样收到最小 */
.page-shell__inner {
    padding: 12px 14px;
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
