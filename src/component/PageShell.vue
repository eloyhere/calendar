<script setup lang="ts">
/**
 * 页面壳：每个业务页面的统一容器。
 *
 * 页面自己的 `.vue` 只描述"我是谁、我还没写完"，其余全在这里：
 *
 * - 头部：图标 + 标题 + `meta.description` + `meta` 标签（路由名 / 路径）
 * - 状态区：`loading` 显示 `SkeletonBlock`，`empty` 显示 `EmptyState`，
 *   `error` 显示 `ErrorState`（带重试），`ready` 才渲染默认插槽
 *
 * 这样做的直接好处是**不会出现"有的页面忘了写空态、有的页面忘了写加载态"**：
 * 只要新页面用 `<PageShell>`，四种状态就是齐的。内容区留给后续填充，
 * 现在四个状态都能看到效果。
 *
 * 需要绕开这套状态渲染的页面（比如整页画布），直接在 `PageShell` 外写内容即可，
 * 它不是强制的。
 */

import { computed } from "vue";
import type { Component } from "vue";
import { useRoute } from "../plugin";
import { resolveIconComponent } from "../plugin/dependencies";
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
    /** 是否显示头部（标题区） */
    header?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    state: "loading",
    errorText: "",
    skeleton: "card",
    emptyText: "",
    source: "",
    card: true,
    header: true
});

const emit = defineEmits<{
    /** 用户在错误态点了重试 */
    retry: [];
}>();

const route = useRoute();

/** 页面标题：`meta.title` 是唯一来源。 */
const title = computed(() => route.meta.title ?? "未命名页面");

/** 页面说明：`meta.description`。 */
const description = computed(() => route.meta.description ?? "");

/** 头部图标组件；白名单外的名字会拿到 `null`，此时不渲染图标。 */
const icon = computed<Component | null>(() => {
    const name = route.meta.icon;
    return name ? resolveIconComponent(name) : null;
});

/** 头部展示的元信息标签：路由名与绝对路径，方便对照 `plugin/router.ts`。 */
const metaTags = computed(() => {
    const name = typeof route.name === "string" ? route.name : "";
    return [
        name ? { label: "路名", value: name } : null,
        { label: "路径", value: route.path }
    ].filter((tag): tag is { label: string; value: string } => tag !== null);
});
</script>

<template>
    <div class="page-shell">
        <ElCard v-if="props.header" shadow="never" class="page-shell__header">
            <div class="page-shell__heading">
                <ElIcon v-if="icon" :size="22" class="page-shell__icon">
                    <component :is="icon" />
                </ElIcon>
                <div class="page-shell__titles">
                    <ElText tag="h2" size="large" class="page-shell__title">{{ title }}</ElText>
                    <ElText v-if="description" type="info" size="small">
                        {{ description }}
                    </ElText>
                </div>
                <ElSpace class="page-shell__tags">
                    <ElTag
                        v-for="tag in metaTags"
                        :key="tag.label"
                        size="small"
                        type="info"
                        effect="plain"
                        class="numeral">
                        {{ tag.label }} {{ tag.value }}
                    </ElTag>
                </ElSpace>
            </div>
        </ElCard>

        <ElCard
            shadow="never"
            :class="['page-shell__body', { 'is-bare': !props.card }]">
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
        </ElCard>
    </div>
</template>

<style scoped>
.page-shell {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.page-shell__heading {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.page-shell__icon {
    color: var(--el-color-primary);
    margin-top: 4px;
}

.page-shell__titles {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.page-shell__title {
    margin: 0;
}

.page-shell__tags {
    flex-shrink: 0;
}

.page-shell__body {
    min-height: 260px;
}

.page-shell__body.is-bare {
    background: transparent;
    border: none;
}
</style>
