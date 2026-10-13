<script setup lang="ts">
/**
 * 朝代与年号：`/history/dynasty`。
 *
 * 两张表并排：左边朝代（89 行），右边年号（1,184 行）。
 * 分栏而不是上下堆叠，是因为它们要**对看**——"这个朝代有哪些年号"是一个动作，
 * 不是两次滚动。
 */

import { computed, ref } from "vue";


import { useQuery, formatCount } from "../../state/use-calendar-query";

/** 左栏：朝代。 */
const dynasties = useQuery("dynasty", 'SELECT * FROM "dynasty" ORDER BY "start" LIMIT 200;');
const dynastyTotal = useQuery("dynasty", 'SELECT COUNT(*) AS n FROM "dynasty";');

/** 右栏：年号。按朝代的 `identity` 过滤，没选朝代时全出。 */
const picked = ref<number | null>(null);

const eraStatement = computed(() =>
    picked.value === null
        ? 'SELECT * FROM "era" ORDER BY "start" LIMIT 300;'
        : `SELECT * FROM "era" WHERE "dynasty" = ${picked.value} ORDER BY "start" LIMIT 300;`
);

const eras = useQuery("era", eraStatement);
const eraTotal = useQuery("era", 'SELECT COUNT(*) AS n FROM "era";');

const dynastiesColumns = computed(() => Object.keys(dynasties.rows.value[0] ?? {}));
const erasColumns = computed(() => Object.keys(eras.rows.value[0] ?? {}));

const NumericPattern = /^(identity|relative|absolute|start|end|dynasty|era|person|year|month|day|lengthOf.*)$/;
const isNumeric = (column: string): boolean => NumericPattern.test(column);
const cellOf = (row: Record<string, unknown>, column: string): string => {
    const value = row[column];
    return value === null || value === undefined ? "—" : String(value);
};
</script>

<template>
    <div class="dyn">
        <header class="dyn__head">
            <div>
                <h1 class="dyn__title">朝代与年号</h1>
                <p class="dyn__note">
                    年号**允许重叠**——三国、十六国、辽宋金夏都同时有多个年号在行用。
                    所以这里不做"一个朝代一个年号"的简化，点朝代筛右栏即可。
                </p>
            </div>
            <div class="dyn__meta">
                <span class="xy-dim numeral">朝代 {{ formatCount(Number(dynastyTotal.rows.value[0]?.n ?? 0)) }}</span>
                <span class="xy-dim numeral">年号 {{ formatCount(Number(eraTotal.rows.value[0]?.n ?? 0)) }}</span>
            </div>
        </header>

        <div class="dyn__body">
            <section class="dyn__col">
                <h2 class="xy-panel-title">
                    朝代
                    <ElButton v-if="picked !== null" text size="small" @click="picked = null">清除筛选</ElButton>
                </h2>
                <div class="dyn__table">
                    <ElTable
                        :data="dynasties.rows.value"
                        stripe
                        height="100%"
                        size="small"
                        highlight-current-row
                        @current-change="(row: Record<string, unknown> | null) => (picked = row === null ? null : Number(row.identity))">
                        <ElTableColumn
                            v-for="column in dynastiesColumns"
                            :key="column"
                            :prop="column"
                            :label="column"
                            :min-width="column === 'name' || column === 'label' ? 130 : 96"
                            :align="isNumeric(column) ? 'right' : 'left'"
                            :class-name="isNumeric(column) ? 'numeral' : ''"
                            show-overflow-tooltip>
                            <template #default="{ row }">{{ cellOf(row, column) }}</template>
                        </ElTableColumn>
                    </ElTable>
                </div>
            </section>

            <section class="dyn__col">
                <h2 class="xy-panel-title">
                    年号
                    <span v-if="picked !== null" class="xy-dim">（已筛：朝代 {{ picked }}）</span>
                </h2>
                <div class="dyn__table">
                    <ElTable :data="eras.rows.value" stripe height="100%" size="small">
                        <ElTableColumn
                            v-for="column in erasColumns"
                            :key="column"
                            :prop="column"
                            :label="column"
                            :min-width="column === 'name' || column === 'label' ? 130 : 96"
                            :align="isNumeric(column) ? 'right' : 'left'"
                            :class-name="isNumeric(column) ? 'numeral' : ''"
                            show-overflow-tooltip>
                            <template #default="{ row }">{{ cellOf(row, column) }}</template>
                        </ElTableColumn>
                    </ElTable>
                </div>
            </section>
        </div>
    </div>
</template>

<style scoped>
.dyn {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.dyn__head {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 10px 16px;
}

.dyn__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.dyn__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 72ch;
}

.dyn__meta {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 10px;
}

.dyn__body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
    padding: 12px;
}

.dyn__col {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    padding: 10px 12px;
}

.dyn__table {
    flex: 1;
    min-height: 0;
}
</style>
