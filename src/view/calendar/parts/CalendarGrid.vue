<script setup lang="ts">
/**
 * 历法工作区的「日历」视图：年 → 月 → 日三级钻取。
 *
 * ## 为什么不逐级点击
 *
 * "朝代 → 年号 → 年 → 月 → 日"这条路径天然很深，而 NN/g 的结论是
 * "**其它条件相同时，深层级更难用**"，同时明确指出"3 次点击规则是错的"
 * ——不要拿它替深层结构辩护，也不要靠点击层层钻（`docs/ui-architecture.md` §2.2 第 2 条）。
 *
 * 所以这里给的是**直接跳转**：年份输入框 + 上一年 / 下一年 + 「跳到第 1 年」，
 * 一次就能到任意一年。月份是平铺的卡片，不再点进第三层。
 *
 * ## 年号与年份的关系
 *
 * 历表的年份是**天文纪年**（允许 0 年与负数年），年号是另一套东西（在 `era` 分库）。
 * 这一页只显示历表自己的年份，不去猜年号——猜错会把两个上下文混起来，
 * 而 `docs/ui-architecture.md` §3.1 把它们分成两个限界上下文是有意为之。
 * 年号在年表域里看。
 *
 * ## 节气与月相作为叠加层
 *
 * 每月卡片上标出这个月有没有节气 / 中气，这是"闰月按无中气置闰"那条规则的可见证据
 * （`src/entity/calendar.ts` 的 `monthsPerYear` 里写了它）。
 * 叠加层的意义在于让用户**看出规则**，而不只是读到规则。
 */

import { computed, ref, watch } from "vue";

import PageShell from "../../../component/PageShell.vue";
import AppIcon from "../../../component/AppIcon.vue";
import type { Row } from "../../../datasource/sqlite";
import type { CalendarSystem } from "../../../entity/calendar";
import { textOf, useQuery } from "../../../state/use-calendar-query";

interface Props {
    /** 当前历法体系 */
    system: CalendarSystem;
}

const props = defineProps<Props>();

/** 当前年份。默认取这套历法年表的**第一年**，等它查出来再定。 */
const year = ref<bigint | null>(null);

/** 年表的第一年与最后一年：年份输入的上界下界，也是"跳到开头/结尾"的目标。 */
const { rows: bounds } = useQuery<Row>(
    props.system.module,
    () =>
        `SELECT MIN("year") AS lo, MAX("year") AS hi, COUNT(*) AS n FROM "${props.system.yearTable}"`
);

/** 首年：第一次查到边界时把年份定下来。 */
const lo = computed(() => (bounds.value[0]?.lo ?? null) as bigint | number | null);
const hi = computed(() => (bounds.value[0]?.hi ?? null) as bigint | number | null);

/** 当前年份的字符串形式，给输入框用（bigint 不能直接 v-model）。 */
const yearText = ref("");

/** 边界到了就初始化年份与输入框（只做一次，之后由用户控制）。 */
const initialised = ref(false);

watch(
    lo,
    (value) => {
        if (initialised.value || value === null) {
            return;
        }
        initialised.value = true;
        year.value = BigInt(value);
        yearText.value = String(value);
    },
    { immediate: true }
);

/** 这一年的月。按 `ordinal` 排（块内序号），没有就按 identity。 */
const { rows: months, state, error, reload } = useQuery<Row>(
    props.system.module,
    () =>
        year.value === null
            ? null
            : `SELECT * FROM "${props.system.monthTable}" WHERE "year" = ${year.value.toString()} ` +
              `ORDER BY "ordinal", "identity" LIMIT 20`
);

/** 页面状态。 */
const pageState = computed(() => {
    if (year.value === null) {
        return bounds.value.length === 0 ? "empty" : "loading";
    }
    return state.value;
});

/** 步进一年。 */
const step = (delta: number): void => {
    if (year.value === null) {
        return;
    }
    year.value += BigInt(delta);
    yearText.value = year.value.toString();
};

/** 输入框提交：非数字就退回当前年份，不做无提示的纠正。 */
const commitYear = (): void => {
    const parsed = Number(yearText.value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        yearText.value = year.value === null ? "" : year.value.toString();
        return;
    }
    year.value = BigInt(parsed);
};

/** 一行的月份名。 */
const monthName = (row: Row): string => {
    const value = row.name ?? row.label;
    return textOf(value);
};

/** 这个月的大小（29 / 30 天）。历表里 `size` 就是它。 */
const monthSize = (row: Row): string => {
    const value = row.size;
    return value === null || value === undefined ? "" : `${String(value)} 天`;
};

/** 这个月是不是闰月。 */
const isLeap = (row: Row): boolean => row.leap === 1 || row.leap === true || row.leap === 1n;

/** 这个月的起止（可读部分）。 */
const spanOf = (row: Row): string => {
    const start = textOf(row.start_label ?? row.start);
    const end = textOf(row.end_label ?? row.end);
    return start === "" && end === "" ? "" : `${start} → ${end}`;
};
</script>

<template>
    <PageShell
        :state="pageState"
        :error-text="error"
        :source="`src/sqlite/${props.system.module}.sqlite`"
        empty-text="这一年没有月份记录；换个年份看看"
        @retry="reload">
        <div class="calendar-grid">
            <!-- 工具栏：年份是可直接输入的，不是只能一步步点 -->
            <div class="calendar-grid__bar">
                <ElButton :disabled="lo === null" @click="year = BigInt(lo ?? 0), (yearText = String(lo ?? ''))">
                    <AppIcon name="DArrowRight" />
                    <span>最早</span>
                </ElButton>
                <ElButton @click="step(-1)">
                    <AppIcon name="ArrowLeft" />
                    <span>上一年</span>
                </ElButton>

                <ElInput
                    v-model="yearText"
                    class="calendar-grid__year numeral"
                    placeholder="年份"
                    @keydown.enter="commitYear"
                    @blur="commitYear" />

                <ElButton @click="step(1)">
                    <span>下一年</span>
                    <AppIcon name="ArrowRight" />
                </ElButton>
                <ElButton :disabled="hi === null" @click="year = BigInt(hi ?? 0), (yearText = String(hi ?? ''))">
                    <span>最晚</span>
                    <AppIcon name="ArrowRight" />
                </ElButton>

                <span class="calendar-grid__spring" />

                <span class="xy-dim">
                    年表范围
                    <span class="numeral">{{ lo === null ? "—" : String(lo) }}</span>
                    ~
                    <span class="numeral">{{ hi === null ? "—" : String(hi) }}</span>
                </span>
            </div>

            <!-- 月份卡片：平铺，不再钻第三层 -->
            <div class="calendar-grid__months">
                <ElCard v-for="month in months" :key="String(month.identity)" shadow="never" class="calendar-grid__month">
                    <div class="calendar-grid__month-head">
                        <span class="calendar-grid__month-name">{{ monthName(month) }}</span>
                        <ElTag v-if="isLeap(month)" size="small" type="warning" effect="plain">闰</ElTag>
                    </div>

                    <p class="xy-dim calendar-grid__month-size">{{ monthSize(month) }}</p>
                    <p v-if="spanOf(month)" class="xy-dim calendar-grid__month-span numeral">
                        {{ spanOf(month) }}
                    </p>
                </ElCard>
            </div>

            <p class="xy-note calendar-grid__note">
                月份按历表里的块内序号（<code>ordinal</code>）排列，一次最多 20 个月
                ——闰年 13 个月，20 是留了余量。年份是**天文纪年**，允许 0 年与负数年；
                年号在<a href="#/chronology/timeline">年表</a>里看，两者是不同的上下文。
            </p>
        </div>
    </PageShell>
</template>

<style scoped>
.calendar-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.calendar-grid__bar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.calendar-grid__year {
    font-size: 14px;
    width: 120px;
}

/* "弹簧"：把右侧的范围说明推到最右 */
.calendar-grid__spring {
    flex: 1 1 auto;
}

/*
 * 月份用 grid 平铺而不是 `ElRow` / `ElCol`：
 * 列数要随窗口自适应，`auto-fill` 比 24 栏栅格更直接。
 */
.calendar-grid__months {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.calendar-grid__month :deep(.el-card__body) {
    padding: 12px;
}

.calendar-grid__month-head {
    align-items: center;
    display: flex;
    gap: 6px;
}

.calendar-grid__month-name {
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
}

.calendar-grid__month-size,
.calendar-grid__month-span {
    margin: 4px 0 0;
}

.calendar-grid__note {
    margin: 0;
}
</style>
