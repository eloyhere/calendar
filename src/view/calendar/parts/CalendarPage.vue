<script setup lang="ts">
/**
 * 历法实体的「日历」页壳。
 *
 * ## 布局骨架（内容留白）
 *
 * 一个历表页要做的事是固定的，先把骨架立起来：
 *
 * ```
 * 工具栏   [< 上一年] [年份输入] [下一年 >]   [视图: 年 / 月 / 日]  [今天]
 * 月历区   12 个月份卡片（或年的横向轴）
 * ```
 *
 * 现在是 `loading` 骨架；等各实体的 store 接上以后，把 `months` 换成真实数据、
 * 把 `ElSegmented` 的选中值接到查询参数即可，布局不用动。
 *
 * ## 为什么用 `ElSegmented` 而不是 `ElRadioGroup`
 *
 * "年 / 月 / 日"是同一控件的三个互斥视图，不是表单字段；`ElSegmented` 语义更准，
 * 视觉也比一排单选按钮轻。
 */

import { computed, ref } from "vue";
import { ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import PageShell from "../../../component/PageShell.vue";

/** 三种视图粒度。 */
type Granularity = "year" | "month" | "day";

interface Props {
    /** 当前展示的年份 */
    year?: number;
    /** 数据源名称 */
    source?: string;
    /** 加载状态 */
    state?: "loading" | "ready" | "empty" | "error";
}

const props = withDefaults(defineProps<Props>(), {
    year: 1,
    source: "",
    state: "loading"
});

/** 当前年份；后续接查询参数时改成 `defineModel` 或 store。 */
const year = ref(props.year);

/** 当前粒度。 */
const granularity = ref<Granularity>("month");

/** `ElSegmented` 的选项。 */
const GranularityOptions = [
    { label: "年", value: "year" },
    { label: "月", value: "month" },
    { label: "日", value: "day" }
];

/** 年份 +1 / -1；本项目的纪年允许 0 年与负数年，所以不做下界收敛。 */
function stepYear(offset: number): void {
    year.value += offset;
}

/** 月份槽位：先固定 12 格，闰月与大小月由真实数据决定。 */
const MonthSlots = computed(() => Array.from({ length: 12 }, (_value, index) => index + 1));
</script>

<template>
    <PageShell
        :state="props.state"
        :source="props.source"
        skeleton="table"
        empty-text="这个历法还没有生成历表；生成入口见 docs/design.md §7 的 python database/build.py。">
        <div class="calendar-page__toolbar">
            <ElButtonGroup>
                <ElButton @click="stepYear(-1)">
                    <ElIcon><ArrowLeft /></ElIcon>
                    <span>上一年</span>
                </ElButton>
                <ElButton @click="stepYear(1)">
                    <span>下一年</span>
                    <ElIcon><ArrowRight /></ElIcon>
                </ElButton>
            </ElButtonGroup>

            <ElInputNumber
                v-model="year"
                :step="1"
                :controls="false"
                class="calendar-page__year numeral"
                aria-label="年份" />

            <ElSegmented v-model="granularity" :options="GranularityOptions" />

            <ElButton text @click="year = props.year">
                <ElIcon><Refresh /></ElIcon>
                <span>回到当前</span>
            </ElButton>
        </div>

        <ElRow :gutter="12">
            <ElCol v-for="slot in MonthSlots" :key="slot" :span="6" class="calendar-page__cell">
                <ElCard shadow="hover" class="calendar-page__month">
                    <template #header>
                        <ElText class="numeral">{{ slot }} 月</ElText>
                    </template>
                    <ElEmpty description="待接入历表" :image-size="48" />
                </ElCard>
            </ElCol>
        </ElRow>
    </PageShell>
</template>

<style scoped>
.calendar-page__toolbar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
}

.calendar-page__year {
    width: 110px;
}

.calendar-page__cell {
    margin-bottom: 12px;
}

.calendar-page__month {
    min-height: 168px;
}
</style>
