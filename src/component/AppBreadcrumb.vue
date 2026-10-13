<script setup lang="ts">
/**
 * 面包屑：读当前路由的 `matched` 链。
 *
 * 这是嵌套路由最直接的收益。`/calendar/synodic/data` 的 `matched` 天然是
 * `[AppShell] -> [历法] -> [历法工作区]`，按 `meta.title` 过滤掉没有标题的节点
 * （外壳）就是完整路径。
 *
 * ## 规则（`docs/ui-architecture.md` §2.3 第 16 条）
 *
 * | 规则                          | 落点                                |
 * | ----------------------------- | ----------------------------------- |
 * | 补充而非替代全局导航           | 侧栏常驻，这里只做定位              |
 * | 显示**站点层级**而非会话历史   | 读 `matched`，不读浏览历史          |
 * | 当前页作最后一项且**不作链接** | `path: null` → 渲染成纯文本         |
 * | 只包含有独立页面的节点         | 按 `meta.title` 过滤                |
 * | 1–2 层的扁平结构不需要         | 由 `AppTopbar` 判深度后决定是否渲染 |
 * | 分隔符用 `>`                   | `separator=">"`                     |
 *
 * ## 参数化路由的标题
 *
 * `/calendar/:system/:view?` 这一层的 `meta.title` 是字面量「历法工作区」，
 * 直接显示它没有信息量。带 `meta.titleFrom` 的节点因此要**换成真实名字**：
 * `:system` 取 `src/entity/calendar.ts` 的登记表。
 *
 * 这个映射是"面包屑必须说人话"与"路由表不能有函数"之间唯一的接缝，
 * 所以它集中在这里，而不是散在各页面里各写一次。
 */

import { computed } from "vue";

import { useRoute } from "../plugin";
import { systemOf } from "../entity/calendar";

interface Props {
    /** 是否显示最前面的"首页"节点 */
    homeLink?: boolean;
}

const props = withDefaults(defineProps<Props>(), { homeLink: false });

const route = useRoute();

/** 面包屑节点：逐级累积出绝对路径。 */
interface Crumb {
    /** 显示文案 */
    title: string;
    /** 绝对路径；最后一级为 `null`，渲染成纯文本 */
    path: string | null;
}

/**
 * 按 `meta.titleFrom` 把参数换成真实名字。
 *
 * 认不出来的参数**退回 `meta.title`**，不抛错：面包屑是导航辅助，
 * 它不该在参数非法时把整页打挂——非法参数的处理是页面的职责（渲染空态）。
 *
 * 参数取自 `route.params` 而不是 `record.params`：`RouteLocationMatched` 上
 * 没有 `params`（那是 `RouteLocationNormalized` 才有的），而每一层的参数在
 * 当前地址里都能从 `route.params` 取到——参数名在整条链上唯一。
 */
const titleOfRecord = (record: { meta: { title?: string; titleFrom?: string } }): string => {
    const fallback = String(record.meta.title ?? "");
    const from = record.meta.titleFrom;

    if (from === undefined) {
        return fallback;
    }

    const value = route.params[from];
    const parameter = Array.isArray(value) ? value[0] : value;
    if (parameter === undefined || parameter === "") {
        return fallback;
    }

    if (from === "system") {
        return systemOf(parameter)?.label ?? fallback;
    }

    // `:page` 这类参数在各域自己的页内切换器里有显示名，面包屑只要说清
    // "这一层属于哪个域"就够了——域的名字来自 `meta.title`。
    return fallback;
};

/**
 * 面包屑节点：最后一级不可点，其余指向自己那一级的路径。
 *
 * 路由表里每一层的 `path` 是**带参数的模板**（`/calendar/:system/:view?`），
 * 不是可直接跳的地址，所以中间层的链接要用当前实际路径按层级截出来。
 */
const crumbs = computed<Crumb[]>(() => {
    const matched = route.matched.filter((record) => Boolean(record.meta?.title));
    const segments = route.path.split("/").filter((segment) => segment.length > 0);

    return matched.map((record, index) => {
        const isLast = index === matched.length - 1;
        /*
         * 中间层用"取前 N 段"构造路径。
         *
         * `matched` 的第 i 项对应 URL 的前 i 段：`/calendar/synodic/data` 的
         * `matched` 是 [外壳, 历法, 历法工作区]，第 0 项（历法）对应 1 段
         * → `/calendar`，第 1 项对应 2 段 → `/calendar/synodic`。
         * 外壳没有标题，已被过滤掉，所以 `index + 1` 正好是层深。
         */
        const depth = index + 1;
        const path = depth <= segments.length ? `/${segments.slice(0, depth).join("/")}` : null;

        return {
            title: titleOfRecord(record),
            path: isLast ? null : path
        };
    });
});
</script>

<template>
    <ElBreadcrumb separator=">" class="app-breadcrumb">
        <ElBreadcrumbItem v-if="props.homeLink">
            <RouterLink to="/" class="app-breadcrumb__link">
                <ElIcon><HomeFilled /></ElIcon>
            </RouterLink>
        </ElBreadcrumbItem>

        <ElBreadcrumbItem v-for="crumb in crumbs" :key="`${crumb.title}:${crumb.path ?? 'current'}`">
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
    font-size: 12px;
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
