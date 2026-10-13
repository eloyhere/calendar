<script setup lang="ts">
/**
 * 域内页切换器：一个域里多页时的统一导航条。
 *
 * ## 它现在只用在少数几处
 *
 * 外壳改成了「窄栏 + 二级面板」之后，域内导航**已经在面板里**列出
 * （见 `component/shell/AppDomainPanel.vue`）。所以本组件不再是主要的域内导航，
 * 而是留给两个场景：面板被折叠时用户想在页面里横向跳，以及工作台里嵌进卡片的
 * 小型切换器。
 *
 * ## 与 URL 同步
 *
 * 切换器写 `router.push`，所以每个页都有自己的地址，可以直接分享与收藏。
 * 非法 `:page` **不重定向**，由页面渲染空态——重定向会把拼错的地址掩盖掉
 * （与 `CalendarSystemView` 同一个判断）。
 *
 * ## 键盘与无障碍
 *
 * `ElTabs` 自带 `role="tablist"` 与左右方向键。这里不自己造按钮组：
 * 造一个只会少掉那些语义。
 */

import { computed } from "vue";

import AppIcon from "./AppIcon.vue";
import { useRouter } from "../plugin";
import type { Domain } from "../entity/domain";

interface Props {
    /** 域登记项 */
    domain: Domain;
    /** 当前页路径 */
    current: string;
    /** 页头上的计数说明（可选），例如"1,184 个年号" */
    note?: string;
}

const props = withDefaults(defineProps<Props>(), { note: "" });

const router = useRouter();

const go = (path: string): void => {
    void router.push(path);
};

/** 当前页的说明，显示在切换器下面一行。 */
const currentPage = computed(() => props.domain.pages.find((page) => page.path === props.current));
</script>

<template>
    <div class="domain-pages">
        <ElTabs
            :model-value="props.current"
            class="domain-pages__tabs"
            @update:model-value="(value: string | number) => go(String(value))">
            <ElTabPane v-for="page in props.domain.pages" :key="page.path" :name="page.path">
                <template #label>
                    <span class="domain-pages__label" :title="page.description">
                        <AppIcon :name="page.icon" />
                        <span>{{ page.title }}</span>
                    </span>
                </template>
            </ElTabPane>
        </ElTabs>

        <!--
            一句说明 + 计数。
            `role="status"` 不抢焦点地播报"现在在哪一页"（WCAG 4.1.3）。
        -->
        <p class="domain-pages__note" role="status" aria-live="polite">
            {{ currentPage?.description ?? "没有这一页" }}
            <span v-if="props.note" class="xy-dim">· {{ props.note }}</span>
        </p>
    </div>
</template>

<style scoped>
.domain-pages {
    flex-shrink: 0;
}

.domain-pages__tabs :deep(.el-tabs__header) {
    margin: 0;
}

/* 内容区由页面自己渲染，`ElTabs` 只当切换器 */
.domain-pages__tabs :deep(.el-tabs__content) {
    display: none;
}

.domain-pages__label {
    align-items: center;
    display: inline-flex;
    gap: 4px;
}

.domain-pages__note {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 18px;
    margin: 6px 0 0;
}
</style>
