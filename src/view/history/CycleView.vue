<script setup lang="ts">
/**
 * 皇极经世周期表：`/history/cycle`。
 *
 * ## 这一页要回答的问题
 *
 * 邵雍《皇极经世》把时间编成 **元会运世** 四级：
 * `1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望年`，而 `1 世 = 30 朔望年`。
 * 用户要的是"**现在处在哪一元哪一会**"，以及"这个周期有多长"。
 *
 * ## 为什么用长度条而不是数字表
 *
 * 一个元有 129,600 年。写成数字，用户读不出"我们离元末还有多远"；
 * 画成四条同心的进度条（元 → 会 → 运 → 世），一眼就能看出位置。
 * 这正是 Tufte 说的"用长度与位置编码数量"。
 *
 * ## 数据来自 `primary` 表
 *
 * `primary.sqlite` 只有几行（元 / 会 / 运 三级），是**结构**而不是逐条记录；
 * 具体的"哪一年属于哪一元"由 `entity/cell-labels.ts` 的 `epochCycle()` 算——
 * 那是纯整数除法，不需要查表（每级都是上一级整除，没有例外）。
 */

import { computed } from "vue";

import PageShell from "../../component/PageShell.vue";
import { epochCycle, formatEpochCycle } from "../../entity/cell-labels";
import { useQuery, formatCount } from "../../state/use-calendar-query";

/** 结构表：元 / 会 / 运 各一行。 */
const units = useQuery("primary", 'SELECT * FROM "primary" ORDER BY "identity";');

/** 行度表：五体的行度，用于说明"一元走多少度"。 */
const performs = useQuery("perform", 'SELECT * FROM "perform" ORDER BY "identity" LIMIT 80;');

/**
 * 当前所处的周期。
 *
 * 朔望年序号 = 从建元那年算起的第几年。库里第一个朔望年是 `-9999`，
 * 而建元是 `-2696`，所以"建元当年的序号"是 `-2696 - (-9999) + 1 = 7304`。
 * 这个偏移写成常量而不是每次算：它是库的构建口径（`source.YEAR_INDEX_OFFSET`）。
 */
const EPOCH_YEAR_INDEX = 7304;

/** 今天的朔望年序号（近似到年即可，这一页关心的是万年级的周期）。 */
const currentYearIndex = EPOCH_YEAR_INDEX + (new Date().getFullYear() + 2696);

const cycle = computed(() => epochCycle(currentYearIndex));

/** 四级周期。每一级的"已完成比例"用长度条表达。 */
const levels = computed(() => {
    const value = cycle.value;
    return [
        {
            label: "元",
            unit: "129,600 朔望年",
            position: value.yuan,
            total: 1,
            fraction: 1,
            note: "一元 = 12 会 = 360 运 = 4320 世"
        },
        {
            label: "会",
            unit: "10,800 朔望年",
            position: value.hui,
            total: 12,
            fraction: (value.hui - 1) / 12,
            note: "一会 = 30 运 = 360 世"
        },
        {
            label: "运",
            unit: "360 朔望年",
            position: value.yun,
            total: 360,
            fraction: (value.yun - 1) / 360,
            note: "一运 = 12 世"
        },
        {
            label: "世",
            unit: "30 朔望年",
            position: value.shi,
            total: 4320,
            fraction: (value.shi - 1) / 4320,
            note: "一世 = 30 朔望年；这是本库 `epoch_chronologies` 的分组粒度"
        }
    ];
});

/** 结构表列。 */
const columns = computed(() => Object.keys(units.rows.value[0] ?? {}));
const performColumns = computed(() => Object.keys(performs.rows.value[0] ?? {}));

const NumericPattern = /^(identity|relative|absolute|start|end|lengthOf.*)$/;
const isNumeric = (column: string): boolean => NumericPattern.test(column);
const cellOf = (row: Record<string, unknown>, column: string): string => {
    const value = row[column];
    return value === null || value === undefined ? "—" : String(value);
};
</script>

<template>
    <PageShell
        :state="units.state.value"
        :error-text="units.error.value"
        :card="false"
        :scroll="true"
        source="src/sqlite/primary.sqlite"
        empty-text="primary 分库还没构建"
        @retry="units.reload">
        <div class="cycle">
            <section class="cycle__hero">
                <p class="cycle__hero-label">此刻</p>
                <h1 class="cycle__hero-value numeral">{{ formatEpochCycle(cycle) }}</h1>
                <p class="cycle__hero-sub">
                    朔望年第 <span class="numeral">{{ formatCount(currentYearIndex) }}</span> 年 ·
                    建元 前 2697 年 3 月 11 日 起算
                </p>
            </section>

            <!-- 四级长度条：位置即答案 -->
            <section class="cycle__levels">
                <div v-for="level in levels" :key="level.label" class="cycle__level">
                    <div class="cycle__level-head">
                        <span class="cycle__level-name">{{ level.label }}</span>
                        <span class="cycle__level-pos numeral">
                            第 {{ formatCount(level.position) }} / {{ formatCount(level.total) }}
                        </span>
                        <span class="xy-dim numeral">{{ level.unit }}</span>
                    </div>
                    <div class="cycle__bar" role="img" :aria-label="`${level.label} ${level.position} / ${level.total}`">
                        <div class="cycle__fill" :style="{ width: `${Math.max(0.5, level.fraction * 100)}%` }" />
                    </div>
                    <p class="xy-dim cycle__level-note">{{ level.note }}</p>
                </div>
            </section>

            <section class="cycle__panel">
                <h2 class="xy-panel-title">周期结构</h2>
                <p class="xy-note">
                    `primary` 分库只有几行——它存的是**结构**（元 / 会 / 运 三级），
                    不是逐条记录。"某一年属于哪一元"由整数除法直接算出，不需要查表。
                </p>
                <ElTable :data="units.rows.value" stripe size="small" class="cycle__table">
                    <ElTableColumn
                        v-for="column in columns"
                        :key="column"
                        :prop="column"
                        :label="column"
                        min-width="110"
                        :align="isNumeric(column) ? 'right' : 'left'"
                        :class-name="isNumeric(column) ? 'numeral' : ''">
                        <template #default="{ row }">{{ cellOf(row, column) }}</template>
                    </ElTableColumn>
                </ElTable>
            </section>

            <section class="cycle__panel">
                <h2 class="xy-panel-title">行度</h2>
                <p class="xy-note">
                    五体的行度：把"一元"分摊到日月五星上，是一元之内天象重复的依据。
                </p>
                <ElTable :data="performs.rows.value" stripe size="small" max-height="320" class="cycle__table">
                    <ElTableColumn
                        v-for="column in performColumns"
                        :key="column"
                        :prop="column"
                        :label="column"
                        min-width="110"
                        :align="isNumeric(column) ? 'right' : 'left'"
                        :class-name="isNumeric(column) ? 'numeral' : ''">
                        <template #default="{ row }">{{ cellOf(row, column) }}</template>
                    </ElTableColumn>
                </ElTable>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.cycle {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-bottom: 8px;
}

.cycle__hero {
    background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color));
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: var(--xy-radius-lg);
    padding: 18px 20px;
}

.cycle__hero-label {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    letter-spacing: 0.1em;
    margin: 0;
}

.cycle__hero-value {
    color: var(--el-color-primary);
    font-size: var(--xy-font-3xl);
    font-weight: var(--xy-weight-semibold);
    letter-spacing: 0.02em;
    margin: 4px 0 2px;
}

.cycle__hero-sub {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    margin: 0;
}

.cycle__levels {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.cycle__level {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.cycle__level-head {
    align-items: baseline;
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
}

.cycle__level-name {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
}

.cycle__level-pos {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-sm);
}

.cycle__bar {
    background: var(--el-fill-color);
    border-radius: var(--xy-radius-pill);
    height: 8px;
    overflow: hidden;
}

.cycle__fill {
    background: var(--el-color-primary);
    border-radius: var(--xy-radius-pill);
    height: 100%;
    transition: width var(--xy-duration-base) var(--xy-ease);
}

.cycle__level-note {
    margin: 6px 0 0;
}

.cycle__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.cycle__table {
    margin-top: 8px;
    width: 100%;
}
</style>
