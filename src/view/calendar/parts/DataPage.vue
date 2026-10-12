<script setup lang="ts">
/**
 * 历法实体的「数据」页壳。
 *
 * ## 一张历表页要回答的问题
 *
 * 每个历法实体在 `src/datasource/` 下有 9 张表（`year` / `year_months` /
 * `year_parts` / `year_weeks` / `year_phenologies` / `month` / `month_parts` /
 * `month_weeks` / `month_phenologies`），直接平铺成 9 个标签页会让人无从下手。
 * 按"看什么"分组更实用：
 *
 * - **年** —— `year` 的逐年记录；
 * - **月** —— `month` 的逐月记录；
 * - **分段 / 周 / 节气** —— 三张关联表。
 *
 * 分组先落成 `ElTabs`，每组里是"工具栏 + 表格 + 分页"的空位。
 * 查询接上以后这里直接换成 `<ElTable>` 的真实列，骨架不变。
 */

import { computed, ref } from "vue";
import PageShell from "../../../component/PageShell.vue";

interface Props {
    /** 数据源（`.sqlite` 文件名） */
    source?: string;
    /** 加载状态 */
    state?: "loading" | "ready" | "empty" | "error";
}

const props = withDefaults(defineProps<Props>(), { source: "", state: "loading" });

/** 当前分组。 */
const activeGroup = ref("year");

/** 数据分组：与 `src/datasource/<entity>.*.sqlite.ts` 的表分组对应。 */
const Groups = [
    { name: "year", label: "年", tables: "year", hint: "逐年记录" },
    { name: "month", label: "月", tables: "month", hint: "逐月记录" },
    { name: "part", label: "分段", tables: "year_parts、month_parts", hint: "元会运世分段" },
    { name: "week", label: "周", tables: "year_weeks、month_weeks", hint: "旬与候" },
    {
        name: "phenology",
        label: "节气",
        tables: "year_phenologies、month_phenologies",
        hint: "节气与物候时刻"
    }
];

/** 当前分组的表名，用于页内说明。 */
const activeTables = computed(
    () => Groups.find((group) => group.name === activeGroup.value)?.tables ?? ""
);
</script>

<template>
    <PageShell
        :state="props.state"
        :source="props.source"
        skeleton="table"
        empty-text="这个实体还没有可展示的历表数据；22 个分库当前的行数见「性能 / 数据信息」页。">
        <ElAlert
            :title="`数据来自 ${props.source || '对应分库'}，当前分组涉及：${activeTables}`"
            type="info"
            :closable="false"
            show-icon
            class="data-page__hint" />

        <ElTabs v-model="activeGroup" type="border-card" class="data-page__tabs">
            <ElTabPane v-for="group in Groups" :key="group.name" :label="group.label" :name="group.name">
                <div class="data-page__toolbar">
                    <ElInput placeholder="按名称或年份筛选" clearable class="data-page__search">
                        <template #prefix>
                            <ElIcon><Search /></ElIcon>
                        </template>
                    </ElInput>
                    <ElButtonGroup>
                        <ElButton>
                            <ElIcon><Download /></ElIcon>
                            <span>导出 CSV</span>
                        </ElButton>
                        <ElButton>
                            <ElIcon><Refresh /></ElIcon>
                        </ElButton>
                    </ElButtonGroup>
                </div>

                <ElTable :data="[]" border height="420" class="data-page__table">
                    <ElTableColumn prop="identity" label="identity" width="180" class-name="numeral" />
                    <ElTableColumn :label="group.hint" min-width="240" />
                    <ElTableColumn label="start" width="200" class-name="numeral" />
                    <ElTableColumn label="end" width="200" class-name="numeral" />
                    <template #empty>
                        <ElEmpty :description="`${group.label}：暂无数据`" :image-size="72" />
                    </template>
                </ElTable>

                <ElPagination
                    layout="total, sizes, prev, pager, next, jumper"
                    :total="0"
                    :page-size="50"
                    class="data-page__pager" />
            </ElTabPane>
        </ElTabs>
    </PageShell>
</template>

<style scoped>
.data-page__hint {
    margin-bottom: 12px;
}

.data-page__toolbar {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 12px;
}

.data-page__search {
    max-width: 320px;
}

.data-page__table {
    width: 100%;
}

.data-page__pager {
    justify-content: flex-end;
    margin-top: 12px;
}
</style>
