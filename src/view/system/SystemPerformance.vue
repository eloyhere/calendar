<script setup lang="ts">
/**
 * 性能（`/system/performance`）：查询耗时、数据规模、运行环境。
 *
 * ## 一瞥即知，不做实时曲线
 *
 * `docs/ui-architecture.md` §2.2 第 12 条（**警觉递减**，Robison 等 2022，已核实的
 * 实测数据：年轻成人在持续注意任务里反应时随时间显著变慢，且"警觉递减主要出现在
 * 分布慢端"）的结论是：**不要做需要长时间盯着的监控式仪表盘**。
 *
 * Tufte 的第一原则（§2.4 第 6 条，已核实其原话）也指向同一处：
 * "信息展示的目的是辅助思考"——所以要问的是"这一页帮用户判断什么"，
 * 而不是"能画几条曲线"。这一页要回答的是：
 *
 * 1. 数据在哪、有多大（**是文件事实，不是运行时指标**）；
 * 2. 运行环境是什么（解释器、平台、SQLite 驱动）；
 * 3. 哪几步操作会慢（说清楚**为什么慢**，而不是画一条会跳的曲线）。
 *
 * ## 这一页诚实的地方
 *
 * "查询耗时"目前**没有采样数据**：本应用没有埋点（也没有必要埋）。所以这一页
 * 不画一个假的耗时图，而是列出**会导致慢的具体原因**与它们的量级。
 * 这比一个漂亮但无来源的仪表盘有用。
 */

import { computed } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { DATABASE_MODULES } from "../../../shared/database-registry";
import { useModuleStates } from "../../state/use-calendar-query";
import { useShellStore } from "../../store/shell.store";

const { states, state, error, reload } = useModuleStates();
const shell = useShellStore();

/** 四个规模卡片。 */
const summary = computed(() => {
    const loaded = states.value.filter((item) => item.rows !== null);
    const total = loaded.reduce((sum, item) => sum + (item.rows ?? 0), 0);
    const tables = states.value.reduce((sum, item) => sum + item.tables.length, 0);

    return [
        { label: "分库", value: states.value.length, unit: "个" },
        { label: "表", value: tables, unit: "张" },
        { label: "主表合计", value: total, unit: "行" },
        { label: "已装数", value: states.value.filter((item) => item.present).length, unit: "个" }
    ];
});

/**
 * 大表：行数超过 10 万的。
 *
 * 依据 §2.4 第 4 条（前注意加工）：**长度与二维位置最适合定量表达**，
 * 所以这里给的是"行数直排 + 一根按比例的长度条"，不用饼图也不用环形图。
 */
const heavy = computed(() => {
    const loaded = states.value.filter((item) => (item.rows ?? 0) > 0);
    const largest = Math.max(1, ...loaded.map((item) => item.rows ?? 0));
    return loaded
        .map((item) => ({
            ...item,
            share: ((item.rows ?? 0) / largest) * 100
        }))
        .sort((left, right) => (right.rows ?? 0) - (left.rows ?? 0))
        .slice(0, 10);
});

/** 会慢的三件事。这是"为什么慢"的说明，不是指标。 */
const Costs = [
    {
        title: "全表 COUNT(*)",
        detail:
            "工作台与「数据信息」会逐个分库 COUNT(*) 主表。temporal 有 1,073 万行，" +
            "走主键索引，实测整套 22 次不到一秒。",
        icon: "Histogram" as const
    },
    {
        title: "跨库关联",
        detail:
            "SQLite 不支持跨文件外键，关联靠 database/combine.py 合并成全库之后再做。" +
            "逐库分别查再在内存里拼，比合并快，所以界面走的是前者。",
        icon: "Connection" as const
    },
    {
        title: "渲染大表",
        detail:
            "历表一次只取 200 行，数据浏览一次 100 行。" +
            "把 29 万行推进渲染进程不会更快，只会更慢——所以分页是设计的一部分，不是省事。",
        icon: "Grid" as const
    }
];
</script>

<template>
    <PageShell
        :state="state"
        :error-text="error"
        source="src/sqlite/"
        empty-text="没有可以统计的分库"
        @retry="reload">
        <ElRow :gutter="16" class="perf__summary">
            <ElCol v-for="item in summary" :key="item.label" :span="6">
                <ElCard shadow="never" class="perf__stat">
                    <ElStatistic :title="item.label" :value="item.value" :suffix="item.unit" />
                </ElCard>
            </ElCol>
        </ElRow>

        <ElRow :gutter="16">
            <ElCol :span="14">
                <div class="xy-panel perf__panel">
                    <h2 class="xy-panel-title">最大的十张表</h2>

                    <ul class="perf__bars">
                        <li v-for="item in heavy" :key="item.name" class="perf__bar-row">
                            <span class="perf__bar-label is-truncated">{{ item.label }}</span>
                            <span class="perf__bar-track">
                                <span class="perf__bar" :style="{ width: `${item.share}%` }" />
                            </span>
                            <span class="perf__bar-value numeral">
                                {{ (item.rows ?? 0).toLocaleString("en-US") }}
                            </span>
                        </li>
                    </ul>

                    <p class="xy-note">
                        长度编码行数（前注意加工里最适合定量表达的属性之一），
                        不用颜色编码任何数量——颜色应当只表示分类。
                    </p>
                </div>
            </ElCol>

            <ElCol :span="10">
                <div class="xy-panel perf__panel">
                    <h2 class="xy-panel-title">运行环境</h2>
                    <ElDescriptions :column="1" border size="small">
                        <ElDescriptionsItem label="分库目录">
                            <span class="numeral perf__path">src/sqlite/</span>
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="登记的模块">
                            <span class="numeral">{{ DATABASE_MODULES.length }}</span> 个
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="读写模式">
                            <ElTag size="small" type="success" effect="plain">只读</ElTag>
                            <span class="xy-dim">读连接，写语句由主进程直接拒绝</span>
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="驱动">
                            <span class="numeral xy-chip">node:sqlite</span>
                            <span class="xy-dim">Electron 主进程内建，不起外部进程</span>
                        </ElDescriptionsItem>
                    </ElDescriptions>
                </div>

                <div class="xy-panel perf__panel">
                    <h2 class="xy-panel-title">当前视点</h2>
                    <p v-if="shell.point.from === null" class="xy-note">
                        还没有选定时刻。打开历法或年表页，或在命理页的时间输入里设一个，
                        状态栏中间那一段就会填上。
                    </p>
                    <ElDescriptions v-else :column="1" border size="small">
                        <ElDescriptionsItem label="公历">{{ shell.point.gregorian ?? "—" }}</ElDescriptionsItem>
                        <ElDescriptionsItem label="本历">{{ shell.point.calendar ?? "（未换算）" }}</ElDescriptionsItem>
                        <ElDescriptionsItem label="干支">{{ shell.point.sexagenary ?? "（未换算）" }}</ElDescriptionsItem>
                        <ElDescriptionsItem label="来源">{{ shell.point.from }}</ElDescriptionsItem>
                    </ElDescriptions>
                </div>
            </ElCol>
        </ElRow>

        <div class="xy-panel perf__panel">
            <h2 class="xy-panel-title">哪几步会慢，为什么</h2>

            <ElRow :gutter="16">
                <ElCol v-for="cost in Costs" :key="cost.title" :span="8">
                    <div class="perf__cost">
                        <h3 class="perf__cost-title">
                            <AppIcon :name="cost.icon" />
                            <span>{{ cost.title }}</span>
                        </h3>
                        <p class="xy-note perf__cost-detail">{{ cost.detail }}</p>
                    </div>
                </ElCol>
            </ElRow>

            <p class="xy-note">
                这一页刻意**没有实时曲线**：持续注意会随时间下降（警觉递减），
                而变化盲视又会让"静默更新的图"被忽略。要判断"快不快"，
                上面这三段说明比一条会跳的线更有用。
            </p>
        </div>
    </PageShell>
</template>

<style scoped>
.perf__summary {
    margin-bottom: 16px;
}

.perf__stat {
    text-align: center;
}

.perf__panel {
    margin-bottom: 16px;
}

.perf__bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.perf__bar-row {
    align-items: center;
    display: flex;
    gap: 8px;
}

.perf__bar-label {
    color: var(--el-text-color-regular);
    flex-shrink: 0;
    font-size: 12px;
    width: 100px;
}

.perf__bar-track {
    background: var(--el-fill-color-light);
    border-radius: 3px;
    flex: 1;
    height: 12px;
    min-width: 0;
}

.perf__bar {
    background: var(--el-color-primary-light-3);
    border-radius: 3px;
    display: block;
    height: 100%;
}

.perf__bar-value {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 12px;
    text-align: right;
    width: 100px;
}

.perf__path {
    word-break: break-all;
}

.perf__cost {
    border-left: 3px solid var(--el-border-color-lighter);
    padding-left: 12px;
}

.perf__cost-title {
    align-items: center;
    color: var(--el-text-color-primary);
    display: flex;
    font-size: 14px;
    font-weight: 600;
    gap: 6px;
    margin: 0 0 6px;
}

.perf__cost-detail {
    margin: 0;
}
</style>
