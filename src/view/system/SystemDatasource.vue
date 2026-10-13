<script setup lang="ts">
/**
 * 数据信息（`/system/datasource`）：22 个分库的表结构、行数与构建时间。
 *
 * ## 与工作台"数据健康"的分工
 *
 * | 页面                     | 回答什么                              | 深度           |
 * | ------------------------ | ------------------------------------- | -------------- |
 * | 工作台 · 数据健康         | 一眼看出哪个库不对                     | 行数 + 状态标签 |
 * | 系统 · 数据信息（本页）   | 每个库具体有哪些表、`_meta` 说了什么   | 全部表 + 元数据 |
 *
 * 同一个数据的两种读法不是重复：工作台要"一瞥即知"，这一页要"逐个核对来源"。
 * `docs/design.md` §3.2 的 `_meta`（`module / source / source_sha256 / built_at /
 * tables / rows / counts`）就是为后者准备的，所以它在这一页出现。
 *
 * ## 构建时间从 `_meta` 读，不猜文件时间
 *
 * 文件的 mtime 会被复制、检出、备份改掉，而 `built_at` 是构建那一刻写进去的。
 * 核对"这批数据是什么时候装的"要看后者。
 */

import { computed, ref } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { useQueryOne } from "../../state/use-calendar-query";
import type { Row } from "../../datasource/sqlite";
import { formatCount, useModuleStates } from "../../state/use-calendar-query";

const { states, state, error, reload } = useModuleStates();

/** 展开的库：一次只看一个的 `_meta`，避免 22 次查询一起发。 */
const expanded = ref<string | null>("dynasty");

/** 当前展开库的 `_meta`。 */
const { row: metaRow } = useQueryOne<Row>(
    () => expanded.value ?? "dynasty",
    () => (expanded.value === null ? null : 'SELECT * FROM "_meta" LIMIT 1')
);

/** 把 `_meta` 的 key-value 行拆成若干条：这里按列取（`_meta` 是 key/value 两列）。 */
const metaPairs = computed(() => {
    const row = metaRow.value;
    if (row === null) {
        return [];
    }
    return Object.entries(row).map(([key, value]) => ({
        key,
        value: value === null || value === undefined ? "" : String(value)
    }));
});

/** 展开 / 收起。 */
const toggle = (name: string): void => {
    expanded.value = expanded.value === name ? null : name;
};

/** 行数格式化。 */
const rowsOf = (value: number | null): string => (value === null ? "—" : formatCount(value));
</script>

<template>
    <PageShell
        :state="state"
        :error-text="error"
        source="src/sqlite/"
        empty-text="没有登记的分库"
        @retry="reload">
        <div class="xy-panel datasource__panel">
            <h2 class="xy-panel-title">分库清单</h2>

            <ElTable :data="states as unknown as Row[]" stripe class="datasource__table">
                <ElTableColumn prop="label" label="分库" width="120" />
                <ElTableColumn prop="name" label="模块" width="140">
                    <template #default="{ row }">
                        <span class="numeral xy-chip">{{ row.name }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn prop="file" label="文件" width="230">
                    <template #default="{ row }">
                        <span class="numeral datasource__file">src/sqlite/{{ row.file }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn label="表" width="80" align="right">
                    <template #default="{ row }">
                        <span class="numeral">{{ row.tables.length }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn label="主表行数" width="140" align="right">
                    <template #default="{ row }">
                        <span class="numeral">{{ rowsOf(row.rows) }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn label="状态" width="110">
                    <template #default="{ row }">
                        <ElTag
                            :type="row.problem ? 'danger' : row.present ? 'success' : 'info'"
                            size="small"
                            effect="plain">
                            {{ row.problem ? "打不开" : row.present ? "已装数" : "缺文件" }}
                        </ElTag>
                    </template>
                </ElTableColumn>
                <ElTableColumn prop="note" label="说明" min-width="180" />
                <ElTableColumn label="" width="80" align="right">
                    <template #default="{ row }">
                        <ElButton text size="small" @click="toggle(row.name)">
                            <AppIcon :name="expanded === row.name ? 'Top' : 'Bottom'" />
                            <span>{{ expanded === row.name ? "收起" : "展开" }}</span>
                        </ElButton>
                    </template>
                </ElTableColumn>
            </ElTable>

            <p class="xy-note">
                行数是**实时** <code>COUNT(*)</code>（取该库最大的那张表）。
                缺文件与零行是两件事，标签分开。
            </p>
        </div>

        <!-- 展开的那个库：表清单 + _meta -->
        <div v-if="expanded !== null" class="xy-panel datasource__panel">
            <h2 class="xy-panel-title">
                {{ expanded }} 的表与构建元数据
            </h2>

            <ElDescriptions :column="1" border size="small" class="datasource__meta">
                <ElDescriptionsItem v-for="pair in metaPairs" :key="pair.key" :label="pair.key">
                    <span class="numeral datasource__meta-value">{{ pair.value }}</span>
                </ElDescriptionsItem>
            </ElDescriptions>

            <ul class="datasource__tables">
                <li v-for="item in states.find((entry) => entry.name === expanded)?.tables ?? []" :key="item">
                    <span class="numeral xy-chip">{{ item }}</span>
                </li>
            </ul>

            <p class="xy-note">
                <code>_meta</code> 是构建元数据，不对应实体、也不参与各层映射
                （<code>docs/design.md</code> §3.2）。其中的
                <code>built_at</code> 是构建那一刻写进去的，比文件 mtime 可信
                ——mtime 会被复制与检出改掉。
            </p>
        </div>
    </PageShell>
</template>

<style scoped>
.datasource__panel {
    margin-bottom: 16px;
}

.datasource__table {
    width: 100%;
}

.datasource__file {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.datasource__meta {
    margin-bottom: 12px;
}

.datasource__meta-value {
    word-break: break-all;
}

.datasource__tables {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
}
</style>
