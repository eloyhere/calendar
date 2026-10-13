<script setup lang="ts">
/**
 * 历法工作区的「简介」视图：这套历法的规则、建元与换算口径。
 *
 * ## 内容从哪来
 *
 * 三部分，来源各不相同，页面上分得清：
 *
 * 1. **登记表**（`src/entity/calendar.ts`）：名称、分界依据、一年几个月、
 *    年表与月表叫什么。这些是**口径**，是项目自己的约定；
 * 2. **实时查询**：这套历法的年表 / 月表各有多少行、第一行与最后一行是什么。
 *    这是**事实**，每次打开都现查；
 * 3. **共享口径**：全库统一的时间主键与建元（`docs/design.md` §2）。
 *
 * 分开的理由是 `docs/research.md` §0 立的那条规矩：**口径与事实不得混用**。
 * 界面上把"这是本项目的约定"和"这是查出来的数"写在同一段里，
 * 读的人就没法判断哪句话可以拿去核对。
 *
 * ## 首尾两行为什么值得显示
 *
 * 它是这套历法覆盖范围的直接证据，而且能一眼看出换算法则对不对：
 * 朔望历应当从 -9999 附近开始、到 13500 附近结束（`calendar.xlsx` 的 24 个工作表）。
 * 这比"共 290,654 行"更能说明问题。
 */

import { computed } from "vue";

import PageShell from "../../component/PageShell.vue";
import type { Row } from "../../datasource/sqlite";
import type { CalendarSystem } from "../../entity/calendar";
import { numberOf, useQuery, useQueryOne } from "../../state/use-calendar-query";

interface Props {
    /** 当前历法体系 */
    system: CalendarSystem;
}

const props = defineProps<Props>();

/** 年表行数。 */
const { row: yearCount, state: yearState, error: yearError, reload: reloadYears } = useQueryOne(
    props.system.module,
    () => `SELECT COUNT(*) AS n FROM "${props.system.yearTable}"`
);

/** 月表行数。 */
const { row: monthCount } = useQueryOne(
    props.system.module,
    () => `SELECT COUNT(*) AS n FROM "${props.system.monthTable}"`
);

/**
 * 覆盖范围：年表的第一行与最后一行。
 *
 * 用 `MIN` / `MAX` 取 `identity` 再回查，而不是 `ORDER BY ... LIMIT 1`：
 * 后者在 29 万行的表上要走一遍排序（`identity` 有索引，聚合快得多）。
 */
const { rows: edges, state: edgeState, reload: reloadEdges } = useQuery<Row>(
    props.system.module,
    () =>
        `SELECT * FROM "${props.system.yearTable}" ` +
        `WHERE "identity" = (SELECT MIN("identity") FROM "${props.system.yearTable}") ` +
        `   OR "identity" = (SELECT MAX("identity") FROM "${props.system.yearTable}") ` +
        `ORDER BY "identity"`
);

/** 页面状态：两个查询任一出错就是错误，都为空就是空态。 */
const state = computed(() => {
    if (yearState.value === "error" || edgeState.value === "error") {
        return "error";
    }
    if (yearState.value === "loading" || edgeState.value === "loading") {
        return "loading";
    }
    return edges.value.length === 0 ? "empty" : "ready";
});

const error = computed(() => yearError.value);

/** 重取两个查询。 */
const reload = (): void => {
    reloadYears();
    reloadEdges();
};

/** 时间主键的口径。这是项目约定，不是查出来的。 */
const IdentityNote =
    "全库统一的时间主键是 temporal.absolute：建元 -2696-03-11 01:45:49 当天为第 1 日，" +
    "days = jdn(时刻) - jdn(建元) + 1，seconds 为当天 0 点起的秒数，" +
    "absolute = days * 86400 + seconds。区间一律取 [start, end)。";

/** 首行 / 末行的可读描述：把这一行里最像"名字"的列挑出来。 */
const describe = (row: Row): string => {
    const candidates = ["name", "label", "title"];
    for (const key of candidates) {
        const value = row[key];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
    }
    return `identity ${String(row.identity ?? "")}`;
};

/** 这一行的年份列（如果表里有）。 */
const yearOf = (row: Row): string => {
    const value = row.year;
    return value === null || value === undefined ? "" : String(value);
};
</script>

<template>
    <PageShell
        :state="state"
        :error-text="error"
        :source="`src/sqlite/${props.system.module}.sqlite`"
        empty-text="这套历法的年表当前没有行"
        @retry="reload">
        <ElRow :gutter="16">
            <ElCol :span="14">
                <div class="xy-panel calendar-entry__panel">
                    <h2 class="xy-panel-title">规则与口径</h2>

                    <ElDescriptions :column="1" border size="small">
                        <ElDescriptionsItem label="历法">{{ props.system.label }}</ElDescriptionsItem>
                        <ElDescriptionsItem label="说明">{{ props.system.description }}</ElDescriptionsItem>
                        <ElDescriptionsItem label="一年几个月">
                            {{ props.system.monthsPerYear }}
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="年的分界">
                            {{ props.system.yearStart }}
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="分库">
                            <span class="numeral xy-chip">{{ props.system.module }}</span>
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="年表 / 月表">
                            <span class="numeral xy-chip">{{ props.system.yearTable }}</span>
                            <span class="numeral xy-chip">{{ props.system.monthTable }}</span>
                        </ElDescriptionsItem>
                    </ElDescriptions>

                    <p class="xy-note">
                        上面这些是本项目的口径，来自
                        <code>src/entity/calendar.ts</code> 的登记表；下面那些行数是查出来的。
                        两者不要混读：口径改了要改代码，行数改了什么都不用动。
                    </p>
                </div>

                <div class="xy-panel calendar-entry__panel">
                    <h2 class="xy-panel-title">覆盖范围</h2>

                    <ElEmpty v-if="edges.length === 0" description="没有行可以取样" :image-size="60" />

                    <ElDescriptions v-else :column="1" border size="small">
                        <ElDescriptionsItem label="最早一行">
                            <span class="numeral">{{ yearOf(edges[0]) }}</span>
                            <span class="calendar-entry__gap" />
                            {{ describe(edges[0]) }}
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="最晚一行">
                            <span class="numeral">{{ yearOf(edges[edges.length - 1]) }}</span>
                            <span class="calendar-entry__gap" />
                            {{ describe(edges[edges.length - 1]) }}
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="年表行数">
                            <span class="numeral">{{ numberOf(yearCount?.n) }}</span>
                        </ElDescriptionsItem>
                        <ElDescriptionsItem label="月表行数">
                            <span class="numeral">{{ numberOf(monthCount?.n) }}</span>
                        </ElDescriptionsItem>
                    </ElDescriptions>

                    <p class="xy-note">
                        首尾两行是这套历法覆盖范围的直接证据。行数是每次打开现查的
                        ——<code>docs/design.md</code> 里那份表格是构建当时的快照，已经对不上了。
                    </p>
                </div>
            </ElCol>

            <ElCol :span="10">
                <div class="xy-panel calendar-entry__panel">
                    <h2 class="xy-panel-title">时间坐标系</h2>
                    <p class="xy-note">{{ IdentityNote }}</p>
                    <p class="xy-note">
                        界面上不显示 <code>absolute</code>，只显示它对应的日期；状态栏中间的
                        「当前视点」会把同一时刻用公历、本历与干支三种表达并列写出来。
                    </p>
                </div>

                <div class="xy-panel calendar-entry__panel">
                    <h2 class="xy-panel-title">去哪看什么</h2>
                    <ul class="calendar-entry__links">
                        <li>
                            这套历法的年表与月表 → 本页的「数据」视图；
                        </li>
                        <li>
                            任意分库任意表的列与筛选 →
                            <RouterLink to="/data/browse">数据 · 数据浏览</RouterLink>；
                        </li>
                        <li>
                            建元、朝代、年号与事件 →
                            <RouterLink to="/chronology/timeline">年表</RouterLink>；
                        </li>
                        <li>
                            节气与月相 →
                            <RouterLink to="/chronology/solar-term">节气</RouterLink>、
                            <RouterLink to="/chronology/lunar-phase">月相</RouterLink>。
                        </li>
                    </ul>
                </div>
            </ElCol>
        </ElRow>
    </PageShell>
</template>

<style scoped>
.calendar-entry__panel {
    margin-bottom: 16px;
}

.calendar-entry__gap {
    display: inline-block;
    width: 12px;
}

.calendar-entry__links {
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 2;
    margin: 0;
    padding-left: 20px;
}
</style>
