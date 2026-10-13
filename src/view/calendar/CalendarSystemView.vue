<script setup lang="ts">
/**
 * 历法工作区：`/calendar/:system/:view?`。八套历法共用这一个页面。
 *
 * ## 一条路由，八套历法
 *
 * 旧版把 8 套 × 3 个视图写成 24 条路由 24 个文件，而它们的形状完全相同。
 * 这里按 `src/entity/calendar-page.ts` 的登记表取值，所以**加一套历法是加一条登记**，
 * 不是加一个 `.vue`。
 *
 * ## 页面布局：日历在左，口径在右
 *
 * ```
 * ┌ 页头：体系名 + 一句话定位 + 时间 + 视图切换 ─────────┐
 * ├ 日历（ElCalendar）                    │ 口径面板      │
 * │  · 月视图：42 格，每格三行             │  · 为什么用它 │
 * │  · 年视图：12 条迷你条                 │  · 规则/分界  │
 * │                                        │  · 数据来源   │
 * ```
 *
 * 口径面板放在右边而不是下面：它与日历**同时要看**（"为什么这天是闰月"，
 * 答案在右边的"规则"那一段）。放在下面就得来回滚动。
 * 268px 是权衡后的值——再窄，年份与节气名会换行；再宽，日历每格在 1440 窗口里
 * 会低于可用的三行高度。
 *
 * ## 视图参数与 URL 同步
 *
 * `:view` 只承载体裁（`month` / `year`）。非法 `:system` 渲染 `ElResult` 空态
 * 并给出口，**不 redirect**——重定向会把拼错的地址掩盖掉（用户输入
 * `/calendar/synodik` 会被悄悄带到朔望历，他会以为地址是对的）。
 */

import { computed, ref, shallowRef, watch } from "vue";

import CalendarDayGrid from "../../component/calendar/CalendarDayGrid.vue";
import CalendarYearStrip from "../../component/calendar/CalendarYearStrip.vue";
import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { useRoute, useRouter } from "../../plugin";
import { ALL_SYSTEMS, systemOf } from "../../entity/calendar";
import { calendarPageOf } from "../../entity/calendar-page";
import { MONTH_NAMES, formatYear, keyOfCivil } from "../../share/calendar/gregorian";
import { useDayFacts } from "../../state/use-day-facts";
import type { CalendarDay } from "../../state/use-calendar-month";
import { loadMonths, monthIndexOf, partsOfMonthIndex } from "../../state/use-calendar-month";
import { useSystemMoment } from "../../state/use-system-calendar";
import { ageStarText, ciOfLongitude } from "../../share/astronomy/twelve-ci";
import { driftDays, phaseOfDate } from "../../share/astronomy/jupiter-cycle";
import { positionsOfDate } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { queryModule } from "../../datasource/runner";
import { bigOf } from "../../datasource/sqlite";

import { useShellStore } from "../../store/shell.store";

const route = useRoute();
const router = useRouter();
const shell = useShellStore();

/** `:system` 参数。 */
const systemId = computed(() => {
    const raw = route.params.system;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** `:view` 参数；缺省是月视图。 */
const view = computed<"month" | "year">(() => {
    const raw = route.params.view;
    const value = String(Array.isArray(raw) ? raw[0] : raw);
    return value === "year" ? "year" : "month";
});

const system = computed(() => systemOf(systemId.value));
const spec = computed(() => calendarPageOf(systemId.value));

//* -------------------------------------------------------------------------- */
/* 光标                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 光标是**一个绝对时刻**（`absolute`），不是公历月序号，也不是 `Date`。
 *
 * 这是这一页最重要的一处设计。八套历法的年月划分互不相同：
 *
 * | 历法     | "月"是什么        | 一年几个月 |
 * | -------- | ----------------- | ---------- |
 * | 朔望历   | 朔望月（29–30 天）| 12 或 13   |
 * | 节气历   | 一个节气（约 15 天）| **24**   |
 * | 木星历   | 岁星一次（约 361 天）| 12     |
 * | 干支历   | 节（以交节分界）  | 12         |
 * | 回归历   | 黄道十二宫        | 12         |
 *
 * 所以"翻一个月"对每套历法意味着**不同的天数**。光标用绝对时刻表示之后，
 * 翻月就是"跳到本历相邻那一段的中点"，八套历法各自正确，不必为每套写一遍。
 */
const cursorAt = ref<bigint | null>(null);

/** 今天所在的公历月序号，仅用于首次定位。 */
const todayMonthIndex = monthIndexOf(new Date().getFullYear(), new Date().getMonth() + 1);

/** 定位用的公历月序号：光标所在的公历月。 */
const cursorMonthIndex = shallowRef<number>(todayMonthIndex);

/**
 * 这一屏要取的日期。
 *
 * 日期**从 `gregory_month` 读**——`temporal` 是事件表（2026 年 10 月只覆盖 18 天），
 * 拿它铺日历会到处是空洞。见 `state/use-calendar-month.ts` 的文件头。
 */
const days = shallowRef<CalendarDay[]>([]);
const daysLoading = ref(true);
const daysError = ref("");

watch(
    [cursorAt, cursorMonthIndex, view],
    async ([at, index, mode]) => {
        daysLoading.value = true;
        try {
            days.value =
                mode === "year" ? await loadMonths(index, 6, 6) : await loadMonths(index, 1, 1);
            daysError.value = "";

            /*
             * 首次定位：把光标落在"今天"。
             *
             * 不能直接用系统时钟的 `absolute`（那个轴上"今天"对应哪个数要查库），
             * 所以取这一屏里**日期最接近今天**的那一天。
             */
            if (at === null && days.value.length > 0) {
                const now = new Date();
                const same = days.value.find(
                    (day) => day.year === now.getFullYear() && day.month === now.getMonth() + 1 && day.day === now.getDate()
                );
                cursorAt.value = (same ?? days.value[Math.floor(days.value.length / 2)]).absolute;
            }
        } catch (cause) {
            days.value = [];
            daysError.value = cause instanceof Error ? cause.message : String(cause);
        } finally {
            daysLoading.value = false;
        }
    },
    { immediate: true }
);

const { facts, loading, error, reload } = useDayFacts(days);

/** 选中的那一天（`YYYY-MM-DD`）。 */
const selected = ref<string | null>(null);

/* -------------------------------------------------------------------------- */
/* 这套历法自己的年月                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 本历的年月。
 *
 * **这是八套历法页面彼此不同的根源**：公历 2026 年对轩辕历是第 **4723** 年、
 * 对干支历是**酉月**、对节气历是**秋分**、对木星历是第 **399** 年——
 * 全部来自各自的 `*_year` / `*_month` 表，不是公历换个标签。
 */
const { moment: systemMoment, months: systemMonths } = useSystemMoment(
    computed(() => systemId.value),
    computed(() => cursorAt.value ?? 0n)
);

/** 光标的公历年月，用于给 `ElCalendar` 选月份。 */
const calendarDate = computed(() => {
    const parts = partsOfMonthIndex(cursorMonthIndex.value);
    const date = new Date();
    // `setFullYear` 而不是构造函数：0–99 年的 `Date` 会被当成 19xx
    date.setFullYear(parts.year, parts.month - 1, 1);
    date.setHours(0, 0, 0, 0);
    return date;
});

/** 今天那一天的键。 */
const todayKey = computed(() => {
    const now = new Date();
    return keyOfCivil(now.getFullYear(), now.getMonth() + 1, now.getDate());
});

/** 用户在公历网格上换月。 */
const setCursorMonth = (value: Date): void => {
    cursorMonthIndex.value = monthIndexOf(value.getFullYear(), value.getMonth() + 1);
    // 换月时把光标挪到那个月的月中，避免落在月首而查错本历月
    const middle = days.value[Math.floor(days.value.length / 2)];
    if (middle !== undefined) {
        cursorAt.value = middle.absolute;
    }
};

/** 本历月的位置。 */
const monthIndex = computed(() =>
    systemMonths.value.findIndex((month) => month.start === (systemMoment.value?.monthStart ?? -1n))
);

/**
 * 翻本历的相邻月。
 *
 * 直接跳到那一段的**中点**：中点在段内，无论这一段有多少天都成立。
 * 这就是为什么节气历"下一月"只走 15 天、木星历"下一月"走 361 天——
 * 同一个动作在八套历法里各自正确。
 */
const stepMonth = (delta: number): void => {
    const next = systemMonths.value[monthIndex.value + delta];
    if (next === undefined) {
        return;
    }
    cursorAt.value = next.start + (next.end - next.start) / 2n;
    void syncCivilMonth();
};

/** 翻本历的相邻年。 */
const stepYear = (delta: number): void => {
    const moment = systemMoment.value;
    if (moment === null) {
        return;
    }
    const span = moment.yearEnd - moment.yearStart;
    cursorAt.value = moment.yearStart + span / 2n + BigInt(delta) * span;
    void syncCivilMonth();
};

/**
 * 把公历月网格同步到光标所在的公历月。
 *
 * 不能自己把 `absolute` 换算成公历日期（这个库的年月日 ↔ 天数是它自己的规则，
 * 用儒略日反推会整体错位二十多天，见 `share/calendar/gregorian.ts` 的文件头）。
 * 所以**从库里查**。
 *
 * ## 为什么必须回查分库，不能只在已加载的窗口里找
 *
 * 早先这里只写了一句 `days.value.find(...)`——只在**已加载的 `days`** 里找。
 * 而月模式只加载 `cursorMonthIndex ± 1` 个月（`loadMonths(index, 1, 1)`）。
 *
 * 其余七套历法一个月不超过 30 天，翻一月必然落在窗口内，所以看不出问题。
 * 但**木星历一个月是 361 天 ≈ 12 个公历月**——一翻就跳到窗口外，
 * `find` 返回 `undefined`，`cursorMonthIndex` 不更新，于是**格子纹丝不动**。
 * 节气历（15 天）虽在窗口内，但月末那几天也会擦边。
 *
 * 所以改成：光标在窗口内就用窗口（快路径，没有查询开销），
 * 在窗口外就**回查 `gregory_month`** 拿它属于哪个月。
 */
const syncCivilMonth = async (): Promise<void> => {
    const at = cursorAt.value;
    if (at === null) {
        return;
    }

    /* 快路径：光标落在已加载窗口的闭区间内 */
    const first = days.value[0];
    const last = days.value[days.value.length - 1];
    if (first !== undefined && last !== undefined && at >= first.absolute && at <= last.absolute) {
        const day = days.value.find((item) => item.absolute >= at);
        if (day !== undefined) {
            cursorMonthIndex.value = monthIndexOf(day.year, day.month);
            return;
        }
    }

    /*
     * 慢路径：回查分库。
     *
     * `gregory_month.year` 是"公历年 + 10000"，`ordinal` 是月序——
     * 与 `monthIndexOf()` 的口径一致，所以直接能拼出月索引。
     */
    try {
        const rows = await queryModule(
            "gregory",
            `SELECT "year", "ordinal" FROM "gregory_month" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            { a: at }
        );
        const row = rows[0];
        if (row !== undefined) {
            cursorMonthIndex.value = monthIndexOf(Number(bigOf(row.year)) - 10_000, Number(bigOf(row.ordinal)));
        }
    } catch {
        /* 查不到就不动网格：宁可停在原处，也不要跳到错误的月份 */
    }
};

/** 跳到本历年的某一个月（右栏月表点击）。 */
const pickSystemMonth = (index: number): void => {
    const target = systemMonths.value[index];
    if (target === undefined) {
        return;
    }
    cursorAt.value = target.start + (target.end - target.start) / 2n;
    void syncCivilMonth();
};

/** 回今天。 */
const goToday = (): void => {
    const now = new Date();
    cursorAt.value = null;
    cursorMonthIndex.value = monthIndexOf(now.getFullYear(), now.getMonth() + 1);
};
/** 页面状态：`PageShell` 认识的四种。 */
const state = computed(() => {
    if (daysError.value.length > 0) {
        return "error" as const;
    }
    if ((loading.value || daysLoading.value) && facts.value.size === 0) {
        return "loading" as const;
    }
    if (error.value.length > 0) {
        return "error" as const;
    }
    if (facts.value.size === 0) {
        return "empty" as const;
    }
    return "ready" as const;
});

/** 窗口标题与状态栏视点。 */
watch(
    [() => system.value?.label, selected],
    ([label, key]) => {
        if (label === undefined) {
            return;
        }
        document.title = `${label} · 轩辕历法`;

        /*
         * 只在**用户真的选了某一天**时写视点。
         *
         * 把翻月也写进去会让状态栏那一段在用户没做任何选择时就已经有内容，
         * 反而看不出它表示"当前视点"。
         */
        if (key === null) {
            return;
        }
        const cell = facts.value.get(key);
        shell.setPoint({
            absolute: cell?.absolute ?? null,
            gregorian: key,
            calendar:
                cell?.lunarMonth !== null && cell?.lunarMonth !== undefined
                    ? `${cell.lunarMonth}${cell.lunarDay ?? ""}`
                    : null,
            sexagenary: (cell?.yearStemBranch.length ?? 0) === 2 ? `${cell?.yearStemBranch}年` : null,
            from: `历法 · ${label}`
        });
    },
    { immediate: true }
);

/** 切视图，写进 URL（地址可以直接分享）。 */
const setView = (next: "month" | "year"): void => {
    void router.push(`/calendar/${systemId.value}/${next}`);
};

/** 选一天。 */
const select = (key: string): void => {
    selected.value = key.length === 0 ? null : key;
};

/** 双击一格：跳到年表的对应位置。 */
const openInChronology = (key: string): void => {
    void router.push({ path: "/chronology/timeline", query: { date: key } });
};

/** 年视图点某个月 → 回月视图并停在那个月。 */
const pickMonth = (month: number): void => {
    const parts = partsOfMonthIndex(cursorMonthIndex.value);
    cursorMonthIndex.value = monthIndexOf(parts.year, month);
    const middle = days.value[Math.floor(days.value.length / 2)];
    if (middle !== undefined) {
        cursorAt.value = middle.absolute;
    }
    setView("month");
};

/** 年视图里选中那一天的事实。 */
const yearSelectedFacts = computed(() =>
    selected.value === null ? null : (facts.value.get(selected.value) ?? null)
);

/**
 * 木星此刻所在的次——「岁在X」。
 *
 * 只在木星历页算：其余七套历法没有"次"这个概念。
 *
 * 用**木星的实际地心黄经**推，不用库里的 `jupiter_month`
 * ——那张表的十二个月是等时段（每段 361 天），实测月首黄经差 25.61°–34.84°，
 * 不是十二次。详见 `share/astronomy/twelve-ci.ts` 的文件头。
 *
 * 日期同样从库里读（`civilOfAbsolute`），不能把 `absolute` 直接交给星历库。
 */
const ageStar = ref<{
    text: string;
    span: string;
    progress: string;
    /** 会合相位（0° 合日 / 180° 冲日） */
    angle: number;
    /** 相位名称 */
    stage: string;
    /** 会合序号（平气推的，与真实合日可差 ±4 天，见 jupiter-cycle.ts） */
    index: number;
    /** 距下一次冲日的天数 */
    toOpposition: number;
    /** 距下一次合日的天数 */
    toConjunction: number;
    /** 超辰量（天） */
    drift: number;
} | null>(null);

watch(
    cursorAt,
    (anchor) => {
        if (anchor === null || systemId.value !== "jupiter") {
            ageStar.value = null;
            return;
        }
        void civilOfAbsolute(anchor, (module, statement, parameters) =>
            queryModule(module, statement, parameters) as never
        )
            .then((civil) => {
                if (civil === null) {
                    ageStar.value = null;
                    return;
                }
                const at = dateOfCivil(civil.year, civil.month, civil.day, civil.hour, civil.minute);
                const jupiter = positionsOfDate(at).find((body) => body.id === "jupiter");
                if (jupiter === undefined) {
                    ageStar.value = null;
                    return;
                }
                const ci = ciOfLongitude(jupiter.longitude);
                /* 会合相位：复用同一次回查到的日期，不再查第二遍分库 */
                const conj = phaseOfDate(at);
                ageStar.value = {
                    text: ageStarText(jupiter.longitude),
                    span: ci.span,
                    progress: `${ci.progress.toFixed(1)}° / 30°`,
                    angle: conj.angle,
                    stage: conj.stage,
                    index: conj.index,
                    toOpposition: conj.daysToOpposition,
                    toConjunction: conj.daysToConjunction,
                    drift: driftDays(conj.index)
                };
            })
            .catch(() => {
                ageStar.value = null;
            });
    },
    { immediate: true }
);

/** 公历的年月表达（辅助信息，不占主位）。 */
const civilText = computed(() => {
    const parts = partsOfMonthIndex(cursorMonthIndex.value);
    return view.value === "year"
        ? formatYear(parts.year)
        : `${formatYear(parts.year)}${MONTH_NAMES[parts.month - 1]}`;
});

/**
 * 本历的年月表达 —— **页头的主位**。
 *
 * 公历 2026 年对轩辕历是 4723 年、对木星历是 399 年、对干支历是酉月、
 * 对节气历是秋分。这一行就是八套历法页面彼此不同的地方。
 */
const systemText = computed(() => {
    const moment = systemMoment.value;
    if (moment === null || spec.value === undefined) {
        return "";
    }
    /*
     * 年份文案由**每套历法自己**提供（`spec.yearLabel`），不复用同一句。
     *
     * 八套历法是四套互不相同的纪年：格里高利历"公元 2026 年"、
     * 轩辕历"第 4723 年"、干支历"丙午年"、木星历"第 399 年"。
     * 一开始共用 `*_year.relative`，于是格里高利历显示了"第 4722 年"——
     * 那个数其实只是该表内的相对序号。
     */
    return `${spec.value.yearLabel(moment)} · ${moment.monthName}`;
});

/** 本历年的一行说明：一年几个月、这个月多少天。 */
const systemMeta = computed(() => {
    const moment = systemMoment.value;
    if (moment === null) {
        return "";
    }
    const leap = moment.yearLeap ? "（闰年）" : "";
    return `年长 ${moment.monthsInYear} 个月${leap} · 本月 ${moment.monthLength} 天 · 月内第 ${moment.dayInMonth} 天`;
});
</script>

<template>
    <!-- 非法 system：空态 + 出口。不是错误，所以用 ElResult 而不是红色告警 -->
    <ElResult
        v-if="system === undefined || spec === undefined"
        icon="warning"
        title="没有这套历法"
        :sub-title="`地址里的「${systemId}」不在历法登记表里。可用的有：${ALL_SYSTEMS.map((item) => item.label).join('、')}。`">
        <template #extra>
            <ElButton type="primary" @click="router.push('/calendar/natural')">去看轩辕历</ElButton>
            <ElButton @click="router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell
        v-else
        :state="state"
        :error-text="daysError.length > 0 ? daysError : error"
        :card="false"
        :scroll="false"
        source="22 个分库"
        empty-text="这个时间窗口里没有历法数据"
        @retry="reload">
        <div class="cal-page">
            <header class="cal-page__head">
                <!-- 第一行：身份 + 本历的年月 -->
                <div class="cal-page__head-row">
                    <div class="cal-page__identity">
                        <AppIcon :name="system.icon" :size="18" class="cal-page__icon" />
                        <div>
                            <h1 class="cal-page__title">{{ system.label }}</h1>
                            <p class="cal-page__tagline">{{ spec.tagline }}</p>
                        </div>
                    </div>

                    <!--
                        本历的年月占主位，公历退到副位。
                        这是八套历法页面彼此不同的地方：公历 2026 年对轩辕历是 4723 年、
                        对木星历是 399 年、对干支历是酉月、对节气历是秋分。
                    -->
                    <div class="cal-page__period">
                        <span class="cal-page__period-main">{{ systemText }}</span>
                        <span class="cal-page__period-sub">{{ systemMeta }}</span>
                        <span class="cal-page__period-civil numeral">公历 {{ civilText }}</span>
                    </div>
                </div>

                <!-- 第二行：操作。翻的是**这套历法自己的**月与年 -->
                <div class="cal-page__head-row">
                    <span class="cal-page__hint">
                        翻页按{{ system.label }}自己的月与年——本历一个月 {{ systemMoment?.monthLength ?? "—" }} 天
                    </span>

                    <div class="cal-page__nav">
                        <ElButtonGroup>
                            <ElButton text :disabled="monthIndex <= 0" @click="stepMonth(-1)">‹ 上月</ElButton>
                            <ElButton text @click="stepMonth(1)">下月 ›</ElButton>
                        </ElButtonGroup>
                        <ElButtonGroup>
                            <ElButton text @click="stepYear(-1)">‹ 上年</ElButton>
                            <ElButton text @click="stepYear(1)">下年 ›</ElButton>
                        </ElButtonGroup>
                        <ElButton text size="small" @click="goToday">今天</ElButton>

                        <ElRadioGroup
                            :model-value="view"
                            size="small"
                            @update:model-value="(value: string | number | boolean | undefined) => setView(String(value) === 'year' ? 'year' : 'month')">
                            <ElRadioButton value="month">月</ElRadioButton>
                            <ElRadioButton value="year">年</ElRadioButton>
                        </ElRadioGroup>
                    </div>
                </div>
            </header>

            <div class="cal-page__body">
                <div class="cal-page__grid">
                    <CalendarDayGrid
                        v-if="view === 'month'"
                        :model-value="calendarDate"
                        :system-id="systemId"
                        :system-moment="systemMoment"
                        :spec="spec"
                        :facts="facts"
                        :selected="selected"
                        :today-key="todayKey"
                        @update:model-value="setCursorMonth"
                        @select="select"
                        @open="openInChronology" />

                    <CalendarYearStrip
                        v-else
                        :year="partsOfMonthIndex(cursorMonthIndex).year"
                        :facts="facts"
                        :selected="selected"
                        @pick-month="pickMonth"
                        @select="select" />
                </div>

                <aside class="cal-page__aside">
                    <!--
                        本历这一年的月表。
                        这是"突出各自特点"最直接的一块：朔望历一年 12–13 个月、
                        节气历 24 个、木星历 12 个但每个 361 天——列出来差异一眼可见。
                    -->
                    <!--
                        本历这一年的月：**选择器**，不是表格。
                        一年 12–24 个月、只有一个当前项，这是选择器的场景：
                        表格在这里要占三倍高度还得滚，而选择器一行搞定，
                        且下拉里能同时看到每个月的天数（"八月小 29 天"）。
                    -->
                    <section class="cal-page__block">
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">本历月</span>
                            <ElSelect
                                :model-value="monthIndex"
                                size="small"
                                class="cal-page__select"
                                @update:model-value="(value: number | string | boolean | undefined) => pickSystemMonth(Number(value))">
                                <ElOption
                                    v-for="(month, index) in systemMonths"
                                    :key="month.start.toString()"
                                    :value="index"
                                    :label="`${month.name} · ${month.lengthOfDay} 天`" />
                            </ElSelect>
                        </div>

                        <div class="cal-page__row">
                            <span class="cal-page__row-label">本历年</span>
                            <span class="cal-page__row-value numeral">
                                {{ systemMoment === null || spec === undefined ? "—" : spec.yearLabel(systemMoment) }} ·
                                年长 {{ systemMoment?.monthsInYear ?? "—" }} 个月
                                <span v-if="systemMoment?.yearLeap" class="cal-page__leap">（闰）</span>
                            </span>
                        </div>
                    </section>

                    <section class="cal-page__block">
                        <h2 class="xy-panel-title">这套历法</h2>
                        <p class="xy-note">{{ spec.usage }}</p>

                        <!--
                            「岁在X」——只有木星历有这一行。
                            其余七套历法没有"次"这个概念，所以它不该出现在共用布局里。
                            更干净的做法是给 CalendarPageSpec 加一个可选的
                            `extraRows(moment) => {label, value}[]`，让每套历法声明自己额外的行
                            （就是"复用 UI 也要用 slot"那条）。这次没抽成那样是因为改动面更大，
                            而这一行是独立的——将来抽成 slot 时删掉这个 v-if 即可。
                        -->
                        <div v-if="systemId === 'jupiter'" class="cal-page__row cal-page__row--age">
                            <span class="cal-page__row-label">岁星</span>
                            <span class="cal-page__row-value">
                                <template v-if="ageStar !== null">
                                    <strong class="cal-page__age">{{ ageStar.text }}</strong>
                                    <span class="cal-page__age-meta">
                                        {{ ageStar.span }} · 次内 {{ ageStar.progress }}
                                    </span>
                                </template>
                                <template v-else>正在算木星黄经…</template>
                            </span>
                        </div>

                        <!--
                            会合：方案 A 的核心。这三行是"地球与木星绑起来"的读数。
                            放在侧栏而不是格子上，是因为会合周期 398.9 天、
                            一个回归月只有 30.4 天——同月各天的相位几乎相同，
                            逐格显示等于把同一个数重复三十遍。
                        -->
                        <template v-if="systemId === 'jupiter' && ageStar !== null">
                            <div class="cal-page__row">
                                <span class="cal-page__row-label">会合</span>
                                <span class="cal-page__row-value">
                                    <strong class="cal-page__age">{{ ageStar.stage }}</strong>
                                    <span class="cal-page__age-meta">
                                        第 {{ ageStar.index }} 会合 · 相位 {{ ageStar.angle.toFixed(1) }}°
                                    </span>
                                </span>
                            </div>
                            <div class="cal-page__row">
                                <span class="cal-page__row-label">下次</span>
                                <span class="cal-page__row-value numeral">
                                    冲日 {{ ageStar.toOpposition.toFixed(0) }} 天后 ·
                                    合日 {{ ageStar.toConjunction.toFixed(0) }} 天后
                                </span>
                            </div>
                            <div class="cal-page__row">
                                <span class="cal-page__row-label">超辰</span>
                                <span class="cal-page__row-value numeral">
                                    {{ ageStar.drift >= 0 ? "+" : "−" }}{{ Math.abs(ageStar.drift).toFixed(1) }} 天
                                    <span class="cal-page__age-meta">
                                        （11 会合比 12 年多 4.82 天，累计到此）
                                    </span>
                                </span>
                            </div>
                        </template>
                    </section>

                    <section class="cal-page__block">
                        <h2 class="xy-panel-title">规则</h2>
                        <p class="xy-note">{{ spec.rule }}</p>
                    </section>

                    <!--
                        口径：**一行一个短值**，不写成 dt/dd 两行的描述列表。
                        四条 dt/dd 要 ~200px 高，而它们只是四个词——
                        这种"标签 + 短值"用内联排更省地方，也更好扫。
                    -->
                    <section class="cal-page__block">
                        <h2 class="xy-panel-title">口径</h2>
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">分界</span>
                            <span class="cal-page__row-value">{{ spec.origin }}</span>
                        </div>
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">年长</span>
                            <span class="cal-page__row-value">{{ spec.months }}</span>
                        </div>
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">分库</span>
                            <span class="cal-page__row-value numeral">{{ system.module }}</span>
                        </div>
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">年表</span>
                            <span class="cal-page__row-value numeral">{{ system.yearTable }}</span>
                        </div>
                    </section>

                    <section v-if="view === 'year'" class="cal-page__block">
                        <h2 class="xy-panel-title">选中</h2>
                        <template v-if="selected !== null">
                            <p class="cal-page__picked numeral">{{ selected }}</p>
                            <p class="xy-dim">
                                {{ yearSelectedFacts?.lunarMonth }}{{ yearSelectedFacts?.lunarDay }}
                                <template v-if="yearSelectedFacts?.solarTerm">
                                    · {{ yearSelectedFacts.solarTerm }}
                                </template>
                            </p>
                            <ElButton text size="small" @click="openInChronology(selected)">
                                在年表里看这一天
                                <AppIcon name="ArrowRight" />
                            </ElButton>
                        </template>
                        <p v-else class="xy-dim">在左边的条上点一天</p>
                    </section>

                    <!--
                        换一套历法：**选择器**，不是八颗按钮。
                        八颗按钮要占两行且每次都得扫一遍找目标；选择器一行，
                        键盘输入还能直接过滤。
                    -->
                    <section class="cal-page__block">
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">换历法</span>
                            <ElSelect
                                :model-value="systemId"
                                size="small"
                                class="cal-page__select"
                                @update:model-value="(value: string | number | boolean | undefined) => router.push(`/calendar/${String(value)}`)">
                                <ElOption
                                    v-for="other in ALL_SYSTEMS.filter((item) => item.id !== 'chronology')"
                                    :key="other.id"
                                    :value="other.id"
                                    :label="other.label" />
                            </ElSelect>
                        </div>
                        <div class="cal-page__row">
                            <span class="cal-page__row-label">数据</span>
                            <ElLink type="primary" :href="`#/calendar/table/${systemId}`">
                                逐行看 {{ system.yearTable }}
                            </ElLink>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.cal-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

/*
 * 页头分两行。
 *
 * 第一行是身份（历法名 + 一句话定位）与**本历的年月**；
 * 第二行是操作（翻本历的月 / 年、视图切换）。
 *
 * 分行是必要的：本历的年月表达长度差很大（"第 4723 年 · 九月大" 对
 * "第 399 年 · 二月"），单行 flex 下按钮位置会随文字长度漂移。
 */
.cal-page__head {
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 8px;
    padding: 10px 16px;
}

.cal-page__head-row {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
}

.cal-page__identity {
    align-items: center;
    display: flex;
    gap: 10px;
}

.cal-page__icon {
    color: var(--el-color-primary);
}

.cal-page__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    line-height: 1.2;
    margin: 0;
}

.cal-page__tagline {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    margin: 2px 0 0;
}

/* 本历的年月：页头右上的主位 */
.cal-page__period {
    align-items: baseline;
    display: flex;
    flex-shrink: 0;
    gap: 10px;
}

.cal-page__period-main {
    color: var(--el-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    white-space: nowrap;
}

.cal-page__period-sub,
.cal-page__period-civil {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
    white-space: nowrap;
}

.cal-page__body {
    display: flex;
    flex: 1;
    min-height: 0;
}

/* 第二行左侧的一句说明：告诉用户翻页按的是哪套历法的月 */
.cal-page__hint {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

.cal-page__nav {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
}

.cal-page__grid {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex: 1;
    margin: 12px;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
}

.cal-page__aside {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 8px;
    overflow-y: auto;
    padding: 8px 10px 8px 0;
    width: 244px;
}

.cal-page__block {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    padding: 8px 10px;
}

/* 一行"标签 + 短值"。标签固定宽，值占剩下 */
.cal-page__row {
    align-items: center;
    display: flex;
    gap: 8px;
    padding: 2px 0;
}

.cal-page__row-label {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-size: var(--xy-font-2xs);
    width: 48px;
}

.cal-page__row-value {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
}

.cal-page__select {
    flex: 1;
    min-width: 0;
}

.cal-page__leap {
    color: var(--el-color-warning);
}

/* 「岁在X」：主文占一行、附注占下一行——附注里有两项，挤在一行会折得很难看 */
.cal-page__row--age .cal-page__row-value {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.cal-page__age {
    color: var(--el-color-primary);
    font-size: var(--xy-font-md);
    font-weight: var(--xy-weight-semibold);
}

.cal-page__age-meta {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

.cal-page__picked {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.cal-page__links {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
}
</style>
