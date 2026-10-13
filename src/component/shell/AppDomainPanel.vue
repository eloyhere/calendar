<script setup lang="ts">
/**
 * 第二列：**文字形态的 `ElMenu`**（当前域的子项）。
 *
 * ## 与第一列的分工
 *
 * ```
 * ┌──────────┬─────────────────┬──────────────────────┐
 * │ 图标      │ 文字             │ 内容                  │
 * │ ElMenu   │ ElMenu          │                      │
 * │ collapse │ vertical        │                      │
 * │ 九个域    │ 当前域的子项      │                      │
 * └──────────┴─────────────────┴──────────────────────┘
 * ```
 *
 * 第一列只出图标（域的名字在这里写全），这一列出文字。两列都是 `ElMenu`，
 * 所以 hover、选中、键盘导航、展开动效全部来自同一套实现，
 * 不会出现"左边有动画、右边硬切"这种不一致。
 *
 * ## 为什么不用可折叠的 `ElSubMenu`
 *
 * 这里的项**都是叶子**，一次点击到位。加一层可折叠的子树就是第三层展开，
 * 而 NN/g 在 progressive-disclosure 一文里写明"超过两层的展开通常在可用性上很差"。
 * 域内分节靠**分组标题**（"三式" / "占卜"）而不是折叠——分组靠接近性就能读懂
 * （Gestalt 的 proximity），折叠要多点一次、还多一个要记住的状态。
 *
 * 分组标题用 `ElMenuItemGroup`：它正是为这个场景准备的，
 * 不可点击、不参与高亮，语义正确。
 */

import { computed } from "vue";

import type { Domain } from "../../entity/domain";
import AppIcon from "../AppIcon.vue";

interface Props {
    /** 当前域 */
    domain: Domain;
    /** 当前路径（用于高亮） */
    activePath: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 跳到某个页面 */
    go: [path: string];
}>();

/**
 * 按 `group` 分节。
 *
 * `null` 的项归到一个无名节，渲染在最前。做成计算属性而不是在模板里过滤三次，
 * 是因为模板写不出"保持声明顺序的去重分组"，硬写会得到三段 `v-if` 加三个 `v-for`。
 */
const sections = computed(() => {
    const order: string[] = [];
    const buckets = new Map<string, Domain["pages"][number][]>();

    for (const page of props.domain.pages) {
        const key = page.group ?? "";
        if (!buckets.has(key)) {
            buckets.set(key, []);
            order.push(key);
        }
        buckets.get(key)?.push(page);
    }

    return order.map((key) => ({ title: key, pages: buckets.get(key) ?? [] }));
});

/**
 * 当前项。
 *
 * 精确匹配优先，否则**最长前缀**：用户在 `/calendar/natural/year` 时，
 * 第二列里亮的应该是「轩辕历」而不是没有项亮着。
 */
const activeIndex = computed(() => {
    const pages = props.domain.pages;
    const exact = pages.find((page) => page.path === props.activePath);
    if (exact !== undefined) {
        return exact.path;
    }

    let best = "";
    for (const page of pages) {
        if (page.path !== "/" && props.activePath.startsWith(`${page.path}/`) && page.path.length > best.length) {
            best = page.path;
        }
    }
    return best;
});
</script>

<template>
    <nav class="pages">
        <header class="pages__head">
            <div class="pages__title">
                <AppIcon :name="props.domain.icon" :size="15" />
                <span>{{ props.domain.label }}</span>
            </div>
            <p class="pages__note">{{ props.domain.description }}</p>
        </header>

        <ElScrollbar class="pages__scroll">
            <ElMenu
                :default-active="activeIndex"
                mode="vertical"
                :unique-opened="false"
                class="pages__menu"
                @select="(index: string) => emit('go', index)">
                <template v-for="section in sections" :key="section.title">
                    <!-- 无名节直接铺平；有名的用 ElMenuItemGroup 出分组标题 -->
                    <template v-if="section.title.length === 0">
                        <ElMenuItem v-for="page in section.pages" :key="page.path" :index="page.path">
                            <AppIcon :name="page.icon" :size="15" />
                            <template #title>
                                <span class="pages__label" :title="page.description">{{ page.title }}</span>
                            </template>
                        </ElMenuItem>
                    </template>

                    <ElMenuItemGroup v-else :title="section.title">
                        <ElMenuItem v-for="page in section.pages" :key="page.path" :index="page.path">
                            <AppIcon :name="page.icon" :size="15" />
                            <template #title>
                                <span class="pages__label" :title="page.description">{{ page.title }}</span>
                            </template>
                        </ElMenuItem>
                    </ElMenuItemGroup>
                </template>
            </ElMenu>
        </ElScrollbar>
    </nav>
</template>

<style scoped>
.pages {
    background: var(--el-bg-color);
    border-right: 1px solid var(--xy-hairline);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    width: 226px;
}

.pages__head {
    border-bottom: 1px solid var(--xy-hairline);
    flex-shrink: 0;
    padding: 11px 14px 9px;
}

.pages__title {
    align-items: center;
    color: var(--el-text-color-primary);
    display: flex;
    font-size: var(--xy-font-md);
    font-weight: var(--xy-weight-semibold);
    gap: 6px;
    line-height: var(--xy-leading-tight);
}

.pages__note {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
}

.pages__scroll {
    flex: 1;
    min-height: 0;
}

/*
 * `ElMenu` 自带右边框，外框由 `.pages` 画。
 *
 * 项高 34px：这一列平均 4–12 项，34px 在 900px 高里放得下且不用滚。
 * 仍然满足 WCAG 2.5.8 的 24×24 指针目标。
 */
.pages__menu {
    --el-menu-item-height: 34px;
    --el-menu-base-level-padding: 14px;
    border-right: none;
    padding-bottom: 10px;
    width: 100%;
}

/* 分组标题：比项更小更弱，读起来像标签而不是"又一项" */
.pages__menu :deep(.el-menu-item-group__title) {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
    letter-spacing: 0.08em;
    padding: 10px 16px 2px;
}

.pages__label {
    margin-left: 6px;
}
</style>
