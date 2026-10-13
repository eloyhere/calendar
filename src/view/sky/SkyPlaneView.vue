<script setup lang="ts">
/**
 * 天象·复平面：`/sky/plane`。
 *
 * ## 为什么是"复平面"
 *
 * 黄道是一个圆，而圆上的位置**天然是复数**：`z = e^{iθ}`，θ 是黄经。
 * 把九个大天体各画成一个点放在单位圆上，就同时表达了三件事：
 *
 * 1. **黄经**——点的角度；
 * 2. **距离**——点的半径（对数压缩，否则海王星会把内行星压成一团）；
 * 3. **逆行**——点旁边的一个小箭头。
 *
 * 用一个 `ElCalendar` 式的表格做不到这个：黄经是个角度量，
 * 写成数字要读 25 行才看出来"金木相冲"。
 *
 * ## 黄经全部由 `astronomy-engine` 真算
 *
 * 日月与八大行星的地心视黄经来自 VSOP87 / ELP2000 的截断级数
 * （见 `share/astronomy/ephemeris.ts`）。**不做匀速圆轨道的近似**：
 * 那画出来虽然好看，但和旁边 98 张真表放在一起就是假的。
 *
 * ## 时间轴可以拖
 *
 * 拖时间轴时按 `scheduler` 的分片调度算位置（`share/class/task-scheduler.ts`）——
 * 一次算九个天体的级数要几毫秒，连续拖动时会掉帧。
 */

import { computed, onUnmounted, ref, shallowRef, watch } from "vue";

import PageShell from "../../component/PageShell.vue";

import type { BodyPosition } from "../../share/astronomy/ephemeris";
import { BODIES, ZODIAC, positionsOfDate, separation } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { queryModule } from "../../datasource/runner";
import { useQuery } from "../../state/use-calendar-query";
import { scheduler } from "../../share/class/task-scheduler";

/** 把一个个天体的位置算出来（异步分片，避免拖动时间轴时掉帧）。 */
/**
 * 算九个天体的位置。
 *
 * **先查库拿到公历日期，再交给星历**——不能把 `absolute` 直接交给星历库，
 * 那样会偏 23 天（见 `share/astronomy/civil-date.ts` 的文件头）。
 * 这是"复平面"这一页此前每一个天体都偏 23 天的原因。
 */
function usePositions(absolute: import("vue").ComputedRef<bigint>) {
    const positions = shallowRef<BodyPosition[]>([]);
    const computing = ref(false);
    let cancel: (() => void) | null = null;

    const recompute = async (): Promise<void> => {
        cancel?.();
        computing.value = true;
        const target: bigint = absolute.value;

        let date: Date;
        try {
            const civil = await civilOfAbsolute(target, (module, statement, parameters) =>
                queryModule(module, statement, parameters) as never
            );
            if (civil === null) {
                positions.value = [];
                computing.value = false;
                return;
            }
            date = dateOfCivil(civil.year, civil.month, civil.day, civil.hour, civil.minute);
        } catch {
            positions.value = [];
            computing.value = false;
            return;
        }

        // 放到调度器的中优先级：它是"预取"，用户此刻盯的是别的
        cancel = scheduler.push("medium", () => {
            positions.value = positionsOfDate(date);
            computing.value = false;
            return true;
        });
    };

    watch(absolute, () => void recompute(), { immediate: true });
    onUnmounted(() => cancel?.());

    return { positions, computing };
}

/** 当前时刻（`absolute`）：从 `today` 那一天的 0 点起算。 */
const cursor = ref<bigint | null>(null);


/*
 * 起点：直接查 `gregory_month` 拿当月的 `start`，再加天数偏移。
 * 与 `state/use-calendar-month.ts` 同一个口径。
 */
const now = new Date();
const monthStart = useQuery("gregory", () =>
    `SELECT "start", "lengthOfDay" FROM "gregory_month" WHERE "year" = ${now.getFullYear() + 10_000} AND "ordinal" = ${now.getMonth() + 1} LIMIT 1;`
);

watch(
    monthStart.rows,
    (rows) => {
        const row = rows[0];
        if (row === undefined || cursor.value !== null) {
            return;
        }
        const start = BigInt(String(row.start));
        const day = Math.min(Number(row.lengthOfDay), now.getDate());
        cursor.value = start + BigInt(day - 1) * 86_400n + BigInt(now.getHours() * 3600 + now.getMinutes() * 60);
    },
    { immediate: true }
);

const absolute = computed<bigint>(() => cursor.value ?? 0n);
const { positions, computing } = usePositions(absolute);

/** 拖动时间轴：按小时走。 */
const shift = (hours: number): void => {
    if (cursor.value === null) {
        return;
    }
    cursor.value += BigInt(hours) * 3600n;
};

const reset = (): void => {
    if (cursor.value === null) {
        return;
    }
    const remainder = ((cursor.value % 86_400n) + 86_400n) % 86_400n;
    cursor.value -= remainder;
};

/** 此刻的日期表达。 */
const stamp = computed(() => {
    const value = cursor.value;
    if (value === null) {
        return "";
    }
    return `${value}`;
});

/**
 * 复平面上的坐标。
 *
 * 半径用**对数压缩**：海王星 30 AU、月球 0.0026 AU，线性画的话内行星全挤在圆心。
 * `log10` 之后 0.0026 → −2.6、30 → 1.5，跨度 4 个数量级压到 4 个单位。
 */
const plotted = computed(() =>
    positions.value.map((body) => {
        const radius = Math.log10(Math.max(body.distance, 0.0001));
        // 映射到 0.18–0.92 的圆环带
        const r = 0.18 + ((radius + 3) / 5) * 0.74;
        const theta = (body.longitude * Math.PI) / 180;
        return {
            ...body,
            x: 0.5 + (r / 2) * Math.sin(theta),
            // SVG 的 y 轴向下，而黄经逆时针增长，所以取负
            y: 0.5 - (r / 2) * Math.cos(theta),
            radius: r / 2
        };
    })
);

/** 主要相位：合、冲、刑、拱。用于在圆上加连线。 */
const aspects = computed(() => {
    const out: { from: string; to: string; label: string; angle: number }[] = [];
    const list = positions.value;
    for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
            const diff = separation(list[i].longitude, list[j].longitude);
            const candidates: [number, string][] = [
                [0, "合"],
                [60, "六合"],
                [90, "刑"],
                [120, "拱"],
                [180, "冲"]
            ];
            for (const [angle, label] of candidates) {
                if (Math.abs(diff - angle) <= 3) {
                    out.push({ from: list[i].id, to: list[j].id, label, angle });
                }
            }
        }
    }
    return out;
});

/** 位置表：右栏的逐行读数。 */
const tableRows = computed(() =>
    positions.value.map((body) => ({
        id: body.id,
        label: body.label,
        glyph: body.glyph,
        color: body.color,
        sign: `${body.sign.glyph} ${body.sign.label}`,
        degree: `${body.degreeInSign.toFixed(2)}°`,
        longitude: `${body.longitude.toFixed(3)}°`,
        distance: body.distance < 0.01 ? `${(body.distance * 149_597_871).toFixed(0)} km` : `${body.distance.toFixed(3)} AU`,
        speed: `${body.speed >= 0 ? "+" : ""}${body.speed.toFixed(4)}°/d`,
        retrograde: body.retrograde
    }))
);

/** 十二宫的扇区路径。 */
const sectors = computed(() =>
    ZODIAC.map((sign, index) => {
        const from = (index * 30 * Math.PI) / 180;
        const to = ((index + 1) * 30 * Math.PI) / 180;
        const outer = 0.5;
        const inner = 0.44;
        const x1 = 0.5 + outer * Math.sin(from);
        const y1 = 0.5 - outer * Math.cos(from);
        const x2 = 0.5 + outer * Math.sin(to);
        const y2 = 0.5 - outer * Math.cos(to);
        const x3 = 0.5 + inner * Math.sin(to);
        const y3 = 0.5 - inner * Math.cos(to);
        const x4 = 0.5 + inner * Math.sin(from);
        const y4 = 0.5 - inner * Math.cos(from);
        return { sign, path: `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z` };
    })
);
</script>

<template>
    <PageShell
        :state="monthStart.state.value"
        :error-text="monthStart.error.value"
        :card="false"
        :scroll="false"
        source="astronomy-engine（VSOP87 / ELP2000 截断级数）"
        @retry="monthStart.reload">
        <div class="sky">
            <header class="sky__head">
                <div>
                    <h1 class="sky__title">复平面</h1>
                    <p class="sky__note">
                        黄经是角度量，圆上的位置天然是复数 <span class="numeral">z = e^(iθ)</span>。
                        点的**角度**是黄经、**半径**是距离（对数压缩，否则海王星会把内行星压成一团）、
                        **箭头**表示逆行。全部由 <span class="numeral">astronomy-engine</span> 实算，不做匀速圆轨道近似。
                    </p>
                </div>

                <div class="sky__controls">
                    <ElButtonGroup>
                        <ElButton text @click="shift(-24 * 30)">−30天</ElButton>
                        <ElButton text @click="shift(-24)">−1天</ElButton>
                        <ElButton text @click="shift(-1)">−1时</ElButton>
                        <ElButton text @click="reset">当天</ElButton>
                        <ElButton text @click="shift(1)">+1时</ElButton>
                        <ElButton text @click="shift(24)">+1天</ElButton>
                        <ElButton text @click="shift(24 * 30)">+30天</ElButton>
                    </ElButtonGroup>
                    <span v-if="computing" class="xy-dim">计算中…</span>
                    <span class="xy-dim numeral">absolute {{ stamp }}</span>
                </div>
            </header>

            <div class="sky__body">
                <!-- ① 复平面 -->
                <div class="sky__chart">
                    <svg viewBox="0 0 1 1" class="sky__svg" role="img" aria-label="九大天体的黄经位置">
                        <!-- 十二宫扇区 -->
                        <path
                            v-for="(sector, index) in sectors"
                            :key="sector.sign.id"
                            :d="sector.path"
                            class="sky__sector"
                            :class="{ 'is-alt': index % 2 === 1 }" />

                        <!-- 刻度环 -->
                        <circle cx="0.5" cy="0.5" r="0.5" class="sky__ring" />
                        <circle cx="0.5" cy="0.5" r="0.44" class="sky__ring" />
                        <circle cx="0.5" cy="0.5" r="0.18" class="sky__ring sky__ring--faint" />

                        <!-- 相位连线：只画主要相位，且细一点，避免糊成一团 -->
                        <line
                            v-for="aspect in aspects"
                            :key="`${aspect.from}-${aspect.to}-${aspect.angle}`"
                            :x1="plotted.find((item) => item.id === aspect.from)?.x ?? 0.5"
                            :y1="plotted.find((item) => item.id === aspect.from)?.y ?? 0.5"
                            :x2="plotted.find((item) => item.id === aspect.to)?.x ?? 0.5"
                            :y2="plotted.find((item) => item.id === aspect.to)?.y ?? 0.5"
                            class="sky__aspect"
                            :class="`sky__aspect--${aspect.angle}`" />

                        <!-- 天体 -->
                        <g v-for="body in plotted" :key="body.id">
                            <circle :cx="body.x" :cy="body.y" :r="0.014" :fill="body.color" class="sky__body" />
                            <text :x="body.x" :y="body.y + 0.005" class="sky__glyph">{{ body.glyph }}</text>
                            <text :x="body.x" :y="body.y + 0.038" class="sky__label">{{ body.label }}</text>
                            <!-- 逆行：一个小三角，用形状而不是颜色（WCAG 1.4.1） -->
                            <text
                                v-if="body.retrograde"
                                :x="body.x + 0.022"
                                :y="body.y - 0.016"
                                class="sky__retro">
                                R
                            </text>
                        </g>

                        <!-- 十二宫名 -->
                        <text
                            v-for="(sector, index) in sectors"
                            :key="`label-${sector.sign.id}`"
                            :x="0.5 + 0.47 * Math.sin(((index * 30 + 15) * Math.PI) / 180)"
                            :y="0.5 - 0.47 * Math.cos(((index * 30 + 15) * Math.PI) / 180) + 0.008"
                            class="sky__sign">
                            {{ sector.sign.label }}
                        </text>
                    </svg>

                    <!-- 相位图例 -->
                    <div class="sky__aspects">
                        <span class="sky__aspect-item"><i class="sky__aspect-key sky__aspect--0" />合 0°</span>
                        <span class="sky__aspect-item"><i class="sky__aspect-key sky__aspect--60" />六合 60°</span>
                        <span class="sky__aspect-item"><i class="sky__aspect-key sky__aspect--90" />刑 90°</span>
                        <span class="sky__aspect-item"><i class="sky__aspect-key sky__aspect--120" />拱 120°</span>
                        <span class="sky__aspect-item"><i class="sky__aspect-key sky__aspect--180" />冲 180°</span>
                        <span class="xy-dim">（容差 ±3°）</span>
                    </div>
                </div>

                <!-- ② 逐行读数 -->
                <aside class="sky__aside">
                    <h2 class="xy-panel-title">位置</h2>
                    <ElTable :data="tableRows" size="small" class="sky__table" max-height="480">
                        <ElTableColumn label="天体" width="86">
                            <template #default="{ row }">
                                <span class="sky__cell-body">
                                    <i class="sky__dot" :style="{ background: row.color }" />
                                    {{ row.glyph }} {{ row.label }}
                                </span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn prop="sign" label="星座" width="88" />
                        <ElTableColumn prop="degree" label="宫度" width="76" align="right" class-name="numeral" />
                        <ElTableColumn prop="speed" label="速度" width="86" align="right" class-name="numeral">
                            <template #default="{ row }">
                                <span :class="{ 'sky__retro-text': row.retrograde }">{{ row.speed }}</span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn prop="distance" label="距离" min-width="92" align="right" class-name="numeral" />
                    </ElTable>

                    <p class="xy-note">
                        速度是地心视黄经的变化率（度/日）。**外行星的逆行是地心视角的错觉**——
                        用日心黄经永远判不出来，所以这里一律用视黄经求导。
                    </p>

                    <h2 class="xy-panel-title sky__aside-title">九大天体</h2>
                    <p class="xy-note">
                        月球 + 八大行星。太阳也画出来，因为占星与七政四余都以它为基准
                        （七政 = 日月 + 五星）。
                    </p>
                    <div class="sky__body-list">
                        <span v-for="body in BODIES" :key="body.id" class="sky__body-chip">
                            <i class="sky__dot" :style="{ background: body.color }" />
                            {{ body.glyph }} {{ body.label }}
                        </span>
                    </div>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.sky {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.sky__head {
    align-items: flex-start;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 10px 16px;
}

.sky__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.sky__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 80ch;
}

.sky__controls {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.sky__body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
    padding: 12px;
}

.sky__chart {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    padding: 10px;
}

.sky__svg {
    flex: 1;
    min-height: 0;
    width: 100%;
}

.sky__sector {
    fill: var(--el-fill-color-lighter);
}

.sky__sector.is-alt {
    fill: var(--el-fill-color-light);
}

.sky__ring {
    fill: none;
    stroke: var(--el-border-color);
    stroke-width: 0.0015;
}

.sky__ring--faint {
    stroke: var(--el-border-color-lighter);
}

.sky__aspect {
    stroke-width: 0.0012;
}

.sky__aspect--0 {
    stroke: var(--el-color-danger);
}

.sky__aspect--60 {
    stroke: var(--el-color-success);
}

.sky__aspect--90 {
    stroke: var(--el-color-danger);
    stroke-dasharray: 0.008 0.006;
}

.sky__aspect--120 {
    stroke: var(--el-color-success);
    stroke-dasharray: 0.008 0.006;
}

.sky__aspect--180 {
    stroke: var(--el-color-warning);
}

.sky__body {
    stroke: #fff;
    stroke-width: 0.002;
}

.sky__glyph {
    fill: #fff;
    font-size: 0.02px;
    text-anchor: middle;
}

.sky__label {
    fill: var(--el-text-color-regular);
    font-size: 0.016px;
    text-anchor: middle;
}

.sky__retro {
    fill: var(--el-color-danger);
    font-size: 0.018px;
    font-weight: 700;
}

.sky__sign {
    fill: var(--el-text-color-placeholder);
    font-size: 0.016px;
    text-anchor: middle;
}

.sky__aspects {
    align-items: center;
    color: var(--el-text-color-secondary);
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    font-size: var(--xy-font-2xs);
    gap: 12px;
    padding-top: 8px;
}

.sky__aspect-item {
    align-items: center;
    display: inline-flex;
    gap: 4px;
}

.sky__aspect-key {
    display: inline-block;
    height: 0;
    width: 14px;
    border-top-width: 2px;
    border-top-style: solid;
}

.sky__aside {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex-shrink: 0;
    overflow-y: auto;
    padding: 12px 14px;
    width: 380px;
}

.sky__aside-title {
    margin-top: 16px;
}

.sky__cell-body {
    align-items: center;
    display: inline-flex;
    gap: 5px;
}

.sky__dot {
    border-radius: 50%;
    display: inline-block;
    height: 8px;
    width: 8px;
}

.sky__retro-text {
    color: var(--el-color-danger);
    font-weight: var(--xy-weight-semibold);
}

.sky__body-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.sky__body-chip {
    align-items: center;
    background: var(--el-fill-color-lighter);
    border-radius: var(--xy-radius-pill);
    color: var(--el-text-color-regular);
    display: inline-flex;
    font-size: var(--xy-font-2xs);
    gap: 4px;
    padding: 2px 8px;
}

.sky__table {
    width: 100%;
}
</style>
