<script setup lang="ts">
/**
 * 年表（`/chronology/timeline`）：朝代、年号与事件的编年视图。
 *
 * ## 为什么是横向泳道而不是一条时间轴
 *
 * `docs/design.md` §1.2 明确写了："多个朝代、多个年号**允许重叠**
 * （三国、十六国、五代十国、辽宋金夏并立）"。一条竖线或一条横线画不出并立——
 * 它只能把重叠的条目上下堆叠，读者分不清"哪个和哪个同时"。
 *
 * 泳道把每个朝代放在自己的一行，横向按年份定位，重叠一眼可见。
 * 依据：`docs/ui-architecture.md` §2.4 第 4 条（**长度与二维位置最适合定量表达**，
 * 面积与角度不适合），所以这一页用的是"位置 + 长度"，不用颜色编码任何数量。
 *
 * ## 为什么用 CSS grid 而不是图表库
 *
 * 泳道只需要"按比例定位一个矩形"，那是 `grid-column: a / b` 就能表达的东西。
 * 引一个图表库要多一个依赖（而 `src/plugin` 是第三方依赖的唯一入口，
 * 见 `src/plugin/README.md`），换来的是同一件事的另一种写法。
 *
 * ## 年份怎么来
 *
 * 朝代表里有显式的起讫年份列（`start_year` / `end_year`），而 `start` / `end`
 * 是 `temporal.absolute` 的外键（见 `docs/design.md` §3.3：历史实体只精确到年）。
 * 泳道按 `absolute` 定位——它才是全库统一的时间刻度，而年份列只是它的可读形式。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import type { Row } from "../../datasource/sqlite";
import { textOf, useQuery } from "../../state/use-calendar-query";

/** 所有朝代的起讫：泳道的横轴范围。 */
const { rows: dynasties, state, error, reload } = useQuery<Row>(
    "dynasty",
    'SELECT * FROM "dynasty" ORDER BY "start"'
);

/** 年号：点开某个朝代时列出它的年号。 */
const selected = ref<string | null>(null);

const { rows: eras } = useQuery<Row>(
    "era",
    () =>
        selected.value === null
            ? null
            : `SELECT * FROM "era" WHERE "dynasty" = ${selected.value} ORDER BY "start" LIMIT 200`
);

/** 事件：改元与朝代更迭。 */
const { rows: events } = useQuery<Row>(
    "event",
    () => 'SELECT * FROM "event" ORDER BY "identity" LIMIT 60'
);

/**
 * 横轴范围。
 *
 * 取全部朝代的 `start` / `end` 的极值，**并留 2% 边距**：
 * 贴着边缘的矩形看起来像被裁掉了，而它其实是最早或最晚的那一个。
 * 盘古的 `start` 是 -230466297600（实测），所以这里必须用 `bigint`。
 */
const range = computed(() => {
    if (dynasties.value.length === 0) {
        return null;
    }
    let lo = BigInt(dynasties.value[0].start as bigint);
    let hi = BigInt(dynasties.value[0].end as bigint);

    for (const row of dynasties.value) {
        const start = BigInt(row.start as bigint);
        const end = BigInt(row.end as bigint);
        if (start < lo) {
            lo = start;
        }
        if (end > hi) {
            hi = end;
        }
    }

    const span = hi - lo;
    // 全零跨度（只有一条记录且 start === end）时给一个最小跨度，避免除零
    const safeSpan = span === 0n ? 1n : span;
    const padding = safeSpan / 50n;

    return { lo: lo - padding, hi: hi + padding, span: safeSpan + padding * 2n };
});

/** 百分比定位：把 `absolute` 换算成 0–100 的横向位置。 */
const percent = (value: bigint | number | null): number => {
    const current = range.value;
    if (current === null || value === null) {
        return 0;
    }
    const offset = BigInt(value) - current.lo;
    // 用 Number 之前先除以 1000：span 可能是 2.3e11，直接转 Number 再乘会溢出精度
    return Math.max(0, Math.min(100, Number((offset * 10000n) / current.span) / 100));
};

/** 一条泳道的左右位置与宽度。 */
const lane = (row: Row): { left: string; width: string } => {
    const left = percent(row.start as bigint);
    const right = percent(row.end as bigint);
    return { left: `${left}%`, width: `${Math.max(right - left, 0.3)}%` };
};

/** 朝代名。 */
const nameOf = (row: Row): string => textOf(row.name) || textOf(row.label);

/** 起讫年份的可读形式。 */
const spanOf = (row: Row): string => {
    const start = textOf(row.start_year);
    const end = textOf(row.end_year);
    if (start === "" && end === "") {
        return "";
    }
    return `${start === "" ? "?" : start} – ${end === "" || end === "0" ? "今" : end}`;
};

/**
 * 泳道按时间排序，且**按起始时间交错**。
 *
 * 不合并重叠：重叠本身就是要显示的信息。所以每一行一个朝代，
 * 行高固定，重叠的朝代会自然形成上下相邻的块。
 */
const lanes = computed(() =>
    dynasties.value.map((row) => ({
        row,
        name: nameOf(row),
        span: spanOf(row),
        position: lane(row),
        id: String(row.identity)
    }))
);

/** 刻度：把横轴切成 6 段，标出年份。 */
const ticks = computed(() => {
    const current = range.value;
    if (current === null) {
        return [];
    }
    return Array.from({ length: 7 }, (_value, index) => {
        const value = current.lo + (current.span * BigInt(index)) / 6n;
        // 年份刻度按"每 1000 年"粗略标：absolute 的秒数换算成年要经过建元，
        // 而这一页的职责是给出**位置感**，精确年份在下面的表里看
        return { left: `${(index / 6) * 100}%`, label: `#${Number(value / 31_557_600n).toLocaleString("en-US")}` };
    });
});

/** 选中一个朝代。 */
const pick = (id: string): void => {
    selected.value = selected.value === id ? null : id;
};

/** 事件类型的中文名。 */
const EventKinds: Record<string, string> = {
    dynasty_begin: "朝代建立",
    dynasty_end: "朝代灭亡",
    era_begin: "改元",
    era_end: "年号终止"
};
</script>

<template>
    <PageShell
        :state="state"
        :error-text="error"
        source="src/sqlite/dynasty.sqlite"
        empty-text="朝代表当前没有行"
        @retry="reload">
        <div class="timeline">
            <section class="xy-panel timeline__lanes">
                <h2 class="xy-panel-title">朝代泳道</h2>

                <!-- 横轴刻度。位置编码时间，不用颜色编码任何数量 -->
                <div class="timeline__axis" aria-hidden="true">
                    <span v-for="tick in ticks" :key="tick.left" class="timeline__tick" :style="{ left: tick.left }">
                        {{ tick.label }}
                    </span>
                </div>

                <ul class="timeline__list">
                    <li
                        v-for="item in lanes"
                        :key="item.id"
                        class="timeline__lane"
                        :class="{ 'is-selected': selected === item.id }"
                        @click="pick(item.id)">
                        <span class="timeline__lane-name is-truncated">{{ item.name }}</span>
                        <span class="timeline__track">
                            <span
                                class="timeline__bar"
                                :style="{ left: item.position.left, width: item.position.width }"
                                :title="`${item.name} ${item.span}`" />
                        </span>
                        <span class="timeline__lane-span numeral">{{ item.span }}</span>
                    </li>
                </ul>

                <p class="xy-note">
                    每个朝代一条泳道，横向按 <code>temporal.absolute</code> 定位
                    ——**重叠是允许的**（三国、十六国、辽宋金夏并立，见
                    <code>docs/design.md</code> §1.2），所以不合并、不堆叠。
                    点一条看它的年号。
                </p>
            </section>

            <section v-if="selected !== null" class="xy-panel timeline__eras">
                <h2 class="xy-panel-title">这个朝代的年号</h2>

                <ElEmpty v-if="eras.length === 0" description="这个朝代没有年号记录" :image-size="60" />

                <ElTable v-else :data="eras" stripe max-height="240">
                    <ElTableColumn prop="name" label="年号" width="140" />
                    <ElTableColumn label="起" width="140">
                        <template #default="{ row }">
                            <span class="numeral">{{ row.start_year ?? "—" }}</span>
                        </template>
                    </ElTableColumn>
                    <ElTableColumn label="讫" width="140">
                        <template #default="{ row }">
                            <span class="numeral">{{ row.end_year === 0 ? "今" : (row.end_year ?? "—") }}</span>
                        </template>
                    </ElTableColumn>
                    <ElTableColumn prop="reign" label="君主" min-width="160">
                        <template #default="{ row }">
                            {{ row.reign ?? row.monarch ?? "—" }}
                        </template>
                    </ElTableColumn>
                </ElTable>
            </section>

            <section class="xy-panel timeline__events">
                <h2 class="xy-panel-title">更迭事件</h2>

                <ElEmpty v-if="events.length === 0" description="事件表当前没有行" :image-size="60" />

                <ul v-else class="timeline__event-list">
                    <li v-for="event in events" :key="String(event.identity)" class="timeline__event">
                        <ElTag size="small" effect="plain">
                            {{ EventKinds[String(event.kind)] ?? String(event.kind ?? "事件") }}
                        </ElTag>
                        <span class="timeline__event-name is-truncated">{{ event.name }}</span>
                    </li>
                </ul>

                <p class="xy-note">
                    事件只有四类：朝代建立 / 灭亡、改元、年号终止（见
                    <code>src/entity/event.ts</code> 的 <code>EVENT_KINDS</code>）。
                    这里只示意最近的 60 条，完整表在
                    <RouterLink to="/data/browse">数据 · 数据浏览</RouterLink> 里看。
                </p>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.timeline__axis {
    border-bottom: 1px solid var(--el-border-color-lighter);
    height: 16px;
    margin-bottom: 6px;
    position: relative;
}

.timeline__tick {
    color: var(--el-text-color-placeholder);
    font-size: 10px;
    position: absolute;
    transform: translateX(-50%);
}

.timeline__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
}

/*
 * 一条泳道：名称 100px + 轨道 flex + 起讫 120px。
 *
 * 名称与起讫都固定宽度，轨道吃掉剩下的——这样所有泳道的横轴严格对齐，
 * 而"对齐"正是这一页能读出重叠的前提。
 */
.timeline__lane {
    align-items: center;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding: 2px 4px;
}

.timeline__lane:hover {
    background: var(--el-fill-color-lighter);
}

.timeline__lane.is-selected {
    background: var(--el-color-primary-light-9);
}

.timeline__lane-name {
    color: var(--el-text-color-regular);
    flex-shrink: 0;
    font-size: 12px;
    width: 100px;
}

.timeline__track {
    background: var(--el-fill-color-light);
    border-radius: 3px;
    flex: 1;
    height: 14px;
    min-width: 0;
    position: relative;
}

.timeline__bar {
    background: var(--el-color-primary-light-3);
    border-radius: 3px;
    bottom: 0;
    position: absolute;
    top: 0;
}

.timeline__lane.is-selected .timeline__bar {
    background: var(--el-color-primary);
}

.timeline__lane-span {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-size: 11px;
    text-align: right;
    width: 130px;
}

.timeline__event-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.timeline__event {
    align-items: center;
    display: flex;
    gap: 8px;
}

.timeline__event-name {
    color: var(--el-text-color-regular);
    font-size: 13px;
}
</style>
