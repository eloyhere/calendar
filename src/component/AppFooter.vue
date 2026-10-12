<script setup lang="ts">
/**
 * 页脚：版本、数据规模与当前库状态。
 *
 * 单独拆成组件的原因是它要读**全局**信息（版本号、库规模），而不是当前页面的
 * 信息；塞进 `AppShell` 会让那个文件同时承担布局与数据两件事。
 *
 * 数字目前是写死的常量：`docs/design.md` 的表格是它们的来源，等
 * `src/store/temporal.store.ts` 之类接上以后再换成 store 读出来的值。
 * 先把"页脚要显示什么"固定下来，接数据时只改本文件的一个 `computed`。
 */

import { computed } from "vue";

interface Props {
    /** 是否折叠成一行紧凑样式 */
    compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), { compact: false });

/** 数据规模，逐个对照 `docs/design.md` §3 的表格。 */
const Scale = {
    /** 分库数量 */
    databases: 22,
    /** 全部表的行数合计 */
    rows: "11,906,768",
    /** 朔望月行数（`calendar.xlsx` 的实测值） */
    synodicMonths: "290,654"
} as const;

/** 页脚左半部分：数据规模。 */
const scaleText = computed(
    () => `${Scale.databases} 个分库 · ${Scale.rows} 行 · 朔望月 ${Scale.synodicMonths} 条`
);

/** 页脚右半部分：构建信息。 */
const buildText = computed(() => "数据源 calendar.xlsx（37 MB）· 建元 -2696-03-11");
</script>

<template>
    <div class="app-footer" :class="{ 'is-compact': props.compact }">
        <span class="numeral">{{ scaleText }}</span>
        <ElDivider v-if="!props.compact" direction="vertical" />
        <span class="numeral app-footer__build">{{ buildText }}</span>
    </div>
</template>

<style scoped>
.app-footer {
    align-items: center;
    color: var(--el-text-color-secondary);
    display: flex;
    font-size: 12px;
    gap: 12px;
    justify-content: space-between;
    line-height: 1.4;
}

.app-footer.is-compact {
    justify-content: flex-start;
}

.app-footer__build {
    text-align: right;
}

@media (width <= 768px) {
    .app-footer__build {
        display: none;
    }
}
</style>
