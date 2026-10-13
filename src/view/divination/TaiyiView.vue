<script setup lang="ts">
/**
 * 太乙神数：`/divination/taiyi`。
 *
 * 三式之一。太乙的核心是**积年**（从某个上元起算的年数）与由此推出的
 * 太乙所在宫、十六神、主客算。积年的起点各家不同（有取公元前 2357 年、
 * 有取公元前 10153917 年），所以这一页只给出**可核对的输入**，不画盘。
 */

import { computed, ref } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { BRANCHES } from "../../share/calendar/sexagenary";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment } from "../../state/use-moment";

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);
const loading = ref(false);
const error = ref("");

const derive = async (): Promise<void> => {
    loading.value = true;
    try {
        facts.value = await deriveMoment(moment.value);
        error.value = "";
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
        loading.value = false;
    }
};

void derive();

/** 太乙九宫（洛书数）：一宫乾、二宫离、三宫艮、四宫震、六宫兑、七宫坤、八宫坎、九宫巽；五宫为中宫。 */
const PALACES = [
    { number: 1, name: "乾", direction: "西北" },
    { number: 2, name: "离", direction: "南" },
    { number: 3, name: "艮", direction: "东北" },
    { number: 4, name: "震", direction: "东" },
    { number: 5, name: "中", direction: "中" },
    { number: 6, name: "兑", direction: "西" },
    { number: 7, name: "坤", direction: "西南" },
    { number: 8, name: "坎", direction: "北" },
    { number: 9, name: "巽", direction: "东南" }
];

/** 距建元的天数：一个可核对的量，也是积年的基础。 */
const daysSinceEpoch = computed(() => {
    const anchor = facts.value?.absolute;
    return anchor === undefined || anchor === null ? null : Number(anchor / 86_400n);
});
</script>

<template>
  <ChartScaffold
        title="太乙神数"
        note="太乙以「积年」起算：从某个上元到起课年的年数，据此推太乙所在宫、十六神、主客算。本页给出可核对的输入（距建元天数）与九宫框架，积年起点与推算属于待办。"
        basis="太乙九宫"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '上元积年：各家起点不同（公元前 2357 / 10153917 等），需先定流派',
            '太乙所在宫：由积年除以 24（或 72）取余，余数落宫',
            '十六神（地主、阳德、和德…）的排布',
            '主算 / 客算 / 计神 / 太乙数',
            '三基（君基、臣基、民基）与五福、大游、小游'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section v-if="facts !== null" class="ty">
            <div class="ty__panel">
                <h2 class="xy-panel-title">起课输入</h2>
                <ElDescriptions :column="2" border size="small">
                    <ElDescriptionsItem label="距建元">
                        <span class="numeral">{{ daysSinceEpoch }} 天</span>
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label="年柱">{{ facts.yearPillar }}</ElDescriptionsItem>
                    <ElDescriptionsItem label="月柱">{{ facts.monthPillar }}</ElDescriptionsItem>
                    <ElDescriptionsItem label="日柱">{{ facts.dayPillar }}</ElDescriptionsItem>
                </ElDescriptions>
                <p class="xy-note">
                    距建元的天数是一个**确定的量**（库直接给出 `absolute` 除以 86400），
                    任何一家太乙算法都要用它。所以它列在这里，供核对。
                </p>
            </div>

            <div class="ty__panel">
                <h2 class="xy-panel-title">九宫框架</h2>
                <p class="xy-note">
                    洛书数配八卦的固定框架。太乙落宫属于待办，所以格里只写宫位本身。
                </p>
                <div class="ty__grid">
                    <div v-for="palace in PALACES" :key="palace.number" class="ty__cell">
                        <span class="ty__number numeral">{{ palace.number }}</span>
                        <span class="ty__name">{{ palace.name }}</span>
                        <span class="ty__dir xy-dim">{{ palace.direction }}</span>
                    </div>
                </div>
            </div>
        </section>

        <section v-if="facts !== null" class="ty__panel ty__panel--wide">
            <h2 class="xy-panel-title">为什么这一页几乎是空的</h2>
            <p class="xy-note">
                太乙是三式里**传世文本最少、分歧最大**的一门。它的每一步（积年、落宫、
                十六神、主客算）都有多个互不相容的版本，而这些版本的差别会改变结论。
            </p>
            <p class="xy-note">
                本项目的原则是"数据可推"：能核对的量算出来并显示（四柱、距建元天数），
                不能核对的量留空并写清楚。画一个看起来完整、实际是选了某一家的盘面，
                会让用户以为那就是答案。
            </p>
            <p class="xy-note">
                十二地支的框架是确定的：<span class="numeral">{{ BRANCHES.join(" ") }}</span>。
            </p>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.ty {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.ty__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.ty__panel--wide {
    grid-column: 1 / -1;
}

.ty__grid {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 10px;
}

.ty__cell {
    align-items: center;
    aspect-ratio: 1;
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
}

.ty__number {
    color: var(--el-color-primary);
    font-size: var(--xy-font-2xl);
    font-weight: var(--xy-weight-semibold);
}

.ty__name {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-md);
}

.ty__dir {
    font-size: var(--xy-font-2xs);
}
</style>
