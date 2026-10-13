<script setup lang="ts">
/**
 * 通用的分库数据表页：给定分库、表名与标题，渲染一张可分页的真实表格。
 *
 * ## 为什么值得抽出来
 *
 * 剩下的页面里有一大半形状相同：**一张真实表格 + 一句口径说明**。
 * 朝代表、年号表、事件表、人物表、建元表、五行行度表……
 * 各写一个 `.vue` 就是二十份拷贝，而它们的差异只有"读哪张表、显示哪些列"。
 *
 * 抽出来还有第二个好处：**列是从库里读出来的**（`PRAGMA table_info`），
 * 所以表结构变了页面自动跟上，不会出现"界面里写死的列名与库对不上"。
 *
 * ## 列宽与对齐按列名推
 *
 * 数字列（`identity` / `start` / `end` / `absolute` / `relative` / 以 `lengthOf` 开头）
 * 右对齐并用等宽数字；其余左对齐。这不是美观问题——历表里一列数字左对齐时，
 * 位数不同的值会让小数点错位，扫视时读不出量级。
 */

import { computed, ref, watch } from "vue";

import PageShell from "../PageShell.vue";
import { useQuery, formatCount } from "../../state/use-calendar-query";
import { useModuleStates } from "../../state/use-calendar-query";

interface Props {
    /** 分库模块名（22 个之一） */
    module: string;
    /** 表名 */
    table: string;
    /** 页标题 */
    title: string;
    /** 一句话说明：这张表回答什么问题、口径是什么 */
    note?: string;
    /** 每页行数 */
    pageSize?: number;
    /** 排序表达式（SQL 片段），默认按 `identity` */
    order?: string;
    /** 只显示这些列；不传则显示全部 */
    only?: readonly string[];
}

const props = withDefaults(defineProps<Props>(), {
    note: "",
    pageSize: 200,
    order: '"identity"',
    only: undefined
});

const page = ref(1);

/** 单次查询上限是 2000 行（`shared/calendar-api.ts`），分页取用。 */
const size = computed(() => Math.min(props.pageSize, 2000));

const rowsStatement = computed(() => {
    const offset = (page.value - 1) * size.value;
    // 表名与排序都来自调用方（不是用户输入），所以拼接安全
    return `SELECT * FROM "${props.table}" ORDER BY ${props.order} LIMIT ${size.value} OFFSET ${offset};`;
});

const countStatement = computed(() => `SELECT COUNT(*) AS n FROM "${props.table}";`);

const rows = useQuery(() => props.module, rowsStatement);
const total = useQuery(() => props.module, countStatement);

/** 总行数。 */
const totalRows = computed(() => Number(total.rows.value[0]?.n ?? 0));

/** 列名：取第一行的键，按 `only` 过滤。 */
const columns = computed(() => {
    const keys = Object.keys(rows.rows.value[0] ?? {});
    return props.only === undefined ? keys : keys.filter((key) => props.only?.includes(key) === true);
});

/** 数字列：右对齐 + 等宽。 */
const NumericPattern = /^(identity|relative|absolute|start|end|days|seconds|year|month|day|hour|minute|second|lengthOf.*|.*_id|.*Id)$/;

const isNumeric = (column: string): boolean => NumericPattern.test(column);

/** 单元格的值：`bigint` 直接显示会带 `n`，要转成字符串。 */
const cellOf = (row: Record<string, unknown>, column: string): string => {
    const value = row[column];
    if (value === null || value === undefined) {
        return "—";
    }
    return String(value);
};

/** 换表或换分库时回到第一页。 */
watch(
    () => [props.module, props.table],
    () => {
        page.value = 1;
    }
);

/** 分库在线状态，用于空态说明。 */
const { states } = useModuleStates();
const present = computed(() => states.value.find((item) => item.name === props.module)?.present ?? null);
</script>

<template>
    <PageShell
        :state="rows.state.value"
        :error-text="rows.error.value"
        :card="false"
        :scroll="false"
        :loading-text="`正在读 ${props.module}.${props.table}…`"
        :source="`src/sqlite/${props.module}`"
        :empty-text="
            present === false
                ? `${props.module}.sqlite 还没构建，先运行 python scripts/database/initialise.py`
                : `表 ${props.table} 里没有行`
        "
        @retry="rows.reload">
        <div class="dt">
            <header class="dt__head">
                <div>
                    <h1 class="dt__title">{{ props.title }}</h1>
                    <p v-if="props.note.length > 0" class="dt__note">{{ props.note }}</p>
                </div>

                <div class="dt__meta">
                    <span class="numeral xy-chip">{{ props.module }}</span>
                    <span class="numeral xy-chip">{{ props.table }}</span>
                    <span class="xy-dim numeral">{{ formatCount(totalRows) }} 行</span>
                </div>
            </header>

            <div class="dt__body">
                <ElTable :data="rows.rows.value" stripe height="100%" size="small" class="dt__table">
                    <ElTableColumn
                        v-for="column in columns"
                        :key="column"
                        :prop="column"
                        :label="column"
                        :min-width="column === 'name' || column === 'label' || column === 'title' ? 140 : 104"
                        :align="isNumeric(column) ? 'right' : 'left'"
                        :class-name="isNumeric(column) ? 'numeral' : ''"
                        show-overflow-tooltip>
                        <template #default="{ row }">{{ cellOf(row, column) }}</template>
                    </ElTableColumn>
                </ElTable>
            </div>

            <footer class="dt__foot">
                <ElPagination
                    v-model:current-page="page"
                    :page-size="size"
                    :total="totalRows"
                    layout="prev, pager, next, jumper, total"
                    :pager-count="7"
                    background />
            </footer>
        </div>
    </PageShell>
</template>

<style scoped>
.dt {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.dt__head {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 10px 16px;
}

.dt__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.dt__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 70ch;
}

.dt__meta {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 6px;
}

.dt__body {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex: 1;
    margin: 12px;
    min-height: 0;
    overflow: hidden;
}

.dt__table {
    width: 100%;
}

.dt__foot {
    flex-shrink: 0;
    padding: 0 12px 12px;
}
</style>
