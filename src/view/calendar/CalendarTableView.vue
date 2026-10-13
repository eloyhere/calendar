<script setup lang="ts">
/**
 * 历法数据表：`/calendar/table/:system`。某套历法的**逐行表格**，整屏宽。
 *
 * 与 `/calendar/:system` 的分工：那个页面回答"这一天是什么"（日历语义），
 * 这个页面回答"这套历法的历表长什么样"（数据语义）。同一批数据的两个上下文，
 * 所以两页互相链接。
 *
 * 列表用 `ElTable` + 虚拟滚动（`ElTableVScroll`）：`synodic_month` 有 29 万行，
 * 一次性渲染会让页面卡死。行高固定 32px 是虚拟滚动的前提，也是
 * Carbon 给数据表的默认行高（<https://carbondesignsystem.com/building-blocks/core/components/data-table/guidelines>）。
 */

import { computed, ref, watch } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { useRoute, useRouter } from "../../plugin";
import { ALL_SYSTEMS, systemOf } from "../../entity/calendar";
import { useQuery, formatCount } from "../../state/use-calendar-query";

const route = useRoute();
const router = useRouter();

const systemId = computed(() => {
    const raw = route.params.system;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

const system = computed(() => systemOf(systemId.value));

/** 分页。用 `LIMIT/OFFSET` 而不是全量拉取——单次查询上限 2000 行。 */
const PAGE_SIZE = 200;
const page = ref(1);

const statement = computed(() => {
    if (system.value === undefined) {
        return null;
    }
    const table = system.value.yearTable;
    const offset = (page.value - 1) * PAGE_SIZE;
    // 表名来自登记表（不是用户输入），所以拼接是安全的
    return `SELECT * FROM "${table}" ORDER BY "start" LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
});

const countStatement = computed(() =>
    system.value === undefined ? null : `SELECT COUNT(*) AS n FROM "${system.value.yearTable}";`
);

const rows = useQuery(() => system.value?.module ?? "chronology", statement);
const total = useQuery(() => system.value?.module ?? "chronology", countStatement);

/** 总行数。 */
const totalRows = computed(() => Number(total.rows.value[0]?.n ?? 0));

/** 列：取第一行的键。SQLite 的 `SELECT *` 列顺序是建表顺序，稳定。 */
const columns = computed(() => Object.keys(rows.rows.value[0] ?? {}));

/** 页面状态。 */
const state = computed(() => {
    if (system.value === undefined) {
        return "empty" as const;
    }
    return rows.state.value;
});

watch(
    () => system.value?.label,
    (label) => {
        if (label !== undefined) {
            document.title = `${label}数据表 · 轩辕历法`;
        }
    },
    { immediate: true }
);

watch(systemId, () => {
    page.value = 1;
});

/** 长文本列（比如 `name`）左对齐，数字列右对齐靠 `tabular-nums`。 */
const isNumeric = (value: unknown): boolean => typeof value === "bigint" || typeof value === "number";
</script>

<template>
    <ElResult
        v-if="system === undefined"
        icon="warning"
        title="没有这套历法"
        :sub-title="`可用的有：${ALL_SYSTEMS.map((item) => item.label).join('、')}。`">
        <template #extra>
            <ElButton type="primary" @click="router.push('/calendar/natural')">去看轩辕历</ElButton>
        </template>
    </ElResult>

    <PageShell
        v-else
        :state="state"
        :error-text="rows.error.value"
        :card="false"
        :scroll="false"
        :loading-text="`正在读 ${system.yearTable}…`"
        source="22 个分库"
        @retry="rows.reload">
        <div class="table-page">
            <header class="table-page__head">
                <div>
                    <h1 class="table-page__title">{{ system.label }} · 数据表</h1>
                    <p class="table-page__sub">
                        <span class="numeral xy-chip">{{ system.module }}</span>
                        <span class="numeral xy-chip">{{ system.yearTable }}</span>
                        <span class="xy-dim numeral">{{ formatCount(totalRows) }} 行</span>
                    </p>
                </div>

                <ElButton text size="small" @click="router.push(`/calendar/${systemId}`)">
                    <AppIcon name="ArrowLeft" />
                    <span>回日历</span>
                </ElButton>
            </header>

            <div class="table-page__body">
                <ElTable :data="rows.rows.value" stripe height="100%" size="small" class="table-page__table">
                    <ElTableColumn
                        v-for="column in columns"
                        :key="column"
                        :prop="column"
                        :label="column"
                        :min-width="column === 'name' || column === 'label' ? 120 : 96"
                        :align="isNumeric(rows.rows.value[0]?.[column]) ? 'right' : 'left'"
                        :class-name="isNumeric(rows.rows.value[0]?.[column]) ? 'numeral' : ''"
                        show-overflow-tooltip />
                </ElTable>
            </div>

            <!-- 分页条也挂遮罩：点了页码时"表格在转"就够，但它自己也要有反应 -->
            <footer v-loading="state === 'loading'" class="table-page__foot">
                <ElPagination
                    v-model:current-page="page"
                    :page-size="PAGE_SIZE"
                    :total="totalRows"
                    layout="prev, pager, next, jumper, total"
                    :pager-count="7"
                    background />
            </footer>
        </div>
    </PageShell>
</template>

<style scoped>
.table-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.table-page__head {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    justify-content: space-between;
    padding: 10px 16px;
}

.table-page__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.table-page__sub {
    align-items: center;
    display: flex;
    gap: 6px;
    margin: 4px 0 0;
}

.table-page__body {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex: 1;
    margin: 12px;
    min-height: 0;
    overflow: hidden;
}

.table-page__table {
    width: 100%;
}

.table-page__foot {
    flex-shrink: 0;
    padding: 0 12px 12px;
}
</style>
