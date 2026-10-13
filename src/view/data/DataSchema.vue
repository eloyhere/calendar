<script setup lang="ts">
/**
 * 结构与索引（`/data/schema`）：每张表有哪些列、类型、主键与构建元数据。
 *
 * ## 左侧表清单、右侧列详情
 *
 * 与"数据浏览"的区别是：**这里不看数据，只看结构**。
 * 两页分开的理由是 `docs/ui-architecture.md` §2.1 第 1 条（限界上下文）的推广——
 * "这张表有哪些列"与"这张表里有什么"是两个问题，混在一页里会让
 * "我要看结构"变成"我要在数据里翻"。
 *
 * ## `_meta` 表要单独说
 *
 * 每个 `.sqlite` 里都有一张 `_meta`，记 `module / source / source_sha256 /
 * built_at / tables / rows / counts`（`docs/design.md` §3.2）。
 * 它**不对应实体、也不参与各层映射**，是构建元数据——所以它在表清单里
 * 单独分组显示，不混进业务表里。
 */

import { computed, ref, watch } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import type { Row } from "../../datasource/sqlite";
import { useModuleStates, useQuery, useTableColumns } from "../../state/use-calendar-query";

const { states, state, error, reload } = useModuleStates();

/** 选中的分库与表。 */
const module = ref("temporal");
const table = ref("temporal");

const current = computed(() => states.value.find((item) => item.name === module.value));

/** 当前分库的业务表（去掉 `_meta`）。 */
const tables = computed(() => (current.value?.tables ?? []).filter((name) => name !== "_meta"));

/** 列。 */
const { columns, error: columnError } = useTableColumns(module, table);

/** `_meta` 的内容：构建元数据，单独显示。 */
const { rows: meta } = useQuery<Row>(
    module,
    `SELECT * FROM "_meta" LIMIT 40`
);

/** 换分库时把表也换到第一张，避免"库换了表还在"的错配。 */
watch(
    module,
    () => {
        const first = tables.value[0];
        if (first !== undefined) {
            table.value = first;
        }
    },
    { immediate: true }
);

/** 点表清单。 */
const pick = (name: string): void => {
    table.value = name;
};

/** 页面状态：列出错算错误。 */
const pageState = computed(() => (columnError.value.length > 0 ? "error" : state.value));
</script>

<template>
    <PageShell
        :state="pageState"
        :error-text="columnError || error"
        source="src/sqlite/"
        empty-text="22 个分库都还没有装数"
        @retry="reload">
        <div class="schema">
            <!-- 左：分库 + 表清单 -->
            <aside class="schema__list">
                <ElSelect v-model="module" size="small" class="schema__module" aria-label="分库">
                    <ElOption
                        v-for="item in states"
                        :key="item.name"
                        :label="`${item.label}（${item.name}）`"
                        :value="item.name" />
                </ElSelect>

                <ElScrollbar class="schema__scroll">
                    <ul class="schema__tables">
                        <li v-for="name in tables" :key="name">
                            <button
                                type="button"
                                class="schema__table"
                                :class="{ 'is-active': name === table }"
                                @click="pick(name)">
                                <span class="is-truncated numeral">{{ name }}</span>
                            </button>
                        </li>
                    </ul>

                    <!-- `_meta` 单独一段：它是构建元数据，不是业务表 -->
                    <p v-if="current?.tables.includes('_meta')" class="xy-dim schema__meta-hint">
                        另有 <code>_meta</code>（构建元数据）
                    </p>
                </ElScrollbar>
            </aside>

            <section class="schema__detail">
                <header class="schema__head">
                    <h2 class="schema__title">
                        <AppIcon name="Files" />
                        <span class="numeral">{{ table }}</span>
                    </h2>
                    <span class="xy-dim">
                        {{ current?.file }} · {{ columns.length }} 列
                    </span>
                </header>

                <ElScrollbar class="schema__body">
                    <ElTable :data="columns" size="small" class="schema__columns">
                        <ElTableColumn prop="name" label="列" min-width="200">
                            <template #default="{ row }">
                                <!--
                                    第一列是列名而不是序号：本页的"记录标识"就是列名本身
                                    （NN/g 那条"首列应是人类可读的标识"在这里的自然形态）。
                                -->
                                <span class="numeral">{{ row.name }}</span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn prop="type" label="类型" width="140">
                            <template #default="{ row }">
                                <span class="numeral xy-dim">{{ row.type || "（未声明）" }}</span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn label="约束" width="160">
                            <template #default="{ row }">
                                <ElTag v-if="row.primaryKey" size="small" effect="plain">主键</ElTag>
                                <ElTag v-if="row.notNull" size="small" type="info" effect="plain">非空</ElTag>
                                <span v-if="!row.primaryKey && !row.notNull" class="xy-dim">—</span>
                            </template>
                        </ElTableColumn>
                    </ElTable>

                    <div class="xy-panel schema__meta">
                        <h3 class="xy-panel-title">构建元数据（_meta）</h3>
                        <ElEmpty v-if="meta.length === 0" description="这个分库没有 _meta 表" :image-size="50" />
                        <ElDescriptions v-else :column="1" border size="small">
                            <ElDescriptionsItem v-for="row in meta" :key="String(row.key ?? row.name)" :label="String(row.key ?? row.name)">
                                <span class="numeral schema__meta-value">{{ row.value ?? row.val ?? "" }}</span>
                            </ElDescriptionsItem>
                        </ElDescriptions>
                        <p class="xy-note">
                            <code>_meta</code> 记 <code>module / source / source_sha256 / built_at / tables / rows / counts</code>，
                            它不对应实体、也不参与各层映射（<code>docs/design.md</code> §3.2）。
                            逐个核对来源时看它。
                        </p>
                    </div>
                </ElScrollbar>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.schema {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
}

.schema__list {
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 8px;
    min-height: 0;
    padding-right: 12px;
    width: 240px;
}

.schema__module {
    flex-shrink: 0;
}

.schema__scroll {
    flex: 1;
    min-height: 0;
}

.schema__tables {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.schema__table {
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    font-size: 12px;
    padding: 6px 8px;
    text-align: left;
    width: 100%;
}

.schema__table:hover {
    background: var(--el-fill-color-light);
}

.schema__table.is-active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
}

.schema__meta-hint {
    margin: 10px 8px 0;
}

.schema__detail {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
}

.schema__head {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 10px;
}

.schema__title {
    align-items: center;
    display: flex;
    font-size: 15px;
    font-weight: 600;
    gap: 6px;
    margin: 0;
}

.schema__body {
    flex: 1;
    min-height: 0;
}

.schema__columns {
    width: 100%;
}

.schema__meta {
    margin-top: 16px;
}

.schema__meta-value {
    word-break: break-all;
}
</style>
