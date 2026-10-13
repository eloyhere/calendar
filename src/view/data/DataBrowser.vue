<script setup lang="ts">
/**
 * 数据浏览（`/data/browse`）：分库树 + 表视图。
 *
 * ## 布局与依据
 *
 * ```
 * ┌──────────────┬────────────────────────────────────────────────┐
 * │ 分库树 260px │ 表头：表名 · 分库状态 · 列数                     │
 * │ 22 个分库     │ DataTable：固定表头、首列人类可读标识、列菜单    │
 * │ 每库 N 张表   │ 底部：只读说明 + 分页                            │
 * └──────────────┴────────────────────────────────────────────────┘
 * ```
 *
 * **筛选器与结果必须在同一区块内**（格式塔的 proximity + common region，
 * `docs/ui-architecture.md` §2.2 第 9 条）。把筛选器钉在页面顶部的横栏、
 * 结果在很下面，用户改完筛选要移动视线去找结果——那正是 NN/g 说的"分裂注意"。
 * 所以右侧整体是一个 `.browser__panel`（一道边框 + 一块底色），
 * 搜索框、列菜单、表格、分页都在它里面。
 *
 * ## 分库树用 `ElTree` 而不是两级级联下拉
 *
 * 22 个分库、上百张表是一个**两层的固定结构**，树能一次看完；
 * 级联下拉要把第一层选完才知道第二层有什么。而"能一次看完"是
 * §2.2 第 7 条（再认优于回忆）的直接要求。
 *
 * ## 换表时要重挂载查询
 *
 * `useDomainTable` 是按 `module` / `table` **在建时**绑定的。切换时如果只是改
 * 两个 ref，它内部的 watch 不会重建（它只 watch 列与语句）。所以这里给
 * `DataTable` 所在的那一段加 `:key`，换表就重挂载——代价是一次组件重建，
 * 换来的是"换表一定刷新"这件确定的事。
 */

import { computed, ref } from "vue";

import DataTable from "../../component/data/DataTable.vue";
import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { useDomainTable } from "../../state/use-domain-table";
import { formatCount, useModuleStates } from "../../state/use-calendar-query";

const { states, state: statesState, error: statesError, reload: reloadStates } = useModuleStates();

/** 选中的分库与表。默认 `temporal`——它是全库的时间主键，最有代表性。 */
const module = ref("temporal");
const table = ref("temporal");

/** 当前分库的实时状态。 */
const currentModule = computed(() => states.value.find((item) => item.name === module.value));

/** 顶部说明。 */
const note = computed(() => {
    const found = currentModule.value;
    if (found === undefined) {
        return "";
    }
    const rows = found.rows === null ? "—" : formatCount(found.rows);
    return `${found.file} · 主表 ${rows} 行 · ${found.tables.length} 张表`;
});

/**
 * 表格查询。
 *
 * `:key` 用 `表名` 而不是 `模块::表名`：同一个表名出现在两个分库里的情况不存在
 * （登记表里没有重名表），而用短键能让"换库但是同一张表"这种情况保持挂载。
 */
const pick = ref(`${module.value}::${table.value}`);
/**
 * 表格查询。
 *
 * 传 `module` / `table` 的**当前值**而不是 ref：`useDomainTable` 的查询是按
 * 建时绑定的（它内部的 watch 只盯列与语句），所以换库换表由外层
 * `:key="pick"` 重挂载来驱动。传 ref 会让人以为它会自己重查。
 */
const api = useDomainTable(module.value, table.value);

/**
 * 树的 `data`。
 *
 * `label` 用 `中文名（模块名）`：中文名让人认得出，模块名是写 SQL 时要用的键
 * ——两者都给，用户不必去别处对照（§2.2 第 1 条：库名表名必须无需记忆）。
 */
const tree = computed(() =>
    states.value.map((item) => ({
        id: item.name,
        label: `${item.label}（${item.name}）`,
        rows: item.rows,
        problem: item.problem,
        children: item.tables.map((name) => ({ id: `${item.name}::${name}`, label: name }))
    }))
);

/** 点树：叶子换表，分组换库（并自动选它第一张表）。 */
const onPick = (key: string): void => {
    if (key.includes("::")) {
        const [nextModule, nextTable] = key.split("::");
        module.value = nextModule;
        table.value = nextTable;
        pick.value = key;
        return;
    }
    const found = states.value.find((item) => item.name === key);
    if (found !== undefined && found.tables.length > 0) {
        module.value = key;
        table.value = found.tables[0];
        pick.value = `${key}::${found.tables[0]}`;
    }
};
</script>

<template>
    <PageShell
        :state="statesState"
        :error-text="statesError"
        source="src/sqlite/"
        empty-text="22 个分库都还没有装数"
        @retry="reloadStates">
        <div class="browser">
            <!-- 左：分库树 -->
            <aside class="browser__tree">
                <ElScrollbar class="browser__tree-scroll">
                    <ElTree
                        :data="tree"
                        node-key="id"
                        :current-node-key="pick"
                        highlight-current
                        :expand-on-click-node="false"
                        default-expand-all
                        @node-click="(data: { id: string }) => onPick(data.id)">
                        <template #default="{ data }">
                            <span class="browser__node">
                                <span class="browser__node-label is-truncated">{{ data.label }}</span>
                                <span
                                    v-if="typeof data.rows === 'number'"
                                    class="xy-dim numeral browser__node-rows">
                                    {{ formatCount(data.rows) }}
                                </span>
                                <!-- 打不开的库给一个标记，点进去会看到原因 -->
                                <ElTag v-if="data.problem" size="small" type="danger" effect="plain">!</ElTag>
                            </span>
                        </template>
                    </ElTree>
                </ElScrollbar>
            </aside>

            <!--
                右：一个闭合区域包住筛选器、结果与分页。
                换表时这一整块按 `pick` 重挂载，保证查询跟着表走。
            -->
            <section :key="pick" class="browser__panel">
                <header class="browser__head">
                    <h2 class="browser__title">
                        <AppIcon name="DataBoard" />
                        <span class="numeral">{{ table }}</span>
                    </h2>
                    <span class="xy-dim is-truncated">{{ note }}</span>

                    <span class="browser__spring" />

                    <ElTag v-if="api.columns.value.length > 0" size="small" effect="plain">
                        {{ api.columns.value.length }} 列
                    </ElTag>
                </header>

                <DataTable
                    :rows="api.rows.value"
                    :columns="api.columns.value"
                    :primary-columns="api.primaryColumns.value"
                    height="100%" />

                <footer class="browser__foot">
                    <span class="xy-dim">
                        数据是只读的：由 <code>database/build.py</code> 在构建期装入，
                        运行期不写库。
                    </span>
                    <span class="browser__spring" />
                    <ElPagination
                        :current-page="api.page.value + 1"
                        :page-size="api.size.value"
                        :total="Number(api.total.value ?? 0)"
                        layout="prev, pager, next"
                        :pager-count="5"
                        small
                        background
                        @current-change="(value: number) => (api.page.value = value - 1)" />
                </footer>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.browser {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
}

.browser__tree {
    border-right: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    min-height: 0;
    padding-right: 12px;
    width: 260px;
}

.browser__tree-scroll {
    height: 100%;
}

.browser__node {
    align-items: center;
    display: flex;
    gap: 6px;
    min-width: 0;
}

.browser__node-label {
    flex: 1;
    font-size: 12px;
    min-width: 0;
}

.browser__node-rows {
    font-size: 10px;
}

/* 右侧面板：一个闭合区域，筛选器、结果、分页都在里面（格式塔 common region） */
.browser__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    padding: 12px;
}

.browser__head {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 10px;
}

.browser__title {
    align-items: center;
    color: var(--el-text-color-primary);
    display: flex;
    font-size: 15px;
    font-weight: 600;
    gap: 6px;
    margin: 0;
}

/* "弹簧"：把右侧内容推到最右 */
.browser__spring {
    flex: 1 1 auto;
}

.browser__foot {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-top: 10px;
}
</style>
