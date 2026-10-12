<script setup lang="ts">
/**
 * 面包屑：直接读当前路由的 `matched` 链。
 *
 * 这是嵌套路由最直接的收益。上一版只有一张扁平路由表，面包屑得靠页面自己拼；
 * 现在 `/calendar/astronomy/entry` 的 `matched` 天然是
 * `[AppShell] -> [历法] -> [天文历] -> [简介]`，按 `meta.title` 过滤掉没有标题的
 * 节点（`AppShell` 本身）就是完整路径。
 *
 * 两个细节：
 *
 * - **最后一级不可点**：它就是你当前所在的位置，做成链接只会让人误点；
 * - **中间级用 `<RouterLink>`**：`/calendar/astronomy` 这类分组自身有
 *   `redirect`，点进去会落到默认子页，是符合预期的行为。
 */

import { computed } from "vue";
import { useRoute } from "../plugin";

interface Props {
    /** 是否显示最前面的"首页"节点 */
    homeLink?: boolean;
}

const props = withDefaults(defineProps<Props>(), { homeLink: true });

const route = useRoute();

/** 面包屑节点：逐级累积出绝对路径。 */
interface Crumb {
    /** 显示文案 */
    title: string;
    /** 绝对路径；最后一级为 `null`，渲染成纯文本 */
    path: string | null;
}

/**
 * 面包屑节点：最后一级不可点，其余指向自己那一级的路径。
 *
 * 路由表里每一层都写的是绝对路径（`/calendar/astronomy/entry`），
 * 所以 `record.path` 直接就是要跳的地址，不需要任何拼接。
 */
const crumbs = computed<Crumb[]>(() => {
    const matched = route.matched.filter((record) => Boolean(record.meta?.title));

    return matched.map((record, index) => {
        const isLast = index === matched.length - 1;

        return { title: String(record.meta.title), path: isLast ? null : record.path };
    });
});
</script>

<template>
    <ElBreadcrumb separator="/" class="app-breadcrumb">
        <ElBreadcrumbItem v-if="props.homeLink">
            <RouterLink to="/" class="app-breadcrumb__link">
                <ElIcon><HomeFilled /></ElIcon>
            </RouterLink>
        </ElBreadcrumbItem>

        <ElBreadcrumbItem v-for="crumb in crumbs" :key="crumb.title">
            <RouterLink v-if="crumb.path" :to="crumb.path" class="app-breadcrumb__link">
                {{ crumb.title }}
            </RouterLink>
            <span v-else class="app-breadcrumb__current">{{ crumb.title }}</span>
        </ElBreadcrumbItem>
    </ElBreadcrumb>
</template>

<style scoped>
.app-breadcrumb {
    align-items: center;
    display: flex;
    line-height: 1;
}

.app-breadcrumb__link {
    color: var(--el-text-color-secondary);
    text-decoration: none;
}

.app-breadcrumb__link:hover {
    color: var(--el-color-primary);
}

.app-breadcrumb__current {
    color: var(--el-text-color-primary);
    font-weight: 500;
}
</style>
