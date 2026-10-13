<script setup lang="ts">
/**
 * 八字：`/astrology/bazi`。
 *
 * ## 这一页真算的部分
 *
 * 四柱全部来自分库，不是界面推的：
 *
 * | 柱   | 换柱依据                    | 来源                    |
 * | ---- | --------------------------- | ----------------------- |
 * | 年柱 | **立春**（不是正月初一）    | `tree_year` 的 `start`  |
 * | 月柱 | **交节时刻**（精确到秒）    | `tree_month` 的 `start` |
 * | 日柱 | 子时换日（规则可切换）      | `absolute` 的日序号     |
 * | 时柱 | 真太阳时的时辰 + 日干起时干 | 由前两行推出            |
 *
 * ## 界面必须显示的三件事
 *
 * 研究里被反复抱怨的是"软件悄悄替我选了规则"。所以这三项**常驻显示**：
 * 真太阳时换算结果、所处节气、换日规则。用户在口径行里看到
 * "10:00 → 真太阳时 07:50 → 辰时"，就不用怀疑时柱。
 *
 * ## 尚未实现
 *
 * 十神、藏干、大运、流年、神煞。前四项要完整的地支藏干表与起运算法，
 * 神煞各家取法差异很大（研究里"神煞太多也眼花"是明确抱怨）。
 * 与其画一个看起来很全的盘，不如留空并写清楚。
 */

import { ref } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { BRANCHES, BRANCH_HIDDEN_STEMS, STEMS } from "../../share/calendar/sexagenary";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment, voidBranchesOf } from "../../state/use-moment";

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);
const loading = ref(false);
const error = ref("");

const derive = async (): Promise<void> => {
    loading.value = true;
    try {
        facts.value = await deriveMoment(moment.value);
        error.value = facts.value === null ? "这个日期不在库的覆盖范围内（公元前 9999 – 公元 13500）" : "";
    } catch (cause) {
        facts.value = null;
        error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
        loading.value = false;
    }
};

void derive();
</script>

<template>
    <ChartScaffold
        title="八字"
        note="四柱全部取自分库：年柱以立春换、月柱以交节换、日柱按子时换日、时柱由真太阳时的时辰配日干起干。换柱依据的精确时刻来自 tree_year / tree_month / phenology 三张表。"
        basis="子平法"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '十神（比肩 / 劫财 / 食神 …）：需要日干对四柱天干的六亲映射表',
            '地支藏干的本气 / 中气 / 余气取用：表已在 share/calendar/sexagenary.ts，取用顺序未落地',
            '大运与流年：需要起运算法（出生到下一节气的天数 ÷ 3 折年）与十神配合',
            '神煞：天乙贵人、驿马、桃花、华盖等。空亡已给出'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section v-if="facts !== null" class="bazi">
            <div class="bazi__panel">
                <h2 class="xy-panel-title">地支藏干</h2>
                <p class="xy-note">
                    按《三命通会》的本气 / 中气 / 余气顺序（由强到弱）。这一栏是**参考表**，
                    不是推断结果——取用顺序（先看本气、取不到再看中气）尚未落地。
                </p>
                <div class="bazi__hidden">
                    <div v-for="pillar in [facts.yearPillar, facts.monthPillar, facts.dayPillar, facts.hourPillar]" :key="pillar" class="bazi__hidden-item">
                        <span class="bazi__hidden-branch">{{ pillar[1] }}</span>
                        <span class="bazi__hidden-stems">
                            <span
                                v-for="(stemIndex, order) in BRANCH_HIDDEN_STEMS[BRANCHES.indexOf(pillar[1])] ?? []"
                                :key="stemIndex"
                                class="bazi__hidden-stem"
                                :class="{ 'is-primary': order === 0 }">
                                {{ STEMS[stemIndex] }}
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            <div class="bazi__panel">
                <h2 class="xy-panel-title">空亡</h2>
                <p class="xy-note">
                    日柱所在旬的空亡两支：<strong>{{ voidBranchesOf(Number(facts.absolute / 86_400n) - 1) }}</strong>。
                    空亡是少数几个**各家都保留**的神煞（研究里被点名"务必始终显示"），所以单独列出来。
                </p>
            </div>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.bazi {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.bazi__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    padding: 8px 10px;
}

.bazi__anchor {
    background: var(--el-color-danger-light-9);
    border-radius: var(--xy-radius-sm);
    color: var(--el-color-danger);
    font-size: var(--xy-font-2xs);
    margin-left: 6px;
    padding: 0 5px;
}

/*
 * 藏干表：四列横排、每列「支 + 三干」。
 *
 * 它是一张**参考表**不是结论，所以字号降到正文同级；
 * 但列的**对齐**要保住——四柱错位一格就全读错了。
 */
.bazi__hidden {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(4, 1fr);
    margin-top: 6px;
}

.bazi__hidden-item {
    align-items: center;
    background: var(--el-fill-color-lighter);
    border-radius: var(--xy-radius-md);
    display: flex;
    gap: 6px;
    justify-content: center;
    padding: 4px 6px;
}

.bazi__hidden-branch {
    color: var(--el-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
}

.bazi__hidden-stems {
    display: flex;
    gap: 4px;
}

.bazi__hidden-stem {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
}

.bazi__hidden-stem.is-primary {
    color: var(--el-text-color-primary);
    font-weight: var(--xy-weight-semibold);
}
</style>
