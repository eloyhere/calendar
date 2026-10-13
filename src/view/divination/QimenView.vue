<script setup lang="ts">
/**
 * 奇门遁甲：`/divination/qimen`。
 *
 * 这一页给出**真实可算的那部分**：四柱、节气、阴阳遁与局数的判据。
 * 九宫排布（八门 / 九星 / 八神 / 三奇六仪）尚未实现——原因写在待办里。
 *
 * 为什么把局数单独算出来：**阳遁阴遁与局数是奇门的入口**，它由节气与三元决定，
 * 而节气是本库的精确数据。这一层算对了，后面的排布才有意义。
 */

import { computed, ref } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
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

/**
 * 阳遁 / 阴遁。
 *
 * 判据是**冬至到夏至用阳遁，夏至到冬至用阴遁**——按节气名判断，
 * 不按公历月份。二至是分界：冬至一阳生（阳遁起），夏至一阴生（阴遁起）。
 */
const YANG_TERMS = ["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种"];

const dun = computed(() => {
    const term = facts.value?.solarTerm ?? "";
    if (term.length === 0) {
        return null;
    }
    return { yang: YANG_TERMS.includes(term), term };
});

/**
 * 局数。
 *
 * 传统口诀"冬至惊蛰一七四，小寒二八五相随…"给出每个节气**上中下三元**的三局。
 * 这里只给出**节气对应的三个候选局**，不定元——定元要按日干支的符头（甲己日为符头，
 * 五日一元），而那一步需要完整的日干支序列与超接置闰规则，
 * 各家分歧很大，属于待办。
 */
const JU_TABLE: Record<string, [number, number, number]> = {
    冬至: [1, 7, 4],
    小寒: [2, 8, 5],
    大寒: [3, 9, 6],
    立春: [8, 5, 2],
    雨水: [9, 6, 3],
    惊蛰: [1, 7, 4],
    春分: [3, 9, 6],
    清明: [4, 1, 7],
    谷雨: [5, 2, 8],
    立夏: [4, 1, 7],
    小满: [5, 2, 8],
    芒种: [6, 3, 9],
    夏至: [9, 3, 6],
    小暑: [8, 2, 5],
    大暑: [7, 1, 4],
    立秋: [2, 5, 8],
    处暑: [1, 4, 7],
    白露: [9, 3, 6],
    秋分: [7, 1, 4],
    寒露: [6, 9, 3],
    霜降: [5, 8, 2],
    立冬: [6, 9, 3],
    小雪: [5, 8, 2],
    大雪: [4, 7, 1]
};

const candidates = computed(() => {
    const term = facts.value?.solarTerm ?? "";
    return JU_TABLE[term] ?? null;
});
</script>

<template>
    <ChartScaffold
        title="奇门遁甲"
        note="时家奇门。四柱与节气取自分库（精确到交节时刻），阴阳遁按「冬至一阳生、夏至一阴生」判定，局数给出该节气的上中下三元三个候选。"
        basis="时家转盘"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '定元（上元 / 中元 / 下元）：要按日干支的符头推，五日一元',
            '超接置闰：各家分歧最大的一处（超神 / 接气 / 置闰 / 拆补），需先定流派',
            '九宫排布：地盘三奇六仪（戊己庚辛壬癸丁丙乙顺布六仪逆布三奇）',
            '天盘九星、八门、八神（值符值使随时干转）',
            '九宫格与二十四方位的图形排布'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section v-if="facts !== null" class="qm">
            <div class="qm__panel">
                <h2 class="xy-panel-title">遁与局</h2>
                <ElDescriptions :column="3" border size="small">
                    <ElDescriptionsItem label="节气">{{ facts.solarTerm }}</ElDescriptionsItem>
                    <ElDescriptionsItem label="阴阳遁">
                        <ElTag :type="dun?.yang === true ? 'danger' : 'primary'" size="small" effect="plain">
                            {{ dun?.yang === true ? "阳遁" : "阴遁" }}
                        </ElTag>
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label="候选局数">
                        <span v-if="candidates !== null" class="numeral">
                            {{ candidates[0] }} 局（上元） · {{ candidates[1] }} 局（中元） ·
                            {{ candidates[2] }} 局（下元）
                        </span>
                        <span v-else>—</span>
                    </ElDescriptionsItem>
                </ElDescriptions>

                <p class="xy-note">
                    「{{ facts.solarTerm }}」的三个候选局**不对应具体某一元**——
                    定元要看日干支的符头，那一步属于待办。所以这里给的是"这一节气可能落在哪三局"，
                    不是"这一时刻是第几局"。
                </p>
            </div>

            <div class="qm__panel">
                <h2 class="xy-panel-title">时辰</h2>
                <ElDescriptions :column="2" border size="small">
                    <ElDescriptionsItem label="时柱">{{ facts.hourPillar }}</ElDescriptionsItem>
                    <ElDescriptionsItem label="日柱">{{ facts.dayPillar }}</ElDescriptionsItem>
                    <ElDescriptionsItem label="旬首">—</ElDescriptionsItem>
                    <ElDescriptionsItem label="值符 / 值使">—</ElDescriptionsItem>
                </ElDescriptions>
                <p class="xy-note">
                    旬首与值符值使要由**时柱所在旬**推出（旬首即六仪中的哪一个），
                    再据旬首落宫转天盘。这一步属于待办。
                </p>
            </div>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.qm {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
}

.qm__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}
</style>
