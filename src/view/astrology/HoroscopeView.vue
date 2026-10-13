<script setup lang="ts">
/**
 * 西方星盘：`/astrology/horoscope`。
 *
 * ## 真算的部分
 *
 * - 九大天体的**回归黄道**黄经（`astronomy-engine`）；
 * - 主要相位，**容差 ±3°**，且用线型区分：合/冲实线、刑拱虚线
 *   （Solar Fire 的做法——把"紧密"与"宽松"分开，也照顾色觉障碍）；
 * - 黄道十二宫的轮盘。
 *
 * ## 尚未实现
 *
 * 宫位（Placidus / Koch / Whole Sign）需要出生地的**纬度**与上升点计算，
 * 上升点又要恒星时。这些是下一步；界面上把三种宫位制的名字列出来，
 * 但不假装已经算过。
 *
 * 这一页与「七政四余」的关键差别是**坐标口径**：这里用回归黄道（春分点为 0°），
 * 七政四余用恒星黄道。两者相差一个岁差量（2026 年约 24.3°），
 * 所以同一个天体在两页的"入宫度"会差将近一个宫。
 */

import { computed, ref, watch } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { ZODIAC, positionsOfDate, separation } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { queryModule } from "../../datasource/runner";
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

/*
 * 九大天体的位置。
 *
 * 日期从库里读。星盘的宫位与相位都以黄经为准，偏 23 天会让所有相位错位——
 * 而相位正是解读的主体。
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

const positions = computed(() => (date.value === null ? [] : positionsOfDate(date.value)));

/** 轮盘上的点。 */
const plotted = computed(() =>
    positions.value.map((body) => {
        const theta = (body.longitude * Math.PI) / 180;
        return {
            ...body,
            x: 0.5 + 0.38 * Math.sin(theta),
            y: 0.5 - 0.38 * Math.cos(theta)
        };
    })
);

/** 主要相位。 */
const aspects = computed(() => {
    const out: { from: string; to: string; label: string; orb: number; angle: number }[] = [];
    const list = positions.value;
    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            const diff = separation(list[i].longitude, list[j].longitude);
            for (const [angle, label] of [
                [0, "合"],
                [60, "六合"],
                [90, "刑"],
                [120, "拱"],
                [180, "冲"]
            ] as [number, string][]) {
                const orb = Math.abs(diff - angle);
                if (orb <= 3) {
                    out.push({ from: list[i].id, to: list[j].id, label, orb, angle });
                }
            }
        }
    }
    return out;
});

/** 十二宫扇区。 */
const sectors = computed(() =>
    ZODIAC.map((sign, index) => {
        const from = (index * 30 * Math.PI) / 180;
        const to = ((index + 1) * 30 * Math.PI) / 180;
        const o = 0.44;
        const i = 0.36;
        return {
            sign,
            path:
                `M ${0.5 + o * Math.sin(from)} ${0.5 - o * Math.cos(from)} ` +
                `A ${o} ${o} 0 0 1 ${0.5 + o * Math.sin(to)} ${0.5 - o * Math.cos(to)} ` +
                `L ${0.5 + i * Math.sin(to)} ${0.5 - i * Math.cos(to)} ` +
                `A ${i} ${i} 0 0 0 ${0.5 + i * Math.sin(from)} ${0.5 - i * Math.cos(from)} Z`
        };
    })
);
</script>

<template>
    <ChartScaffold
        title="西方星盘"
        note="九大天体的黄经由 astronomy-engine 实算，用回归黄道（春分点为 0°），与「七政四余」的恒星黄道差一个岁差量。主要相位容差 ±3°，刑拱用虚线——线型是第二通道，不只靠颜色区分。"
        basis="回归黄道"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '上升点与天顶：需要出生地纬度与当地恒星时',
            '宫位制（Placidus / Koch / Whole Sign / 等宫）：三种算法不同，需先选一种',
            '宫主星与飞星：需要宫头星座到守护星的映射',
            '相位容许度按星体分级（太阳 15°、月亮 12°…）：当前一律 ±3°'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section class="hor">
            <div class="hor__wheel">
                <h2 class="xy-panel-title">黄道轮</h2>
                <svg viewBox="0 0 1 1" class="hor__svg" role="img" aria-label="黄道十二宫与行星位置">
                    <path
                        v-for="(sector, index) in sectors"
                        :key="sector.sign.id"
                        :d="sector.path"
                        class="hor__sector"
                        :class="{ 'is-alt': index % 2 === 1 }" />

                    <circle cx="0.5" cy="0.5" r="0.44" class="hor__ring" />
                    <circle cx="0.5" cy="0.5" r="0.36" class="hor__ring" />

                    <line
                        v-for="aspect in aspects"
                        :key="`${aspect.from}-${aspect.to}-${aspect.angle}`"
                        :x1="plotted.find((item) => item.id === aspect.from)?.x ?? 0.5"
                        :y1="plotted.find((item) => item.id === aspect.from)?.y ?? 0.5"
                        :x2="plotted.find((item) => item.id === aspect.to)?.x ?? 0.5"
                        :y2="plotted.find((item) => item.id === aspect.to)?.y ?? 0.5"
                        class="hor__aspect"
                        :class="[`hor__aspect--${aspect.angle}`, { 'is-hard': aspect.angle === 90 || aspect.angle === 180 }]" />

                    <g v-for="body in plotted" :key="body.id">
                        <circle :cx="body.x" :cy="body.y" r="0.012" :fill="body.color" class="hor__body" />
                        <text :x="body.x" :y="body.y + 0.005" class="hor__glyph">{{ body.glyph }}</text>
                    </g>

                    <text
                        v-for="(sector, index) in sectors"
                        :key="`label-${sector.sign.id}`"
                        :x="0.5 + 0.47 * Math.sin(((index * 30 + 15) * Math.PI) / 180)"
                        :y="0.5 - 0.47 * Math.cos(((index * 30 + 15) * Math.PI) / 180) + 0.008"
                        class="hor__sign">
                        {{ sector.sign.glyph }}
                    </text>
                </svg>
            </div>

            <div class="hor__side">
                <h2 class="xy-panel-title">相位</h2>
                <ElTable :data="aspects" size="small" max-height="240" class="hor__table">
                    <ElTableColumn label="相位" width="76">
                        <template #default="{ row }">{{ row.label }}</template>
                    </ElTableColumn>
                    <ElTableColumn label="天体" min-width="140">
                        <template #default="{ row }">
                            {{ positions.find((item) => item.id === row.from)?.glyph }}
                            {{ positions.find((item) => item.id === row.from)?.label }}
                            –
                            {{ positions.find((item) => item.id === row.to)?.glyph }}
                            {{ positions.find((item) => item.id === row.to)?.label }}
                        </template>
                    </ElTableColumn>
                    <ElTableColumn label="容许度" width="92" align="right" class-name="numeral">
                        <template #default="{ row }">±{{ row.orb.toFixed(2) }}°</template>
                    </ElTableColumn>
                </ElTable>

                <h2 class="xy-panel-title hor__side-title">位置</h2>
                <ElTable :data="positions" size="small" max-height="300" class="hor__table">
                    <ElTableColumn label="天体" width="92">
                        <template #default="{ row }">{{ row.glyph }} {{ row.label }}</template>
                    </ElTableColumn>
                    <ElTableColumn label="宫" width="88">
                        <template #default="{ row }">{{ row.sign.glyph }} {{ row.sign.label }}</template>
                    </ElTableColumn>
                    <ElTableColumn label="宫度" min-width="80" align="right" class-name="numeral">
                        <template #default="{ row }">{{ row.degreeInSign.toFixed(2) }}°</template>
                    </ElTableColumn>
                </ElTable>
            </div>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.hor {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) 380px;
}

.hor__wheel,
.hor__side {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.hor__svg {
    display: block;
    width: 100%;
}

.hor__sector {
    fill: var(--el-fill-color-lighter);
}

.hor__sector.is-alt {
    fill: var(--el-fill-color-light);
}

.hor__ring {
    fill: none;
    stroke: var(--el-border-color);
    stroke-width: 0.0015;
}

.hor__aspect {
    stroke-width: 0.0012;
}

.hor__aspect--0 {
    stroke: var(--el-color-warning);
}

.hor__aspect--60,
.hor__aspect--120 {
    stroke: var(--el-color-success);
}

.hor__aspect--90,
.hor__aspect--180 {
    stroke: var(--el-color-danger);
}

/* 刑与冲虚化：线型是与颜色并列的第二通道 */
.hor__aspect.is-hard {
    stroke-dasharray: 0.01 0.008;
}

.hor__body {
    stroke: #fff;
    stroke-width: 0.002;
}

.hor__glyph {
    fill: #fff;
    font-size: 0.018px;
    text-anchor: middle;
}

.hor__sign {
    fill: var(--el-text-color-placeholder);
    font-size: 0.018px;
    text-anchor: middle;
}

.hor__side-title {
    margin-top: 16px;
}

.hor__table {
    width: 100%;
}
</style>
