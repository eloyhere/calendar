<script setup lang="ts">
/**
 * 年表域的四张表页共用组件（建元 / 节气 / 月相 / 回归年）。
 *
 * ## 为什么四页共用一个组件
 *
 * 它们的**形状完全相同**：一句口径 + 一个搜索框 + 一张表 + 分页。
 * 差异只在数据源与列名，而那是 `ChronologyPage.vue` 登记表里的三行。
 * 各写一份的话，"筛选状态要不要显示""首列放什么""分页怎么算"这几条规则
 * 就会有四份实现——而它们正是 `docs/ui-architecture.md` §2.4 第 5 条
 * （NN/g 数据表四大任务）明确规定过的东西。
 *
 * ## 筛选状态的视觉提示
 *
 * NN/g 那条要求原文是："**必须有清晰的视觉提示表明当前处于已筛选状态**"。
 * 所以搜索框旁边有一个结果计数徽标，没搜时显示总行数。
 *
 * ## 空态与错误分开
 *
 * 搜不到东西是**空态**（"没有匹配的行"），打不开库才是**错误**。
 * 这条规矩从 `docs/research.md` §3 第 7 条一路沿用下来。
 */

import { computed } from "vue";

import DataTable from "../../component/data/DataTable.vue";
import { useDomainTable } from "../../state/use-domain-table";
import { formatCount } from "../../state/use-calendar-query";

interface Props {
    /** 分库模块名 */
    module: string;
    /** 表名 */
    table: string;
    /** 这一页在看什么，用于空态与说明 */
    caption: string;
    /** 页标识，用于给搜索框一个稳定的 label */
    page: string;
}

const props = defineProps<Props>();

const api = useDomainTable(props.module, props.table);

/** 搜索框旁边的状态徽标。 */
const badge = computed(() => {
    const total = api.total.value;
    const shown = api.rows.value.length;
    if (api.search.value.trim().length === 0) {
        return total === null ? "—" : `${formatCount(total)} 行`;
    }
    return `筛出 ${formatCount(shown)} 行 / 共 ${total === null ? "—" : formatCount(total)}`;
});

/** 换搜索串时回到第一页：留在第 5 页上看 3 条结果会让人以为没数据。 */
const onSearch = (value: string): void => {
    api.search.value = value;
    api.page.value = 0;
};

/** 翻页。 */
const onPage = (value: number): void => {
    // `ElPagination` 是 1 起的，内部从 0 起
    api.page.value = value - 1;
};

/** 切排序方向时也回第一页。 */
const toggleDirection = (): void => {
    api.descending.value = !api.descending.value;
    api.page.value = 0;
};

/** 切每页条数。 */
const changeSize = (value: number): void => {
    api.size.value = value;
    api.page.value = 0;
};
</script>

<template>
    <div class="chronology-table">
        <div class="chronology-table__bar">
            <ElInput
                :model-value="api.search.value"
                class="chronology-table__search"
                :placeholder="`在 ${props.caption} 里搜……`"
                clearable
                :aria-label="`搜索 ${props.caption}`"
                @update:model-value="onSearch" />

            <!-- 筛选状态徽标：原文要求"清晰的视觉提示表明当前处于已筛选状态" -->
            <ElTag :type="api.search.value.trim().length > 0 ? 'warning' : 'info'" size="small" effect="plain">
                {{ badge }}
            </ElTag>

            <ElButton text size="small" @click="toggleDirection">
                <AppIcon :name="api.descending.value ? 'Bottom' : 'Top'" />
                <span>{{ api.descending.value ? "新的在前" : "旧的在前" }}</span>
            </ElButton>

            <span class="chronology-table__spring" />

            <ElSelect
                :model-value="api.size.value"
                size="small"
                class="chronology-table__size"
                aria-label="每页条数"
                @update:model-value="(value: number) => changeSize(value)">
                <ElOption v-for="size in [50, 100, 200, 500]" :key="size" :label="`${size} 条/页`" :value="size" />
            </ElSelect>
        </div>

        <PageShell
            :state="api.state.value"
            :error-text="api.error.value"
            :source="`src/sqlite/${props.module}.sqlite`"
            :empty-text="`没有匹配的行。${props.caption}这张表当前查不到结果——换个词，或清空搜索。`"
            @retry="api.reload">
            <DataTable
                :rows="api.rows.value"
                :columns="api.columns.value"
                :primary-columns="api.primaryColumns.value"
                height="100%" />

            <div class="chronology-table__pager">
                <ElPagination
                    :current-page="api.page.value + 1"
                    :page-size="api.size.value"
                    :total="Number(api.total.value ?? 0)"
                    layout="prev, pager, next, jumper"
                    :pager-count="7"
                    background
                    @current-change="onPage" />
            </div>
        </PageShell>
    </div>
</template>

<style scoped>
.chronology-table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.chronology-table__bar {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 10px;
}

.chronology-table__search {
    width: 260px;
}

/* "弹簧"：把每页条数推到最右 */
.chronology-table__spring {
    flex: 1 1 auto;
}

.chronology-table__size {
    width: 120px;
}

.chronology-table__pager {
    display: flex;
    flex-shrink: 0;
    justify-content: flex-end;
    padding-top: 10px;
}
</style>
