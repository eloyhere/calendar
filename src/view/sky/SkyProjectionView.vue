<script setup lang="ts">
/**
 * 地表投影：`/sky/projection`。
 *
 * ## 这一页画什么
 *
 * 每个天体在**地球表面**的正下方那一点（星下点，subpoint）随时间在地球上移动。
 * 月球与太阳的星下点轨迹决定了潮汐与日食带，行星的星下点则是一个纯几何量
 * （行星离得远，星下点移动很慢）。
 *
 * ## 为什么用等距圆柱投影而不是正射
 *
 * 正射（球面）好看，但**不能同时看到整个地球**——总有一半背面。
 * 星下点这个量恰恰要求"全球一屏"，所以用等距圆柱：经度做横轴、
 * 纬度做纵轴，界面上可以直接读出经纬度。
 *
 * ## 星下点怎么算
 *
 * 行星的地心赤道坐标 → 把赤经换算成时角 → 星下点经度 = 时角对应的经度。
 * 本页的赤经赤纬由 `astronomy-engine` 给出（`Equator`），
 * 再用**格林尼治恒星时**把它转成地表经度。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import * as Astronomy from "astronomy-engine";
import { BODIES, engineBodyOf } from "../../share/astronomy/ephemeris";
import { civilOfAbsolute, dateOfCivil } from "../../share/astronomy/civil-date";
import { useQuery } from "../../state/use-calendar-query";

/** 当前时刻。 */
const cursor = ref<bigint | null>(null);

const now = new Date();
const monthStart = useQuery(
    "gregory",
    `SELECT "start", "lengthOfDay" FROM "gregory_month" WHERE "year" = ${now.getFullYear() + 10_000} AND "ordinal" = ${now.getMonth() + 1} LIMIT 1;`
);

import { watch } from "vue";
watch(
    monthStart.rows,
    (rows) => {
        const row = rows[0];
        if (row === undefined || cursor.value !== null) {
            return;
        }
        const start = BigInt(String(row.start));
        const day = Math.min(Number(row.lengthOfDay), now.getDate());
        cursor.value =
            start + BigInt(day - 1) * 86_400n + BigInt(now.getHours() * 3600 + now.getMinutes() * 60);
    },
    { immediate: true }
);

/**
 * 星下点。
 *
 * 步骤：
 *   1. `Equator()` 给出该天体的赤经（RA）与赤纬（Dec）；
 *   2. 格林尼治恒星时（GAST）把赤经转成**时角**：`H = GAST − RA`；
 *   3. 星下点经度 = `−H`（时角每 1h 对应 15°），纬度 = 赤纬。
 */
/**
 * 光标所在的**库内公历日期**。
 *
 * 用 `civilOfAbsolute` 查库，而不是 `dateOfAbsolute` 做儒略日换算——
 * 后者与库的口径差 23 天，会让整页天象算错一天到一个月。
 */
const civil = ref<Awaited<ReturnType<typeof civilOfAbsolute>>>(null);

watch(
    cursor,
    (value) => {
        if (value === null) {
            civil.value = null;
            return;
        }
        void civilOfAbsolute(value, async (module, statement, parameters) => {
            const { queryModule } = await import("../../datasource/runner");
            return (await queryModule(module, statement, parameters)) as never;
        })
            .then((result) => {
                civil.value = result;
            })
            .catch(() => {
                civil.value = null;
            });
    },
    { immediate: true }
);
const subpoints = computed(() => {
    const anchor = cursor.value;
    if (anchor === null || civil.value === null) {
        return [];
    }
    /*
     * 用**库里的**公历日期，不用儒略日换算。
     * 那个换算与库的口径差 23 天（见 share/astronomy/civil-date.ts 的文件头），
     * 用它算出来的天象是差 23 天那一刻的——太阳赤纬会从 7.6°S 变成 0.1°N。
     */
    const date = dateOfCivil(civil.value.year, civil.value.month, civil.value.day, civil.value.hour, civil.value.minute);
    const gast = Astronomy.SiderealTime(date);

    return BODIES.map((body) => {
        const target = engineBodyOf(body.id);
        const equator = Astronomy.Equator(target, date, new Astronomy.Observer(0, 0, 0), true, true);
        // 时角：GAST 与 RA 都是小时
        let hourAngle = gast - equator.ra;
        hourAngle = ((hourAngle % 24) + 24) % 24;
        let longitude = -hourAngle * 15;
        if (longitude < -180) {
            longitude += 360;
        }
        if (longitude > 180) {
            longitude -= 360;
        }
        return {
            id: body.id,
            label: body.label,
            glyph: body.glyph,
            color: body.color,
            longitude,
            latitude: equator.dec,
            distance: equator.dist
        };
    });
});

/** 等距圆柱投影：经度 → x，纬度 → y。 */
const projected = computed(() =>
    subpoints.value.map((point) => ({
        ...point,
        x: (point.longitude + 180) / 360,
        y: (90 - point.latitude) / 180
    }))
);

const shift = (hours: number): void => {
    if (cursor.value !== null) {
        cursor.value += BigInt(hours) * 3600n;
    }
};

/** 当前时刻的读数：用户必须知道自己在看哪一刻。 */
const stamp = computed(() => {
    const parts = civil.value;
    if (parts === null) {
        return "（时刻未定）";
    }
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${parts.year} 年 ${parts.month} 月 ${parts.day} 日 ${pad(parts.hour)}:${pad(parts.minute)}`;
});

/** 经纬度的可读写法。 */
const formatLon = (value: number): string =>
    `${Math.abs(value).toFixed(2)}°${value >= 0 ? "E" : "W"}`;
const formatLat = (value: number): string =>
    `${Math.abs(value).toFixed(2)}°${value >= 0 ? "N" : "S"}`;
</script>

<template>
    <PageShell
        :state="monthStart.state.value"
        :error-text="monthStart.error.value"
        :card="false"
        :scroll="false"
        source="astronomy-engine（赤道坐标 + 格林尼治恒星时）"
        @retry="monthStart.reload">
        <div class="proj">
            <header class="proj__head">
                <div>
                    <h1 class="proj__title">地表投影</h1>
                    <p class="proj__note">
                        每个天体的**星下点**（正下方那一点）。赤经由 <span class="numeral">Equator()</span> 给出，
                        再用格林尼治恒星时转成时角，时角换算成经度。
                        用等距圆柱投影而不是球面——星下点这个量要求**全球一屏**，球面总有一半在背面。
                    </p>
                </div>

                <span class="proj__stamp numeral">
                    {{ stamp }}
                </span>

                <ElButtonGroup>
                    <ElButton text @click="shift(-24)">−1天</ElButton>
                    <ElButton text @click="shift(-6)">−6时</ElButton>
                    <ElButton text @click="shift(6)">+6时</ElButton>
                    <ElButton text @click="shift(24)">+1天</ElButton>
                </ElButtonGroup>
            </header>

            <div class="proj__body">
                <div class="proj__map">
                    <svg viewBox="0 0 1 0.5" class="proj__svg" role="img" aria-label="各大天体的星下点">
                        <rect x="0" y="0" width="1" height="0.5" class="proj__ocean" />

                        <!-- 经纬网：每 30° 一条，赤道与主子午线加重 -->
                        <g class="proj__grid">
                            <template v-for="lon in 11" :key="`lon-${lon}`">
                                <line
                                    :x1="(lon - 1) / 12"
                                    y1="0"
                                    :x2="(lon - 1) / 12"
                                    y2="0.5"
                                    :class="{ 'is-major': lon === 1 || lon === 7 }" />
                            </template>
                            <template v-for="lat in 5" :key="`lat-${lat}`">
                                <line
                                    x1="0"
                                    :y1="(lat - 1) / 6"
                                    x2="1"
                                    :y2="(lat - 1) / 6"
                                    :class="{ 'is-major': lat === 1 || lat === 5 }" />
                            </template>
                        </g>

                        <!-- 星下点 -->
                        <g v-for="point in projected" :key="point.id">
                            <circle :cx="point.x" :cy="point.y" r="0.008" :fill="point.color" class="proj__point" />
                            <line
                                :x1="point.x"
                                :y1="point.y + 0.012"
                                :x2="point.x"
                                :y2="0.5"
                                :stroke="point.color"
                                class="proj__drop" />
                            <text :x="point.x" :y="point.y - 0.012" class="proj__label">{{ point.label }}</text>
                        </g>
                    </svg>

                    <div class="proj__legend">
                        <span class="xy-dim">横轴：经度 −180° … 180°</span>
                        <span class="xy-dim">纵轴：纬度 90°N … 90°S</span>
                        <span class="xy-dim">虚线垂足表示该点所在的经线</span>
                    </div>
                </div>

                <aside class="proj__aside">
                    <h2 class="xy-panel-title">星下点</h2>
                    <ElTable :data="subpoints" size="small" class="proj__table">
                        <ElTableColumn label="天体" width="94">
                            <template #default="{ row }">
                                <span :style="{ color: row.color }">{{ row.glyph }}</span> {{ row.label }}
                            </template>
                        </ElTableColumn>
                        <ElTableColumn label="经度" min-width="100" align="right" class-name="numeral">
                            <template #default="{ row }">{{ formatLon(row.longitude) }}</template>
                        </ElTableColumn>
                        <ElTableColumn label="纬度" min-width="100" align="right" class-name="numeral">
                            <template #default="{ row }">{{ formatLat(row.latitude) }}</template>
                        </ElTableColumn>
                    </ElTable>

                    <p class="xy-note">
                        月球与太阳的星下点移动最快（月球约每小时 55 经度度），
                        行星的几乎不动——它们离得太远，地球自转带来的视差是主导项。
                    </p>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.proj {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.proj__head {
    align-items: flex-start;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 10px 16px;
}

.proj__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.proj__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 84ch;
}

.proj__body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
    padding: 12px;
}

.proj__map {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 12px;
}

.proj__svg {
    display: block;
    width: 100%;
}

.proj__ocean {
    fill: var(--el-color-primary-light-9);
}

.proj__grid line {
    stroke: var(--el-border-color-lighter);
    stroke-width: 0.001;
}

.proj__grid line.is-major {
    stroke: var(--el-border-color-darker);
    stroke-width: 0.0015;
}

.proj__point {
    stroke: #fff;
    stroke-width: 0.0015;
}

.proj__drop {
    opacity: 0.35;
    stroke-dasharray: 0.006 0.006;
    stroke-width: 0.001;
}

.proj__label {
    fill: var(--el-text-color-primary);
    font-size: 0.022px;
    text-anchor: middle;
}

.proj__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    padding-top: 8px;
}

.proj__aside {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex-shrink: 0;
    overflow-y: auto;
    padding: 12px 14px;
    width: 340px;
}

.proj__table {
    width: 100%;
}
</style>
