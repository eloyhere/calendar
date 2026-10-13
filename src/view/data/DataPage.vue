<script setup lang="ts">
/**
 * 数据域的页容器：`/data/:page`。
 *
 * ## 三页的分工
 *
 * | 页         | 回答什么                              | 形态                  |
 * | ---------- | ------------------------------------- | --------------------- |
 * | 数据浏览   | 任意分库任意表里有什么                 | 分库树 + 表 + 筛选    |
 * | 结构与索引 | 每张表有哪些列、类型、主键、构建元数据 | 表清单 + 列详情       |
 * | 导出       | 把一份结果带走                        | **向导**（`ElSteps`） |
 *
 * ## 为什么导出用向导而别处不用
 *
 * `docs/ui-architecture.md` §2.3 第 13 条引了 NN/g 的判据：
 * "**把向导用于新手用户或不常做的流程（例如配置与设置）**"，
 * 并逐条列了向导的缺点——交互成本更高、**用户难以跨步骤比较信息**、
 * **无法优雅中断**、可能阻塞其他部分、限制创造力。
 *
 * 导出正好落在"低频 + 步骤有依赖（选库 → 选表 → 选列 → 选格式）"那一侧，
 * 所以它是**本项目唯一用向导的地方**。反过来，历法页与工作流编排器
 * 都是高频 + 需要跨步参照的，绝不能用向导。
 */

import { computed, ref, watch } from "vue";

import DomainPages from "../../component/DomainPages.vue";
import PageShell from "../../component/PageShell.vue";
import DataBrowser from "./DataBrowser.vue";
import DataSchema from "./DataSchema.vue";
import DataExport from "./DataExport.vue";
import { useRoute } from "../../plugin";
import { DOMAIN_BY_ID } from "../../entity/domain";
import { useModuleStates } from "../../state/use-calendar-query";

const route = useRoute();

/** 当前页 id。 */
const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** 数据页归属「工作台」域（面板里就在那一组下）。 */
const domain = DOMAIN_BY_ID.get("home")!;

/** 当前页；非法为 `undefined`。 */
const page = computed(() => domain.pages.find((item) => item.path === `/data/${current.value}`));

/** 窗口标题。 */
watch(
    () => page.value?.title,
    (label) => {
        if (label !== undefined) {
            document.title = `${label} · 数据 · 轩辕历法`;
        }
    },
    { immediate: true }
);

/** 切换到另一页时重挂载（每页有自己的选择状态）。 */
const pageKey = ref(current.value);
watch(current, (value) => {
    pageKey.value = value;
});

/** 顶部的规模说明。 */
const { states } = useModuleStates();
const note = computed(() => {
    const loaded = states.value.filter((item) => item.rows !== null);
    const total = loaded.reduce((sum, item) => sum + (item.rows ?? 0), 0);
    return loaded.length === 0
        ? "22 个分库"
        : `${loaded.length} 个分库 · ${total.toLocaleString("en-US")} 行（主表）`;
});
</script>

<template>
    <ElResult
        v-if="page === undefined"
        icon="warning"
        title="没有这一页"
        :sub-title="`数据域没有「${current}」。可用的有：${domain.pages.map((item) => item.title).join('、')}。`"
        class="data-page__missing">
        <template #extra>
            <ElButton type="primary" @click="$router.push('/data/browse')">去看数据浏览</ElButton>
            <ElButton @click="$router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell v-else :state="'ready'" :card="false" :scroll="false">
        <div class="data-page">
            <DomainPages :domain="domain" :current="`/data/${current}`" :note="note" />

            <div class="data-page__body">
                <DataBrowser v-if="current === 'browse'" :key="pageKey" />
                <DataSchema v-else-if="current === 'schema'" :key="pageKey" />
                <DataExport v-else :key="pageKey" />
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.data-page__missing {
    margin-top: 48px;
}

.data-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.data-page__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}
</style>
