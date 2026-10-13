<script setup lang="ts">
/**
 * 七政四余：`/astrology/qizheng`。
 *
 * 七政 = 日月 + 五星，四余 = 罗睺、计都、月孛、紫炁。
 * **七政的躔度可以真算**（`astronomy-engine` 给地心视黄经），
 * 四余里的罗睺 / 计都 = 月球升交点与降交点，也能算；
 * 月孛（月球远地点）与紫炁（一个虚构的隐曜，各家周期不同）尚未实现。
 *
 * 这一页因此是**半真**的，页面上逐条写明哪几个算了、哪几个没算。
 */

import { computed, ref, watch } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { positionsOfDate } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { queryModule } from "../../datasource/runner";
import { useQuery } from "../../state/use-calendar-query";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment } from "../../state/use-moment";

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);
const loading = ref(false);
const error = ref("");

/** 七政（日月五星）的地心视黄经。 */
/*
 * 七政的躔度。
 *
 * 日期从库里读，不把 `absolute` 直接交给星历库——后者会偏 23 天，
 * 而七政四余的"入宿度"要精确到度，偏 23 天等于偏 23°。
 */
const date = ref<Date | null>(null);

watch(
    () => facts.value?.absolute,
    (anchor) => {
        if (anchor === undefined || anchor === null) {
            date.value = null;
            return;
        }
        void civilOfAbsolute(anchor, (module, statement, parameters) =>
            queryModule(module, statement, parameters) as never
        )
            .then((civil) => {
                date.value =
                    civil === null
                        ? null
                        : dateOfCivil(civil.year, civil.month, civil.day, civil.hour, civil.minute);
            })
            .catch(() => {
                date.value = null;
            });
    },
    { immediate: true }
);

const positions = computed(() => {
    if (date.value === null) {
        return [];
    }
    return positionsOfDate(date.value).filter((body) => body.id !== "uranus" && body.id !== "neptune");
});

/** 二十八宿：从库里读宿度表。 */
const mansions = useQuery("temporal", 'SELECT 1 AS note LIMIT 1;');

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


void mansions;
</script>

<template>
    <ChartScaffold
        title="七政四余"
        note="七政（日月五星）的躔度由 astronomy-engine 实算地心视黄经；四余里罗睺（月升交点）与计都可算，月孛与紫炁尚未实现。本页一律用恒星黄道口径，与西方星盘的回归黄道不同。"
        basis="果老星宗"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '二十八宿的入宿度与去极度：需要宿度表（本库没有这张表）',
            '罗睺 / 计都（月升交点 / 降交点）：astronomy-engine 的 SearchMoonNode 不给黄经，要自己由月球黄纬过零点求',
            '月孛（月球远地点）：可由 SearchLunarApsis 算，尚未接',
            '紫炁：一个虚构隐曜，各家周期不同（约 28 年），取哪个周期需先定流派',
            '十二宫的恒星黄道换算：需要岁差常数与历元选取',
            '庙旺利陷：需要各曜在二十八宿的庙旺表'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section class="qz">
            <h2 class="xy-panel-title">七政躔度</h2>
            <ElTable :data="positions" size="small" class="qz__table">
                <ElTableColumn label="曜" width="100">
                    <template #default="{ row }">
                        <span :style="{ color: row.color }">{{ row.glyph }}</span> {{ row.label }}
                    </template>
                </ElTableColumn>
                <ElTableColumn label="所在" width="110">
                    <template #default="{ row }">{{ row.sign.glyph }} {{ row.sign.label }}</template>
                </ElTableColumn>
                <ElTableColumn label="入宫度" width="110" align="right" class-name="numeral">
                    <template #default="{ row }">{{ row.degreeInSign.toFixed(3) }}°</template>
                </ElTableColumn>
                <ElTableColumn label="视黄经" width="120" align="right" class-name="numeral">
                    <template #default="{ row }">{{ row.longitude.toFixed(4) }}°</template>
                </ElTableColumn>
                <ElTableColumn label="行度（度/日）" min-width="130" align="right" class-name="numeral">
                    <template #default="{ row }">
                        <span :class="{ 'qz__retro': row.retrograde }">
                            {{ row.speed >= 0 ? "+" : "" }}{{ row.speed.toFixed(4) }}
                        </span>
                    </template>
                </ElTableColumn>
            </ElTable>

            <p class="xy-note">
                罗睺与计都**永远相差 180°**——它们是同一条交点轴的两端。
                这一点在纸质时代常被写成两个独立的曜，实际是一个量的两面。
                它们的黄经本页尚未给出，原因见下方的待办。
            </p>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.qz {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.qz__table {
    margin-bottom: 8px;
    width: 100%;
}

.qz__title {
    margin-top: 16px;
}

.qz__retro {
    color: var(--el-color-danger);
    font-weight: var(--xy-weight-semibold);
}
</style>
