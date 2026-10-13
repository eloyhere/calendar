<script setup lang="ts">
/**
 * 历法工作区的「数据」视图：这套历法的历表原始数据。
 *
 * ## 与 `/data/browse` 的分界
 *
 * `docs/ui-architecture.md` §3.1 把两者分得很清：
 *
 * | 页面                  | 怎么组织           | 回答的问题                     |
 * | --------------------- | ------------------ | ------------------------------ |
 * | `/calendar/:system/data` | 按**时间语义** | 这套历法的年表长什么样          |
 * | `/data/browse`        | 按**表**        | `synodic_month` 有哪些列、怎么查 |
 *
 * 所以这一页只列这套历法的**年表与月表**两张（它们是"历表"），
 * 关联表（`*_parts`、`*_weeks`、`*_phenologies`）在 `/data/browse` 里看——
 * 那些是派生数据，不是历表本身。
 *
 * ## 首列放人类可读的标识
 *
 * NN/g 的数据表准则（§2.4 第 5 条）：**默认第一列应是人类可读的记录标识**，
 * 而不是自动生成的内部主键。所以 `DataTable` 的 `primaryColumns` 传
 * `name` / `label` / `year`，把 `identity` / `absolute` 挤到后面。
 */

import { computed, ref } from "vue";

import DataTable from "../../../component/data/DataTable.vue";
import PageShell from "../../../component/PageShell.vue";
import type { TableColumn } from "../../../component/data/table-column";
import { isNumericType, PRIMARY_COLUMN_CANDIDATES } from "../../../component/data/table-column";
import type { Row } from "../../../datasource/sqlite";
import type { CalendarSystem } from "../../../entity/calendar";
import { useQuery, useTableColumns } from "../../../state/use-calendar-query";

interface Props {
    /** 当前历法体系 */
    system: CalendarSystem;
}

const props = defineProps<Props>();

/** 看年表还是月表。 */
const which = ref<"year" | "month">("year");

/** 当前表名。 */
const table = computed(() => (which.value === "year" ? props.system.yearTable : props.system.monthTable));

/** 列的原始信息。 */
const { columns: columnInfos, error: columnsError } = useTableColumns(props.system.module, () => table.value);

/**
 * 界面用的列声明。
 *
 * 数字列靠 SQLite 的类型声明判断（`INTEGER` / `TEXT`）。本项目所有 `.sqlite`
 * 都由 `database/schema.py` 生成，声明是准的；判错的后果只是对齐方式，
 * 不是数据错误。
 */
const columns = computed<TableColumn[]>(() =>
    columnInfos.value.map((info) => ({
        name: info.name,
        numeric: isNumericType(info.type)
    }))
);

/** 打头的列：人类可读的标识。不同表的名字不一样，按存在与否挑。 */
const primaryColumns = computed(() => {
    const names = columnInfos.value.map((info) => info.name);
    return PRIMARY_COLUMN_CANDIDATES.filter((name) => names.includes(name));
});

/** 分页：一次取 200 行，够了——历表要看的是"长什么样"，不是"看完"。
 *  真要看完，用 `/data/browse` 的导出。 */
const Limit = 200;

/** 行。 */
const { rows, state, error, reload } = useQuery<Row>(
    props.system.module,
    () => `SELECT * FROM "${table.value}" ORDER BY "identity" LIMIT ${Limit}`,
    () => ({})
);

/** 列名是拼进 SQL 的（列名不能绑定），但表名来自登记表、语句是常量，没有用户输入。 */
const pageState = computed(() => (columnsError.value.length > 0 ? "error" : state.value));

/** 说明这里只取了多少行。 */
const note = computed(
    () =>
        `这张表在前端一次取 ${Limit} 行（按 identity 升序）。要看更多或做筛选，去「数据 · 数据浏览」，` +
        `那里可以按列筛选并导出。`
);
</script>

<template>
    <PageShell
        :state="pageState"
        :error-text="columnsError || error"
        :source="`src/sqlite/${props.system.module}.sqlite`"
        empty-text="这张表当前没有行"
        @retry="reload">
        <div class="calendar-data">
            <div class="calendar-data__bar">
                <ElSegmented
                    v-model="which"
                    :options="[
                        { label: `年表（${props.system.yearTable}）`, value: 'year' },
                        { label: `月表（${props.system.monthTable}）`, value: 'month' }
                    ]" />
            </div>

            <DataTable
                :rows="rows"
                :columns="columns"
                :primary-columns="primaryColumns"
                height="100%" />

            <p class="xy-note calendar-data__note">{{ note }}</p>
        </div>
    </PageShell>
</template>

<style scoped>
.calendar-data {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.calendar-data__bar {
    flex-shrink: 0;
    padding-bottom: 10px;
}

.calendar-data__note {
    flex-shrink: 0;
}
</style>
