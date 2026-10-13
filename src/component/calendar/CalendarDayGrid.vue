<script setup lang="ts">
/**
 * 历法日历：**八套历法共用的同一个日历**，差异只在每一格里画什么。
 *
 * ## 为什么用 `ElCalendar` 而不是自己写网格
 *
 * 它的 `date-cell` 插槽把"这一格是哪一天"算好了交给我们（`{ date, data }`），
 * 我们只负责画。自己写网格要重新处理月首空几格、闰年 2 月、1582 年的十天断层、
 * 键盘方向键在格子间移动、`aria-*` 的行列语义——这些都不是本项目的价值所在。
 *
 * 代价是 `range` 限制在两个月内，做不了"12 个月平铺"那种年视图。
 * 所以年视图不是放大版的月视图，而是**另一块视图**（见 `CalendarYearStrip`）：
 * 12 个月的迷你条。研究里被反复抱怨的正是"12 个月挤在一屏，每格只剩 44pt 高，
 * 农历与节气的第二行全被截断"。
 *
 * ## 日期只有两个来源，界面不编
 *
 * - **格子是哪一天**：`ElCalendar` 按公历算（它就是公历日历）；
 * - **这一天有什么**：`facts`，来自 `temporal` 与四张历法表。
 *
 * 界面**不把日期换算成 `absolute`**——那个换算必须走库（原因见
 * `share/calendar/gregorian.ts` 的文件头）。网格靠 `Date`，内容靠 `facts`,
 * 两边的键都是 `YYYY-MM-DD`。
 *
 * ## 每格三行，每行角色固定
 *
 * | 行 | 内容                                       | 层级       |
 * | -- | ------------------------------------------ | ---------- |
 * | ① | 公历日                                     | 最大最深   |
 * | ② | 本历主行（农历日 / 干支 / 节气…）          | 主色       |
 * | ③ | 当日标记：交节 > 月相节点 > 日干支         | 次要       |
 *
 * 第③行是关键：节气和月相在库里都是**段**（各覆盖 ~15 天与 ~7 天），每天都写
 * 就会整月重复同一行字，而真正每天在变的日干支被挤掉。所以只有"这一天是那一段
 * 的第一天"才写它，其余日子写日干支。
 */

import { computed } from "vue";

import type { CalendarPageSpec, CellContext } from "../../entity/calendar-page";
import type { DayFacts } from "../../state/use-day-facts";
import type { SystemMoment } from "../../state/use-system-calendar";
import { dayLabelOf } from "../../state/use-system-calendar";
import { daySexagenaryIndex, sexagenary } from "../../share/calendar/sexagenary";
import { WEEKDAY_NAMES, formatYear, keyOfCivil, weekdayOfDays, daysOfAbsolute } from "../../share/calendar/gregorian";
import AppIcon from "../AppIcon.vue";

interface Props {
    /** 这套历法的界面规格 */
    spec: CalendarPageSpec;
    /** 当前显示的月（只用到年月，日固定为 1） */
    modelValue: Date;
    /** 历法 id，用于决定格子里的日名怎么写 */
    systemId: string;
    /** 这套历法自己的年月（来自各自的 `*_year` / `*_month` 表） */
    systemMoment: SystemMoment | null;
    /** 每一天的事实，键是 `YYYY-MM-DD` */
    facts: Map<string, DayFacts>;
    /** 选中的公历日；`null` 表示还没选 */
    selected: string | null;
    /** 今天所在的那一天（`YYYY-MM-DD`）；解析不出来时为空串 */
    todayKey: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 月份变了 */
    "update:modelValue": [value: Date];
    /** 选了某一天 */
    select: [key: string];
    /** 用户双击某一天，表示"深入看这一天" */
    open: [key: string];
}>();

/** 当前年月。 */
const year = computed(() => props.modelValue.getFullYear());
const month = computed(() => props.modelValue.getMonth() + 1);

const monthTitle = computed(() => `${formatYear(year.value)}${month.value} 月`);

/** 一格的上下文。 */
function contextOf(date: Date): CellContext {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const key = keyOfCivil(y, m, d);
    const facts = props.facts.get(key) ?? null;

    return {
        year: y,
        month: m,
        day: d,
        weekday: date.getDay(),
        absolute: facts?.absolute ?? 0n,
        monthIndex: facts?.monthIndex ?? null,
        lunarDay: facts?.lunarDay ?? null,
        lunarMonth: facts?.lunarMonth ?? null,
        phase: facts?.phase ?? null,
        phaseBegins: facts?.phaseBegins ?? false,
        solarTerm: facts?.solarTerm ?? null,
        solarTermBegins: facts?.solarTermBegins ?? false,
        dayStemBranch: facts === null ? "" : sexagenary(daySexagenaryIndex(daysOfAbsolute(facts.absolute))),
        yearStemBranch: facts?.yearStemBranch ?? ""
    };
}

/** 今天是不是这一格。 */
const isToday = (date: Date): boolean => keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()) === props.todayKey;

/** 选中的是不是这一格。 */
const isSelected = (date: Date): boolean =>
    keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()) === props.selected;

/* -------------------------------------------------------------------------- */
/* 时光机                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 上一个月 / 下一个月。
 *
 * 先把日设为 1 再换月：否则 1 月 31 日加一个月会变成 3 月 3 日。
 * 这里用 `Date` 的月份运算而不是加减 30 天——**网格本身就是公历**，
 * 让 `Date` 处理它最稳；至于库里那套自己的年月日规则，只影响格子里的标注。
 */
/**
 * 格子的主行：**本历这个月的第几天**。
 *
 * 八套历法的月长不同（朔望历 29/30 天、节气 15 天、木星 361 天），
 * 所以同一个公历日在不同历法里落在"第几天"是不同的数——这正是它们的区别。
 * 日名的写法也按各历习惯：月相历用农历日名（初一、初二…），
 * 其余用"第 N 日"，月首那一格写本历的月名。
 *
 * 落在**本历这个月之外**的格子（`ElCalendar` 会铺上月尾与下月头）写空，
 * 因为那些天属于相邻的月，写"第 N 日"会与真实的月内序号冲突。
 */
const primaryOf = (date: Date): string => {
    const moment = props.systemMoment;
    if (moment === null) {
        return props.spec.primary(contextOf(date));
    }
    const key = keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const facts = props.facts.get(key);
    if (facts === undefined) {
        return "";
    }
    if (facts.absolute < moment.monthStart || facts.absolute > moment.monthEnd) {
        return "";
    }
    const day = Number((facts.absolute - moment.monthStart) / 86_400n) + 1;
    /*
     * 传农历日与公历日：当"本历第几天"与公历日相等时（格里高利历、回归历），
     * 第二行改显示农历日，否则会显示成 `10 / 10` 这样没有信息量的重复。
     */
    return dayLabelOf(props.systemId, day, moment.monthName, facts.lunarDay, date.getDate());
};

/** 这一格是不是本历这个月的第一天。 */
const startsSystemMonth = (date: Date): boolean => {
    const moment = props.systemMoment;
    if (moment === null) {
        return false;
    }
    const facts = props.facts.get(keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    return facts !== undefined && facts.absolute === moment.monthStart;
};

/**
 * 这一格是不是落在**本历这个月之外**。
 *
 * `ElCalendar` 按公历月铺格子，而本历的月与公历月不对齐——所以一个公历月里
 * 总有一部分天属于相邻的本历月。那些日子要淡化：它们的"第 N 日"属于别的月，
 * 与这个月的序号连不上。
 */
const isOutsideSystemMonth = (date: Date): boolean => {
    const moment = props.systemMoment;
    if (moment === null) {
        return false;
    }
    const facts = props.facts.get(keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    return facts !== undefined && (facts.absolute < moment.monthStart || facts.absolute > moment.monthEnd);
};

/** 这一格是不是本历这个月的最后一天。 */
const endsSystemMonth = (date: Date): boolean => {
    const moment = props.systemMoment;
    if (moment === null) {
        return false;
    }
    const facts = props.facts.get(keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    return facts !== undefined && facts.absolute === moment.monthEnd - 86_399n;
};
const shiftMonth = (delta: number): void => {
    const next = new Date(props.modelValue.getTime());
    next.setDate(1);
    next.setMonth(next.getMonth() + delta);
    emit("update:modelValue", next);
};

/** 回到今天。 */
const goToday = (): void => {
    if (props.todayKey.length === 0) {
        return;
    }
    const [y, m] = props.todayKey.split("-").map(Number);
    const next = new Date(props.modelValue.getTime());
    next.setFullYear(y ?? 2000, (m ?? 1) - 1, 1);
    emit("update:modelValue", next);
};

/**
 * 键盘：`ElCalendar` 自己没有方向键导航。
 *
 * 键位沿用被验证过的那套（Fantastical 的语法）：裸箭头 = 换月，`T` = 今天。
 * 刻意的不对称：最常做的是翻月，最不该误触的是改选中日。
 */
const onKeydown = (event: KeyboardEvent): void => {
    const tag = (event.target as HTMLElement | null)?.tagName ?? "";
    if (tag === "INPUT" || tag === "TEXTAREA") {
        return;
    }
    if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftMonth(-1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftMonth(1);
    } else if (event.key.toLowerCase() === "t" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        goToday();
    }
};

/* -------------------------------------------------------------------------- */
/* 选中与详情                                                                  */
/* -------------------------------------------------------------------------- */

const selectedFacts = computed(() =>
    props.selected === null ? null : (props.facts.get(props.selected) ?? null)
);

const selectedLabel = computed(() => {
    if (props.selected === null) {
        return "";
    }
    const [y, m, d] = props.selected.split("-").map(Number);
    const weekday = selectedFacts.value === null ? "" : ` · 周${WEEKDAY_NAMES[weekdayOfDays(daysOfAbsolute(selectedFacts.value.absolute))]}`;
    return `${formatYear(y ?? 0)}${m ?? 0} 月 ${d ?? 0} 日${weekday}`;
});

const pick = (date: Date): void => {
    emit("select", keyOfCivil(date.getFullYear(), date.getMonth() + 1, date.getDate()));
};
</script>

<template>
    <div class="cal" tabindex="0" @keydown="onKeydown">
        <!-- 工具栏：时光机。视图切换在页头，见 CalendarSystemView 的说明 -->
        <div class="cal__bar">
            <div class="cal__nav">
                <ElButtonGroup>
                    <ElButton text aria-label="上一年" @click="shiftMonth(-12)">«</ElButton>
                    <ElButton text aria-label="上一月" @click="shiftMonth(-1)">
                        <AppIcon name="ArrowLeft" />
                    </ElButton>
                </ElButtonGroup>

                <span class="cal__title">
                    <span class="cal__title-system">{{ props.systemMoment?.monthName ?? "" }}</span>
                    <span class="cal__title-civil numeral">{{ monthTitle }}</span>
                </span>

                <ElButtonGroup>
                    <ElButton text aria-label="下一月" @click="shiftMonth(1)">
                        <AppIcon name="ArrowRight" />
                    </ElButton>
                    <ElButton text aria-label="下一年" @click="shiftMonth(12)">»</ElButton>
                </ElButtonGroup>

                <ElButton text size="small" class="cal__today" @click="goToday">今天</ElButton>
            </div>

            <div class="cal__legend">
                <!--
                    图例色块 + 文字。**只给色块不给文字**的图例在色觉障碍下等于没有，
                    而且用户记不住哪个颜色对应哪一层（recognition over recall）。
                -->
                <span class="cal__legend-item">
                    <i class="cal__swatch cal__swatch--primary" />
                    {{ props.spec.id === "natural" || props.spec.id === "synodic" ? "农历" : "本历" }}
                </span>
                <span class="cal__legend-item">
                    <i class="cal__swatch cal__swatch--term" />
                    节气
                </span>
                <span class="cal__legend-item">
                    <i class="cal__swatch cal__swatch--phase" />
                    月相
                </span>
                <span class="cal__legend-item">
                    <i class="cal__swatch cal__swatch--ganzhi" />
                    日干支
                </span>
            </div>
        </div>

        <div class="cal__body">
            <ElCalendar v-model="props.modelValue" class="cal__grid">
                <template #date-cell="{ data }">
                    <div
                        class="cal__cell"
                        :class="{
                            'is-today': isToday(data.date),
                            'is-selected': isSelected(data.date),
                            'is-outside': data.type !== 'current-month',
                            'is-term': contextOf(data.date).solarTermBegins,
                            'is-phase': contextOf(data.date).phaseBegins,
                            'is-month-start': startsSystemMonth(data.date),
                            'is-month-end': endsSystemMonth(data.date),
                            'is-other-month': isOutsideSystemMonth(data.date)
                        }"
                        @click="pick(data.date)"
                        @dblclick="emit('open', keyOfCivil(data.date.getFullYear(), data.date.getMonth() + 1, data.date.getDate()))">
                        <span class="cal__day numeral">{{ data.date.getDate() }}</span>

                        <!--
                            主行 = **本历这个月的第几天**。
                            八套历法的月长不同（朔望历 29/30 天、节气 15 天、木星 361 天），
                            所以同一个公历日在不同历法里的"第几天"是不同的数——
                            这正是它们的区别所在。日名按各历习惯写（农历日名 / 第 N 日）。
                        -->
                        <span class="cal__primary">{{ primaryOf(data.date) }}</span>

                        <span v-if="contextOf(data.date).solarTermBegins" class="cal__extra cal__extra--term">
                            {{ contextOf(data.date).solarTerm }}
                        </span>
                        <span v-else-if="contextOf(data.date).phaseBegins" class="cal__extra cal__extra--phase">
                            {{ contextOf(data.date).phase }}
                        </span>
                        <span v-else class="cal__extra cal__extra--ganzhi">
                            {{ contextOf(data.date).dayStemBranch }}
                        </span>

                        <!--
                            今天：实心圆点。用形状而不是文字，因为它要在一屏 42 格里
                            被瞬间找到，而文字会与格子里的其他数字混在一起。
                        -->
                        <i v-if="isToday(data.date)" class="cal__today-dot" aria-hidden="true" />
                    </div>
                </template>
            </ElCalendar>

            <!-- 详情条：选中某一天之后的完整事实 -->
            <aside class="cal__detail" :class="{ 'is-empty': props.selected === null }">
                <template v-if="props.selected !== null">
                    <h3 class="cal__detail-title numeral">{{ selectedLabel }}</h3>
                    <p class="cal__detail-relative">距建元 {{ Math.abs(Number((selectedFacts?.absolute ?? 0n) / 86_400n)) }} 天</p>

                    <dl class="cal__facts">
                        <div v-if="selectedFacts?.lunarMonth || selectedFacts?.lunarDay" class="cal__fact">
                            <dt>农历</dt>
                            <dd>{{ selectedFacts?.lunarMonth }}{{ selectedFacts?.lunarDay }}</dd>
                        </div>
                        <div v-if="selectedFacts?.solarTerm" class="cal__fact">
                            <dt>节气</dt>
                            <dd class="cal__fact--term">
                                {{ selectedFacts.solarTerm }}
                                <span v-if="selectedFacts.solarTermBegins" class="cal__fact-tag">交节</span>
                            </dd>
                        </div>
                        <div v-if="selectedFacts?.phase" class="cal__fact">
                            <dt>月相</dt>
                            <dd>
                                {{ selectedFacts.phase }}
                                <span v-if="selectedFacts.phaseBegins" class="cal__fact-tag">当日</span>
                            </dd>
                        </div>
                        <div
                            v-if="selectedFacts?.monthIndex !== null && selectedFacts?.monthIndex !== undefined"
                            class="cal__fact">
                            <dt>朔望月</dt>
                            <dd class="numeral">第 {{ selectedFacts.monthIndex }} 月</dd>
                        </div>
                        <div v-if="selectedFacts?.yearStemBranch" class="cal__fact">
                            <dt>年干支</dt>
                            <dd>{{ selectedFacts.yearStemBranch }}</dd>
                        </div>
                        <div class="cal__fact">
                            <dt>日干支</dt>
                            <dd>
                                {{ selectedFacts === null ? "" : sexagenary(daySexagenaryIndex(daysOfAbsolute(selectedFacts.absolute))) }}
                            </dd>
                        </div>
                    </dl>

                    <ElButton text size="small" class="cal__detail-more" @click="emit('open', props.selected)">
                        在年表里看这一天
                        <AppIcon name="ArrowRight" />
                    </ElButton>
                </template>

                <p v-else class="cal__detail-hint">点一格看那一天的完整历法表达</p>
            </aside>
        </div>
    </div>
</template>

<style scoped>
.cal {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    outline: none;
}

/* ---------------------------------------------------------------- 工具栏 */

.cal__bar {
    align-items: center;
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 12px;
    padding: 8px 12px;
}

.cal__nav {
    align-items: center;
    display: flex;
    gap: 4px;
}

.cal__title {
    align-items: baseline;
    display: flex;
    gap: 8px;
    min-width: 190px;
}

/* 本历的月名占主位 */
.cal__title-system {
    color: var(--el-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
}

/* 公历退到副位：它是辅助参照，不是这一页的主角 */
.cal__title-civil {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
}

.cal__today {
    margin-left: 8px;
}

.cal__legend {
    align-items: center;
    color: var(--el-text-color-secondary);
    display: flex;
    flex: 1;
    font-size: var(--xy-font-xs);
    gap: 12px;
    justify-content: flex-end;
}

.cal__legend-item {
    align-items: center;
    display: inline-flex;
    gap: 4px;
}

.cal__swatch {
    border-radius: 2px;
    display: inline-block;
    height: 8px;
    width: 8px;
}

.cal__swatch--primary {
    background: var(--el-color-primary);
}

.cal__swatch--term {
    background: var(--el-color-success);
}

.cal__swatch--phase {
    background: var(--el-color-warning);
}

.cal__swatch--ganzhi {
    background: var(--el-border-color-darker);
}

/* ---------------------------------------------------------------- 主体 */

.cal__body {
    display: flex;
    flex: 1;
    min-height: 0;
}

.cal__grid {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

/*
 * `ElCalendar` 的表头与格线全部重画。
 *
 * 它自带的样式是"给它自己的默认内容"配的：格子里只有一个日期数字，
 * 所以高度是固定的、行高是宽的。我们要塞三行，必须让单元格成为
 * `flex` 容器并且能撑高——`height: 100%` 一路传下去，
 * 最后一行才会把剩余高度吃掉（否则 5 行的月份下面会空一大片）。
 */
.cal__grid :deep(.el-calendar) {
    display: flex;
    flex: 1;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

.cal__grid :deep(.el-calendar__header) {
    display: none; /* 标题与按钮换成上面那条工具栏 */
}

.cal__grid :deep(.el-calendar__body) {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 0;
}

.cal__grid :deep(.el-calendar-table) {
    flex: 1;
    height: 100%;
    table-layout: fixed;
}

.cal__grid :deep(.el-calendar-table thead th) {
    border-bottom: 1px solid var(--xy-hairline);
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    font-weight: var(--xy-weight-medium);
    height: 30px;
    padding: 0;
}

.cal__grid :deep(.el-calendar-table td) {
    border-color: var(--xy-hairline);
    padding: 0;
    vertical-align: top;
}

.cal__grid :deep(.el-calendar-table td.is-selected) {
    background: transparent;
}

/*
 * 日期数字。
 *
 * `ElCalendar` 自己不给 `.el-calendar-day` 里的文字定色，于是数字继承了某个偏蓝的
 * 次要色，在浅底上淡得几乎看不清。颜色由我们定死，字号也放大一档——
 * 它是格子里**最先被读到**的东西（前注意加工里，大小与对比度决定扫视顺序）。
 */
.cal__grid :deep(.el-calendar-day) {
    height: 100%;
    padding: 0;
}

.cal__grid :deep(.el-calendar-day:hover) {
    background: transparent;
}

/* ---------------------------------------------------------------- 一格 */

.cal__cell {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
    height: 100%;
    padding: 5px 7px 6px;
    position: relative;
    transition: background var(--xy-duration-fast) var(--xy-ease);
}

.cal__cell:hover {
    background: var(--el-fill-color-light);
}

.cal__cell.is-selected {
    background: var(--el-color-primary-light-9);
    box-shadow: inset 0 0 0 2px var(--el-color-primary);
}

/* 非本月的日子：整体降一档，但仍然可读（不是 `display: none`） */
.cal__cell.is-outside {
    opacity: 0.4;
}

/* 公历日：格子里最大、最深的一个字 */
.cal__day {
    color: var(--el-text-color-primary);
    font-size: 17px;
    font-weight: var(--xy-weight-semibold);
    line-height: 1.05;
}

/* 本历主行：主色，比公历日小一档 */
.cal__primary {
    color: var(--el-color-primary);
    font-size: var(--xy-font-xs);
    font-weight: var(--xy-weight-medium);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cal__extra {
    font-size: var(--xy-font-2xs);
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cal__extra--term {
    color: var(--el-color-success);
    font-weight: var(--xy-weight-semibold);
}

.cal__extra--phase {
    color: var(--el-color-warning);
    font-weight: var(--xy-weight-medium);
}

.cal__extra--ganzhi {
    color: var(--el-text-color-placeholder);
}

/*
 * 本历这个月的第一天：左边一条粗主色线。
 * 它是"这个月从哪天起"的标记——公历格里看不出本历的月界，所以必须显式画出来。
 */
.cal__cell.is-month-start {
    border-left: 3px solid var(--el-color-primary);
}

/* 本历这个月的最后一天：右边一条粗主色线 */
.cal__cell.is-month-end {
    border-right: 3px solid var(--el-color-primary);
}

/* 落在本历这个月之外的日子：底色压暗 + 主行淡化 */
.cal__cell.is-other-month {
    background: var(--el-fill-color-lighter);
}

.cal__cell.is-other-month .cal__primary {
    color: var(--el-text-color-placeholder);
}

/* 交节当天：左上角一个小三角，扫一眼就能找到 */
.cal__cell.is-term::before {
    border-left: 7px solid var(--el-color-success);
    border-top: 7px solid transparent;
    content: "";
    left: 0;
    position: absolute;
    top: 0;
}

/* 月相节点（朔 / 上弦 / 望 / 下弦）当天：右上角一个小圆点，与交节的三角区分开 */
.cal__cell.is-phase::after {
    background: var(--el-color-warning);
    border-radius: 50%;
    content: "";
    height: 5px;
    position: absolute;
    right: 6px;
    top: 8px;
    width: 5px;
}

.cal__today-dot {
    background: var(--el-color-primary);
    border-radius: 50%;
    bottom: 5px;
    height: 5px;
    position: absolute;
    right: 6px;
    width: 5px;
}

/* 今天：一圈浅色描边，与"选中"的粗边框区分开（两种状态可同时成立） */
.cal__cell.is-today {
    box-shadow: inset 0 0 0 1px var(--el-color-primary-light-5);
}

.cal__cell.is-today.is-selected {
    box-shadow: inset 0 0 0 2px var(--el-color-primary);
}

/* ---------------------------------------------------------------- 详情条 */

.cal__detail {
    border-left: 1px solid var(--xy-hairline);
    flex-shrink: 0;
    overflow-y: auto;
    padding: 14px;
    width: 230px;
}

.cal__detail.is-empty {
    align-items: center;
    display: flex;
    justify-content: center;
}

.cal__detail-hint {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-relaxed);
    text-align: center;
}

.cal__detail-title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-md);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.cal__detail-relative {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
    margin: 3px 0 12px;
}

.cal__facts {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin: 0;
}

.cal__fact {
    align-items: baseline;
    display: flex;
    gap: 8px;
}

.cal__fact dt {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-size: var(--xy-font-2xs);
    width: 46px;
}

.cal__fact dd {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-sm);
    margin: 0;
}

.cal__fact dd.cal__fact--term {
    color: var(--el-color-success);
    font-weight: var(--xy-weight-semibold);
}

/* "交节" / "当日" 这类小标记：说明这一天的特殊之处 */
.cal__fact-tag {
    background: var(--el-fill-color);
    border-radius: var(--xy-radius-sm);
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-2xs);
    margin-left: 4px;
    padding: 0 4px;
}

.cal__detail-more {
    margin-top: 14px;
    padding: 0;
}
</style>
