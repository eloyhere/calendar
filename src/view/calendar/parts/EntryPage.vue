<script setup lang="ts">
/**
 * 历法实体的「简介」页壳。
 *
 * 8 个历法实体的简介页形状完全一样：一段"这个历法是什么"的说明、一组建元与
 * 换算参数、一张关键数字表。把这些收进一个组件，各实体的 `EntryView.vue`
 * 只传自己的文案与数据，不用各写一遍三栏布局。
 *
 * 内容留白（`docs/design.md` 定义好了规则，但页面上要讲哪几条由各实体决定），
 * 现在先渲染骨架屏；`facts` 传空数组时渲染 `ElEmpty`，正好用来演示空态。
 */

import { computed } from "vue";
import PageShell from "../../../component/PageShell.vue";

/** 一条"参数名 -> 值"的换算事实。 */
interface CalendarFact {
    /** 参数名 */
    label: string;
    /** 取值 */
    value: string;
    /** 补充说明 */
    note?: string;
}

interface Props {
    /** 这个历法的一句话定义 */
    summary?: string;
    /**
     * 关键参数；空数组会渲染空态。
     *
     * 类型不带 `readonly`：`ElTable` 的 `data` 收的是可变数组，
     * 传 `readonly T[]` 会在 TS4104 上炸掉。约束由调用方自觉遵守。
     */
    facts?: CalendarFact[];
    /** 建元时刻 */
    epoch?: string;
    /** 数据源 */
    source?: string;
    /** 加载状态 */
    state?: "loading" | "ready" | "empty" | "error";
}

const props = withDefaults(defineProps<Props>(), {
    summary: "",
    facts: () => [],
    epoch: "",
    source: "",
    state: "loading"
});

/** 真正决定显示什么：没传 facts 就是"还没写"，显示空态。 */
const resolvedState = computed(() => {
    if (props.state !== "loading") {
        return props.state;
    }
    return props.facts.length === 0 ? "empty" : "ready";
});
</script>

<template>
    <PageShell
        :state="resolvedState"
        :source="props.source"
        skeleton="card"
        empty-text="这个历法的简介还没写；规则与建元换算记录在 docs/design.md 里，等对应实体接上数据后再落到本页。">
        <ElAlert
            v-if="props.summary"
            :title="props.summary"
            type="info"
            :closable="false"
            show-icon
            class="entry__summary" />

        <ElDescriptions v-if="props.epoch" title="建元" :column="1" border class="entry__epoch">
            <ElDescriptionsItem label="纪元起点">
                <span class="numeral">{{ props.epoch }}</span>
            </ElDescriptionsItem>
        </ElDescriptions>

        <ElTable :data="props.facts" border class="entry__facts">
            <ElTableColumn prop="label" label="参数" width="220" />
            <ElTableColumn prop="value" label="取值" width="240" class-name="numeral" />
            <ElTableColumn prop="note" label="说明" min-width="240" />
        </ElTable>
    </PageShell>
</template>

<style scoped>
.entry__summary {
    margin-bottom: 16px;
}

.entry__epoch {
    margin-bottom: 16px;
}

.entry__facts {
    width: 100%;
}
</style>
