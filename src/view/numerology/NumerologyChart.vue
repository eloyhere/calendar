<script setup lang="ts">
/**
 * 排盘结果的占位与数据底座。
 *
 * ## 为什么不摆一个"排盘"按钮
 *
 * 六套术数的**推演方法都还没实现**（`docs/design.md` 里它们只在实体层有定义，
 * 没有对应的算法与表）。一个按下去只会转圈的按钮比一句实话更糟：
 * 它让用户以为功能存在、只是自己不会用。
 *
 * 所以这一块做的是**能核对的事**：
 *
 * 1. 把这一页依赖的分库的**真实结构**列出来（表名、列名、行数）；
 * 2. 明确写出推演方法待实现，以及待实现意味着什么；
 * 3. 给出可以立刻做的事（去看原始数据、去看年表）。
 *
 * `docs/research.md` §5 立过同一条规矩：写死的内容要说明它是"这一页将来长什么样"的
 * 说明书，不能让审阅的人以为已经接上了。
 */

import { computed } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { useModuleStates, useQuery, useTableColumns } from "../../state/use-calendar-query";
import type { Row } from "../../datasource/sqlite";

interface Props {
    /** 页标识 */
    page: string;
    /** 这一页在算什么 */
    caption: string;
}

const props = defineProps<Props>();

/** 当前页依赖的分库。 */
const Dependency: Record<string, string> = {
    wiki: "",
    bazi: "tree",
    ziwei: "astronomy",
    qizheng: "perform",
    gua: "part",
    horoscope: "tropical"
};

const module = computed(() => Dependency[props.page] ?? "");

/** 该分库的表清单（来自实时状态查询，不是登记表里的静态值）。 */
const { states } = useModuleStates();
const tables = computed(
    () => states.value.find((item) => item.name === module.value)?.tables ?? []
);

/** 只看第一张主表：列太多会把这一块变成一张巨大的表。 */
const primaryTable = computed(() => {
    const list = tables.value;
    // 主表通常是"不带下划线后缀"的那个（`tree_year` / `astronomy_year` / `perform`）
    return list.find((name) => !name.includes("_")) ?? list[0] ?? "";
});

const { columns } = useTableColumns(module, () => primaryTable.value);

/** 主表的前三行：让"有没有数据"看得见。 */
const { rows } = useQuery<Row>(
    module,
    () =>
        module.value === "" || primaryTable.value === ""
            ? null
            : `SELECT * FROM "${primaryTable.value}" LIMIT 3`
);

/** 这一页的推演方法还没实现——写清楚"缺什么"。 */
const Missing: Record<string, string> = {
    wiki: "命理百科依赖一份术语与流派的词条表，目前还没有这张表。",
    bazi: "四柱需要「干支历 + 节气分界 + 真太阳时」三样，其中干支历已装数（28 万行），后两样的换算函数还没写。",
    ziwei: "十二宫需要「农历月 + 时辰 + 安星诀」；农历月已装数，安星诀还没写。",
    qizheng: "七政四余需要日月五星的躔度；`perform` 有 808 行五星行度，但把行度折算成宫位的函数还没写。",
    gua: "起卦需要一套「时间 → 卦」的推导规则；`part` 有 87 万行旬段，规则本身还没定。",
    horoscope: "星盘需要把回归历的坐标投影到黄道十二宫；回归历已装数，投影与绘图还没做。"
};
</script>

<template>
    <div class="xy-panel numerology-chart">
        <h2 class="xy-panel-title">{{ props.caption }}</h2>

        <!-- 一：明确的占位说明。不摆按钮 -->
        <ElAlert
            type="info"
            :closable="false"
            show-icon
            title="推演方法待实现"
            :description="Missing[props.page] ?? '这一页的推演方法还没实现。'" />

        <!-- 二：数据底座是真实的，列出来可核对 -->
        <template v-if="module !== ''">
            <p class="xy-note numerology-chart__lead">
                这一页依赖
                <span class="numeral xy-chip">{{ module }}</span>
                ，它有
                <span class="numeral">{{ tables.length }}</span>
                张表。主表
                <span class="numeral xy-chip">{{ primaryTable }}</span>
                的列：
            </p>

            <ElTable :data="columns" size="small" max-height="220" class="numerology-chart__columns">
                <ElTableColumn prop="name" label="列" width="180" />
                <ElTableColumn prop="type" label="类型" width="120" class-name="numeral" />
                <ElTableColumn label="约束" min-width="160">
                    <template #default="{ row }">
                        <ElTag v-if="row.primaryKey" size="small" effect="plain">主键</ElTag>
                        <ElTag v-if="row.notNull" size="small" type="info" effect="plain">非空</ElTag>
                    </template>
                </ElTableColumn>
            </ElTable>

            <p class="xy-note">主表前三行（真数据，可核对）：</p>
            <ElTable :data="rows" size="small" max-height="180" class="numerology-chart__rows">
                <ElTableColumn
                    v-for="column in columns.slice(0, 6)"
                    :key="column.name"
                    :prop="column.name"
                    :label="column.name"
                    min-width="120" />
            </ElTable>
        </template>

        <!-- 三：可以立刻做的事 -->
        <div class="numerology-chart__actions">
            <ElButton v-if="module !== ''" @click="$router.push('/data/browse')">
                <AppIcon name="DataBoard" />
                <span>去看这个分库的原始数据</span>
            </ElButton>
            <ElButton @click="$router.push('/chronology/timeline')">
                <AppIcon name="Memo" />
                <span>去查年表</span>
            </ElButton>
        </div>

        <p class="xy-note">
            这一块列出的是**分库的真实结构**（列来自 <code>PRAGMA table_info</code>，
            行数是实时 <code>COUNT(*)</code>），不是写死的说明。写清楚"缺什么"是
            刻意的：<code>docs/research.md</code> §5 要求占位内容必须让人一眼看出是占位。
        </p>
    </div>
</template>

<style scoped>
.numerology-chart {
    flex-shrink: 0;
}

.numerology-chart__lead {
    margin-top: 14px;
}

.numerology-chart__columns,
.numerology-chart__rows {
    width: 100%;
}

.numerology-chart__actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
}
</style>
