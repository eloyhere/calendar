<script setup lang="ts">
/**
 * 大六壬：`/divination/liuren`。
 *
 * ## 真算的部分：月将
 *
 * 六壬的起手是**月将加时**。月将就是太阳所在的星次——也就是太阳的黄经对应的
 * 十二次。这是一个可以**精确算出**的量：太阳黄经每 30° 换一个次。
 *
 * 所以这一页给出真实的月将（由 `astronomy-engine` 算太阳视黄经），
 * 以及由此得到的天地盘框架。四课三传的取法属于待办。
 *
 * ## 为什么月将能算而三传不能算
 *
 * 月将是一个**天文量**（太阳黄经），库外可验。三传是**算法**（贼克法 / 比用法 /
 * 涉害法 / 遥克法 / 昴星法 / 别责法 / 八专法 / 伏吟返吟），每一步都有流派差异，
 * 且需要完整的地支五行生克表。前者算错了能核对，后者算错了只能靠人眼。
 */

import { computed, ref, watch } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { positionsOfDate } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { queryModule } from "../../datasource/runner";
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

/** 十二次与对应的月将（地支）。次序按太阳黄经 0° 起。 */
const TWELVE_CI = [
    { name: "降娄", branch: "戌", from: 0 },
    { name: "大梁", branch: "酉", from: 30 },
    { name: "实沈", branch: "申", from: 60 },
    { name: "鹑首", branch: "未", from: 90 },
    { name: "鹑火", branch: "午", from: 120 },
    { name: "鹑尾", branch: "巳", from: 150 },
    { name: "寿星", branch: "辰", from: 180 },
    { name: "大火", branch: "卯", from: 210 },
    { name: "析木", branch: "寅", from: 240 },
    { name: "星纪", branch: "丑", from: 270 },
    { name: "玄枵", branch: "子", from: 300 },
    { name: "娵訾", branch: "亥", from: 330 }
] as const;

/** 太阳视黄经 → 月将。 */
/*
 * 月将：太阳所在的星次。
 *
 * 日期从库里读。**这一处最要紧**：偏 23 天时太阳只走 23°，
 * 所以"有时对有时错"——跨次时天地盘整个错位、四课三传全废，
 * 而这种偶发的错最难发现。
 */
const sunLongitude = ref<number | null>(null);

watch(
    () => facts.value?.absolute,
    (anchor) => {
        if (anchor === undefined || anchor === null) {
            sunLongitude.value = null;
            return;
        }
        void civilOfAbsolute(anchor, (module, statement, parameters) =>
            queryModule(module, statement, parameters) as never
        )
            .then((civil) => {
                if (civil === null) {
                    sunLongitude.value = null;
                    return;
                }
                const at = dateOfCivil(civil.year, civil.month, civil.day, civil.hour, civil.minute);
                sunLongitude.value = positionsOfDate(at).find((body) => body.id === "sun")?.longitude ?? null;
            })
            .catch(() => {
                sunLongitude.value = null;
            });
    },
    { immediate: true }
);

const moonGeneral = computed(() => {
    const longitude = sunLongitude.value;
    if (longitude === null) {
        return null;
    }
    const index = Math.floor(longitude / 30) % 12;
    return { ...TWELVE_CI[index], longitude };
});

/**
 * 天地盘。
 *
 * 月将加在**时支**上，其余十一支依次顺布——这是六壬"月将加时"的字面意思。
 */
const plates = computed(() => {
    const general = moonGeneral.value;
    if (general === null || facts.value === null) {
        return [];
    }
    const hourBranchIndex = facts.value.hourBranch;
    const generalIndex = BRANCHES.indexOf(general.branch);
    return BRANCHES.map((branch, index) => ({
        earth: branch,
        // 地盘固定，天盘从月将起顺时针错位
        heaven: BRANCHES[(index - generalIndex + hourBranchIndex + 24) % 12] as string
    }));
});
</script>

<template>
    <ChartScaffold
        title="大六壬"
        note="月将加时：月将由太阳视黄经实算（每 30° 一个星次），加在时支上顺布十二支得天盘。四课三传的取法属于待办。"
        basis="月将加时"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '四课：由日干与日支起（干上神、支上神…）',
            '三传：贼克 → 比用 → 涉害 → 遥克 → 昴星 → 别责 → 八专 → 伏吟返吟，八种取法逐级判',
            '十二天将（贵人、螣蛇、朱雀…）：贵人的起法有昼夜贵人与甲戊庚等口诀',
            '旬空：需要日柱所在旬',
            '课体格局（毕法赋一百法）'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section v-if="facts !== null" class="lr">
            <div class="lr__panel">
                <h2 class="xy-panel-title">月将</h2>
                <ElDescriptions :column="2" border size="small">
                    <ElDescriptionsItem label="太阳视黄经">
                        <span class="numeral">{{ moonGeneral?.longitude.toFixed(4) }}°</span>
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label="所在星次">
                        {{ moonGeneral?.name }}
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label="月将">
                        <strong class="lr__general">{{ moonGeneral?.branch }}</strong>
                    </ElDescriptionsItem>
                    <ElDescriptionsItem label="时支">
                        <strong class="lr__general">{{ BRANCHES[facts.hourBranch] }}</strong>
                    </ElDescriptionsItem>
                </ElDescriptions>
                <p class="xy-note">
                    月将是**天文量**：太阳每行 30° 换一次。所以它可以核对——
                    拿任何一本星历查太阳黄经都能验。这正是它与三传的区别。
                </p>
            </div>

            <div class="lr__panel">
                <h2 class="xy-panel-title">天地盘</h2>
                <p class="xy-note">月将加时支，顺布十二支。上为天盘，下为地盘。</p>
                <div class="lr__plates">
                    <div v-for="plate in plates" :key="plate.earth" class="lr__plate">
                        <span class="lr__heaven">{{ plate.heaven }}</span>
                        <span class="lr__divider" />
                        <span class="lr__earth">{{ plate.earth }}</span>
                    </div>
                </div>
            </div>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.lr {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
}

.lr__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.lr__general {
    color: var(--el-color-primary);
    font-size: var(--xy-font-lg);
}

.lr__plates {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(6, 1fr);
    margin-top: 10px;
}

/* 上下两支：天盘在上、地盘在下，中间一条短线。对齐是硬要求——错一格课就变了 */
.lr__plate {
    align-items: center;
    background: var(--el-fill-color-lighter);
    border-radius: var(--xy-radius-md);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 0;
}

.lr__heaven {
    color: var(--el-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
}

.lr__divider {
    background: var(--el-border-color);
    height: 1px;
    width: 60%;
}

.lr__earth {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-md);
}
</style>
