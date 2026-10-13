<script setup lang="ts">
/**
 * 概览页：全库规模与数据源状态。
 *
 * 这是唯一一个**当前就能填满**的页面：`docs/design.md` §3 的表格逐行给出了
 * 22 个分库的表与行数，不需要等数据层接通。因此它也是新外壳的样板页——
 * 想看清楚「卡片 + 描述列表 + 表格 + 状态标签」怎么写，看这一个文件即可。
 *
 * 其余页面暂时是空壳加骨架屏，等对应的 store 接上以后再照这个形状填。
 */

import { computed } from "vue";
import PageShell from "../component/PageShell.vue";

/** 分库清单，逐个对照 `docs/design.md` §3 的表格。 */
interface DatabaseRow {
    /** 实体模块名 */
    name: string;
    /** 中文名 */
    label: string;
    /** 表名，多个用「、」分隔 */
    tables: string;
    /** 行数；`0` 表示数据源缺失或换算法则未实现 */
    rows: number;
    /** 备注 */
    note: string;
}

const Databases: DatabaseRow[] = [
    { name: "temporal", label: "时间点", tables: "temporal", rows: 10734114, note: "全库时间主键" },
    { name: "phenology", label: "节气物候", tables: "phenology", rows: 564000, note: "节气 / 中气时刻" },
    { name: "phase", label: "月相", tables: "phase", rows: 1162616, note: "朔 / 上弦 / 望 / 下弦" },
    { name: "part", label: "分段", tables: "part", rows: 871962, note: "元会运世的分段" },
    { name: "week", label: "周", tables: "week", rows: 1453271, note: "旬与候" },
    { name: "synodic", label: "朔望", tables: "calendar_year、month", rows: 314154, note: "来自 calendar.xlsx" },
    { name: "primary", label: "本原", tables: "primary", rows: 2, note: "元 / 会 / 运 三级" },
    { name: "encounter", label: "交会", tables: "encounter", rows: 3, note: "日月交会" },
    { name: "perform", label: "行度", tables: "perform", rows: 66, note: "五星行度" },
    { name: "epoch", label: "建元", tables: "epoch", rows: 784, note: "30 朔望年一世" },
    { name: "dynasty", label: "朝代", tables: "dynasty", rows: 89, note: "含神话与上古" },
    { name: "era", label: "年号", tables: "era", rows: 1184, note: "允许重叠" },
    { name: "person", label: "人物", tables: "person", rows: 425, note: "君主与作者" },
    { name: "event", label: "事件", tables: "event", rows: 2379, note: "取自历史资料" },
    { name: "chronology", label: "年表", tables: "chronology", rows: 23500, note: "一个朔望年一条" },
    { name: "astronomy", label: "天文历", tables: "year、month", rows: 314154, note: "年由合朔与回归年长定界" },
    { name: "climate", label: "节气历", tables: "climate、year、month", rows: 2331375, note: "节气归属" },
    { name: "gregory", label: "格里高丽历", tables: "year、month", rows: 305499, note: "proleptic" },
    { name: "jupiter", label: "木星历", tables: "year、month", rows: 25756, note: "岁星周期 11.862 年" },
    { name: "natural", label: "轩辕历", tables: "year、month", rows: 314154, note: "建元为 1 年 1 月 1 日" },
    { name: "tree", label: "干支历", tables: "year、month", rows: 304722, note: "以立春为年界" },
    { name: "tropical", label: "回归历", tables: "year、month", rows: 305498, note: "回归年 365.2422 日" }
];

/** 行数格式化：`6943509` -> `6,943,509`。 */
function formatRows(rows: number): string {
    return rows.toLocaleString("en-US");
}

/** 数据源名称，用于空态与描述列表。 */
const SourceName = "calendar.xlsx（37 MB，24 个工作表）";

/** 顶部四个统计卡片的数值；`ElStatistic` 的 `value` 只接受数字，单位另传。 */
const Summary = computed(() => [
    { label: "分库", value: Databases.length, unit: "个" },
    {
        label: "总行数",
        value: Databases.reduce((total, item) => total + item.rows, 0),
        unit: "行"
    },
    { label: "有数据的库", value: Databases.filter((item) => item.rows > 0).length, unit: "个" },
    { label: "待生成", value: Databases.filter((item) => item.rows === 0).length, unit: "个" }
]);
</script>

<template>
    <PageShell :state="'ready'" source="calendar.xlsx">
        <ElRow :gutter="16" class="overview__summary">
            <ElCol v-for="item in Summary" :key="item.label" :span="6">
                <ElCard shadow="hover" class="overview__stat">
                    <ElStatistic :title="item.label" :value="item.value" :suffix="item.unit" />
                </ElCard>
            </ElCol>
        </ElRow>

        <ElDescriptions title="数据源" :column="2" border class="overview__source">
            <ElDescriptionsItem label="主数据源">{{ SourceName }}</ElDescriptionsItem>
            <ElDescriptionsItem label="历史资料">
                zh.wikipedia「中国朝代」「中国年号列表」，经 scripts/parse_*.py 解析
            </ElDescriptionsItem>
            <ElDescriptionsItem label="建元">-2696-03-11 01:45:49（当天为第 1 日）</ElDescriptionsItem>
            <ElDescriptionsItem label="时间主键">
                所有实体表的 identity 都是 temporal.absolute
            </ElDescriptionsItem>
        </ElDescriptions>

        <ElTable :data="Databases" stripe class="overview__table" max-height="520">
            <ElTableColumn prop="name" label="实体" width="140" class-name="numeral" />
            <ElTableColumn prop="label" label="中文名" width="140" />
            <ElTableColumn prop="tables" label="表" min-width="200" />
            <ElTableColumn prop="rows" label="行数" width="140" align="right" class-name="numeral">
                <template #default="{ row }">{{ formatRows(row.rows) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120">
                <template #default="{ row }">
                    <ElTag :type="row.rows > 0 ? 'success' : 'info'" size="small" effect="plain">
                        {{ row.rows > 0 ? "已装数" : "待生成" }}
                    </ElTag>
                </template>
            </ElTableColumn>
            <ElTableColumn prop="note" label="备注" min-width="160">
                <template #default="{ row }">
                    <ElText :type="row.rows > 0 ? 'info' : 'warning'" size="small">
                        {{ row.note }}
                    </ElText>
                </template>
            </ElTableColumn>
        </ElTable>
    </PageShell>
</template>

<style scoped>
.overview__summary {
    margin-bottom: 16px;
}

.overview__stat {
    text-align: center;
}

.overview__source {
    margin-bottom: 16px;
}

.overview__table {
    width: 100%;
}
</style>
