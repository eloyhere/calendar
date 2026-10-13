<script setup lang="ts">
/**
 * 年表域的页容器：`/chronology/:page`。
 *
 * 域出口（`view/ChronologyView.vue`）只写一个 `<RouterView/>`，真正的页面在这里。
 * 五页共用一层壳（页内切换器 + 页面状态），差异在中间的 `v-if` 分支。
 *
 * ## 这一域要回答的问题
 *
 * **"哪一年发生了什么、谁在位、年号是什么"**（`docs/ui-architecture.md` §3.1 的
 * 「历史编年」上下文）。它与历法域的分界是语义而不是数据：
 * `climate`（节气）在历法域叫「节气历」——那套历法怎么算节气；
 * 在这里叫「节气」——某年的节气落在哪一天。同一个库，两个上下文，
 * **两页互相链接**（§4.3.2）。
 */

import { computed, ref, watch } from "vue";

import DomainPages from "../../component/DomainPages.vue";
import PageShell from "../../component/PageShell.vue";
import ChronologyTimeline from "./ChronologyTimeline.vue";
import ChronologyTable from "./ChronologyTable.vue";
import { useRoute } from "../../plugin";
import { DOMAIN_BY_ID } from "../../entity/domain";
import { useModuleStates } from "../../state/use-calendar-query";

const route = useRoute();

/** 当前页 id。 */
const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** 年表在「历法」域的面板里（与节气一览、朔望表同组）。 */
const domain = DOMAIN_BY_ID.get("calendar")!;

/** 当前页登记项；非法为 `undefined`。 */
const page = computed(() => domain.pages.find((item) => item.path === `/chronology/${current.value}`));

/** 窗口标题：参数化路由的标题由页面写。 */
watch(
    () => page.value?.title,
    (label) => {
        if (label !== undefined) {
            document.title = `${label} · 年表 · 轩辕历法`;
        }
    },
    { immediate: true }
);

/**
 * 每页用哪个分库、哪张表。表名在这里定，页组件只负责渲染。
 *
 * `timeline` 是唯一走 `chronology` 之外的表：它要朝代与年号，
 * 而那两张表在各自的库里（`dynasty.sqlite` / `era.sqlite`）。
 * 跨库查询由页面自己发两次（SQLite 不支持跨文件外键，
 * 见 `docs/design.md` §3.1），所以这里只登记主表。
 */
const Registry: Record<string, { module: string; table: string; caption: string }> = {
    timeline: { module: "dynasty", table: "dynasty", caption: "朝代与年号" },
    epoch: { module: "epoch", table: "epoch", caption: "历代建元" },
    "solar-term": { module: "phenology", table: "phenology", caption: "节气与中气时刻" },
    "lunar-phase": { module: "phase", table: "phase", caption: "月相时刻" },
    "tropical-year": { module: "tropical", table: "tropical_year", caption: "回归年" }
};

/** 当前页的数据源说明。 */
const entry = computed(() => Registry[current.value] ?? null);

/** 分库实时行数：切换器旁边的计数，让用户先知道这一页有多少东西。 */
const { states } = useModuleStates();
const rows = computed(() => {
    if (entry.value === null) {
        return null;
    }
    return states.value.find((item) => item.name === entry.value?.module)?.rows ?? null;
});

const note = computed(() =>
    rows.value === null ? "" : `${entry.value?.caption} · ${rows.value.toLocaleString("en-US")} 行`
);

/** 页内切换时把滚动位置回到顶部由 router 的 `scrollBehavior` 负责，这里只管重挂载。 */
const pageKey = ref(current.value);
watch(current, (value) => {
    pageKey.value = value;
});
</script>

<template>
    <!-- 非法 :page：空态 + 出口，不重定向 -->
    <ElResult
        v-if="page === undefined"
        icon="warning"
        title="没有这一页"
        :sub-title="`年表域没有「${current}」。可用的有：${domain.pages.map((item) => item.title).join('、')}。`"
        class="chronology-page__missing">
        <template #extra>
            <ElButton type="primary" @click="$router.push('/chronology/timeline')">去看年表</ElButton>
            <ElButton @click="$router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell
        v-else
        :state="'ready'"
        :card="false"
        :scroll="false"
        :source="entry === null ? '' : `src/sqlite/${entry.module}.sqlite`">
        <div class="chronology-page">
            <DomainPages :domain="domain" :current="`/chronology/${current}`" :note="note" />

            <div class="chronology-page__body">
                <!--
                    年表：朝代 / 年号 / 事件。它是唯一需要"横向泳道"的一页
                    ——多个朝代允许重叠（三国、十六国、辽宋金夏），
                    单条线画不出来（`docs/design.md` §1.2）。
                -->
                <ChronologyTimeline v-if="current === 'timeline'" :key="pageKey" />

                <!-- 其余四页形状相同：一句口径 + 一张可筛选的表 -->
                <ChronologyTable
                    v-else-if="entry !== null"
                    :key="pageKey"
                    :module="entry.module"
                    :table="entry.table"
                    :caption="entry.caption"
                    :page="current" />
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.chronology-page__missing {
    margin-top: 48px;
}

.chronology-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.chronology-page__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}
</style>
