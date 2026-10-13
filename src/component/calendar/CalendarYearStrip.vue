<script setup lang="ts">
/**
 * 年视图：十二个月的迷你条。
 *
 * ## 为什么不是"12 个月平铺的大格"
 *
 * 研究里对这个做法的抱怨是具体且一致的：12 个月挤在一屏，每格只剩一行的高度，
 * 农历与节气的第二行**全部被截断**。而截断的历法数字在历法里等于错误
 * （"廿三"被截成"廿"）。
 *
 * 所以年视图换一个任务：它回答的是**"这一年哪几个月有闰、节气落在哪一带"**，
 * 不是"读某一天"。每月一条 31 格的细条，每格一个点——这正是
 * Tufte 说的"用长度与位置编码数量"，而不是把月视图缩小。
 *
 * ## 日期**不在这里算**
 *
 * 一个月有几天、从星期几开始，全部由 `facts` 里有什么决定——`facts` 来自
 * `temporal` 表（原因见 `share/calendar/gregorian.ts` 的文件头）。
 * 这里只做"把已有的日期摆成 31 列的网格"，不做任何日历运算。
 */

import { computed } from "vue";

import {
    MONTH_NAMES,
    WEEKDAY_NAMES,
    daysOfAbsolute,
    formatYear,
    keyOfCivil,
    weekdayOfDays
} from "../../share/calendar/gregorian";
import type { DayFacts } from "../../state/use-day-facts";

interface Props {
    /** 公历年（天文纪年） */
    year: number;
    /** 每天的历法事实 */
    facts: Map<string, DayFacts>;
    /** 选中的那一天 */
    selected: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 点某个月 → 跳回月视图 */
    pickMonth: [month: number];
    /** 点某一天 */
    select: [key: string];
}>();

/**
 * 十二个月的结构。
 *
 * 只从 `facts` 里挑出属于这一年的日子、按月分桶。**不生成**任何日期——
 * 库里没有的日子（例如公历改历跳过的那十天）就不该出现，
 * 这也是为什么不能按时长硬铺 31 格。
 */
const months = computed(() =>
    Array.from({ length: 12 }, (_unused, index) => {
        const month = index + 1;
        const days = [...props.facts.values()]
            .filter((day) => day.year === props.year && day.month === month)
            .sort((left, right) => left.day - right.day);

        const first = days[0];

        return {
            month,
            name: MONTH_NAMES[index],
            /** 月首是周几；没有数据时为 0 */
            lead: first === undefined ? 0 : weekdayOfDays(daysOfAbsolute(first.absolute)),
            days: days.map((day) => ({
                day: day.day,
                key: keyOfCivil(day.year, day.month, day.day),
                termBegins: day.solarTermBegins,
                monthBegins: day.lunarDay === "初一",
                term: day.solarTerm
            })),
            termCount: days.filter((day) => day.solarTermBegins).length,
            /** 这个月里出现过闰月 */
            leap: days.some((day) => day.lunarMonth?.startsWith("闰") === true)
        };
    })
);

/** 这一年出现的闰月数。 */
const leapMonths = computed(() => {
    const seen = new Set<number>();
    for (const day of props.facts.values()) {
        if (day.year === props.year && day.lunarMonth?.startsWith("闰") === true && day.monthIndex !== null) {
            seen.add(day.monthIndex);
        }
    }
    return seen.size;
});

/** 这一年库里有多少天。 */
const dayCount = computed(() => [...props.facts.values()].filter((day) => day.year === props.year).length);
</script>

<template>
    <div class="strip">
        <header class="strip__head">
            <h2 class="strip__title numeral">{{ formatYear(props.year) }}</h2>
            <p class="strip__meta">
                <span v-if="leapMonths > 0" class="strip__leap">闰 {{ leapMonths }} 个月</span>
                <span v-else>无闰月</span>
                <span class="xy-dim numeral">· 库内 {{ dayCount }} 天</span>
                <span class="xy-dim">· 一月一条，每格一天；绿点交节、蓝点月首</span>
            </p>
        </header>

        <ElScrollbar class="strip__scroll">
            <div class="strip__months">
                <div v-for="month in months" :key="month.month" class="strip__month">
                    <button
                        type="button"
                        class="strip__month-name"
                        :class="{ 'is-leap': month.leap }"
                        :title="`跳到 ${month.name}`"
                        @click="emit('pickMonth', month.month)">
                        {{ month.name }}
                    </button>

                    <div class="strip__grid">
                        <span v-for="slot in month.lead" :key="`lead-${slot}`" class="strip__day is-blank" />

                        <button
                            v-for="day in month.days"
                            :key="day.key"
                            type="button"
                            class="strip__day"
                            :class="{
                                'is-selected': day.key === props.selected,
                                'is-term': day.termBegins,
                                'is-month': day.monthBegins
                            }"
                            :title="`${month.month} 月 ${day.day} 日 ${day.term ?? ''}`.trim()"
                            @click="emit('select', day.key)">
                            <span class="strip__day-num numeral">{{ day.day }}</span>
                            <i v-if="day.termBegins" class="strip__dot strip__dot--term" aria-hidden="true" />
                            <i v-else-if="day.monthBegins" class="strip__dot strip__dot--month" aria-hidden="true" />
                        </button>
                    </div>

                    <span class="strip__term-count xy-dim numeral">{{ month.termCount }} 气</span>
                </div>

                <!-- 星期表头：贴在月份条上方，与格子的第 1–7 列对齐 -->
                <div class="strip__weekdays" aria-hidden="true">
                    <span v-for="name in WEEKDAY_NAMES" :key="name" class="strip__weekday">{{ name }}</span>
                </div>
            </div>
        </ElScrollbar>
    </div>
</template>

<style scoped>
.strip {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.strip__head {
    border-bottom: 1px solid var(--xy-hairline);
    flex-shrink: 0;
    padding: 10px 14px;
}

.strip__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.strip__meta {
    color: var(--el-text-color-secondary);
    display: flex;
    flex-wrap: wrap;
    font-size: var(--xy-font-xs);
    gap: 6px;
    margin: 3px 0 0;
}

.strip__leap {
    color: var(--el-color-warning);
    font-weight: var(--xy-weight-medium);
}

.strip__scroll {
    flex: 1;
    min-height: 0;
}

.strip__months {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 18px 14px 16px;
    position: relative;
}

.strip__month {
    align-items: center;
    display: grid;
    gap: 8px;
    /* 月名 / 格子 / 计数 三列；格子那一列自适应 */
    grid-template-columns: 52px 1fr 40px;
}

.strip__month-name {
    background: transparent;
    border: none;
    border-radius: var(--xy-radius-sm);
    color: var(--el-text-color-secondary);
    cursor: pointer;
    font-size: var(--xy-font-xs);
    padding: 2px 0;
    text-align: right;
}

.strip__month-name:hover {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
}

.strip__month-name.is-leap {
    color: var(--el-color-warning);
    font-weight: var(--xy-weight-semibold);
}

.strip__grid {
    display: grid;
    gap: 1px;
    /* 固定 31 列：日期因此**竖直对齐**，这是能一眼扫出"闰月在哪"的前提 */
    grid-template-columns: repeat(31, minmax(0, 1fr));
}

.strip__day {
    align-items: center;
    aspect-ratio: 1;
    background: var(--el-fill-color-lighter);
    border: none;
    border-radius: 2px;
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-height: 22px;
    padding: 0;
    position: relative;
}

.strip__day.is-blank {
    background: transparent;
    cursor: default;
}

.strip__day:hover:not(.is-blank) {
    background: var(--el-color-primary-light-7);
}

.strip__day.is-selected {
    background: var(--el-color-primary);
}

.strip__day.is-selected .strip__day-num {
    color: #fff;
}

.strip__day.is-term {
    background: var(--el-color-success-light-8);
}

.strip__day.is-month {
    background: var(--el-color-primary-light-8);
}

.strip__day-num {
    font-size: 9px;
    line-height: 1;
}

.strip__dot {
    border-radius: 50%;
    height: 3px;
    position: absolute;
    top: 1px;
    width: 3px;
}

.strip__dot--term {
    background: var(--el-color-success);
}

.strip__dot--month {
    background: var(--el-color-primary);
}

.strip__term-count {
    text-align: right;
}

/*
 * 星期表头：贴在月份条上方，与格子的第 1–7 列对齐。
 * 用 absolute 而不是 grid 里的第四列——它会破坏 `31` 列的宽度分配。
 */
.strip__weekdays {
    display: grid;
    gap: 1px;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    left: 74px;
    position: absolute;
    top: 2px;
    width: calc((100% - 74px - 40px - 16px) * 7 / 31);
}

.strip__weekday {
    color: var(--el-text-color-placeholder);
    font-size: 9px;
    text-align: center;
}
</style>
