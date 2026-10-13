<script setup lang="ts">
/**
 * 命理域的页容器：`/numerology/:page`。
 *
 * ## 六页的形状
 *
 * `docs/ui-architecture.md` §6.5 只要求两处调整（形状本身与旧表一致）：
 *
 * 1. **所有排盘的输入沿用同一套时间输入组件**（记住上次用哪种历法表达）
 *    —— §2.2 第 8 条（一致性）+ 第 4 条（模式选择不平铺四个等价选项）；
 * 2. **排盘结果里的每个时间点都可点**，跳到年表的对应位置
 *    —— §2.1 第 1 条（跨上下文联结要显式画出来）。
 *
 * 六页的差异在**推演方法**，而推演方法目前都还没有实现（`docs/design.md` 里
 * 六套术数都只在实体层有定义）。所以这一层的职责是：
 * **把输入统一好、把数据来源说清楚**，而不是假装已经会排盘。
 * 这一条与 `docs/research.md` §5 的取舍一致：写死的部分要说明它是说明书，
 * 不能让审阅的人以为已经接上了。
 */

import { computed, watch } from "vue";

import DomainPages from "../../component/DomainPages.vue";
import PageShell from "../../component/PageShell.vue";
import NumerologyChart from "./NumerologyChart.vue";
import TimeInput from "./TimeInput.vue";
import { useRoute } from "../../plugin";
import { DOMAIN_BY_ID } from "../../entity/domain";
import { useModuleStates } from "../../state/use-calendar-query";

const route = useRoute();

/** 当前页 id。 */
const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** 命理（八字 / 紫微斗数 / 七政四余 / 星盘）在「命理」域。 */
const domain = DOMAIN_BY_ID.get("astrology")!;

/** 当前页；非法为 `undefined`。 */
const page = computed(() => domain.pages.find((item) => item.path === `/astrology/${current.value}`));

/** 窗口标题。 */
watch(
    () => page.value?.title,
    (label) => {
        if (label !== undefined) {
            document.title = `${label} · 命理 · 轩辕历法`;
        }
    },
    { immediate: true }
);

/**
 * 每页用哪个分库。
 *
 * `wiki` 没有数据源（它是术语总览），所以给空串。
 * 排盘页依赖的是历法的换算结果——`tree`（干支历）是四柱的底座，
 * `tropical`（回归历）是星盘的底座，`part` / `week` 是旬与候。
 */
const Registry: Record<string, { module: string; caption: string }> = {
    wiki: { module: "", caption: "术语与流派" },
    bazi: { module: "tree", caption: "干支历 · 四柱底座" },
    ziwei: { module: "astronomy", caption: "天文历 · 十二宫底座" },
    qizheng: { module: "perform", caption: "五星行度" },
    gua: { module: "part", caption: "旬与卦序" },
    horoscope: { module: "tropical", caption: "回归历 · 黄道坐标" }
};

const entry = computed(() => Registry[current.value] ?? { module: "", caption: "" });

/** 分库实时行数。 */
const { states } = useModuleStates();
const note = computed(() => {
  const module = entry.value.module;
  if (module === "") {
    return "术语与流派总览";
  }
  const rows = states.value.find((item) => item.name === module)?.rows ?? null;
  return rows === null
    ? entry.value.caption
    : `${entry.value.caption} · ${rows.toLocaleString("en-US")} 行`;
});
</script>

<template>
    <!-- 非法 :page：空态 + 出口 -->
    <ElResult
        v-if="page === undefined"
        icon="warning"
        title="没有这一页"
        :sub-title="`命理域没有「${current}」。可用的有：${domain.pages.map((item) => item.title).join('、')}。`"
        class="numerology-page__missing">
        <template #extra>
            <ElButton type="primary" @click="$router.push('/numerology/wiki')">去看命理百科</ElButton>
            <ElButton @click="$router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell v-else :state="'ready'" :card="false" :scroll="false">
        <div class="numerology-page">
            <DomainPages :domain="domain" :current="`/astrology/${current}`" :note="note" />

            <ElScrollbar class="numerology-page__body">
                <div class="numerology-page__inner">
                    <!--
                        时间输入：六页共用同一套。它的意义不只是省代码——
                        "公历 / 农历 / 年号 / 干支"四种表达如果各页写法不同，
                        用户每换一页就要重新学一遍怎么填日期。
                    -->
                    <div class="xy-panel">
                        <h2 class="xy-panel-title">时刻</h2>
                        <TimeInput />
                        <p class="xy-note">
                            四柱、星盘、卦象都要一个时刻作为输入。这里选完，下面的推演与
                            <RouterLink to="/chronology/timeline">年表</RouterLink>
                            看的是同一个视点——状态栏中间那一段会跟着变。
                        </p>
                    </div>

                    <NumerologyChart :page="current" :caption="entry.caption" />

                    <div class="xy-panel">
                        <h2 class="xy-panel-title">这一页依赖什么</h2>
                        <p class="xy-note">
                            命理域的六页目前**只有输入与数据底座**，推演方法本身还没实现
                            ——<code>docs/design.md</code> 里六套术数都只在实体层有定义，
                            没有对应的算法与表。这里写清楚依赖哪个分库，是为了让"缺什么"可核对：
                            有数据的地方读真数据，没算法的地方直说没算法，不摆一个看起来能用的按钮。
                        </p>
                        <ElDescriptions :column="1" border size="small" class="numerology-page__deps">
                            <ElDescriptionsItem label="本页数据源">
                                <span v-if="entry.module === ''" class="xy-dim">无（术语总览）</span>
                                <span v-else class="numeral xy-chip">{{ entry.module }}</span>
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label="推演方法">
                                <ElTag size="small" type="info" effect="plain">待实现</ElTag>
                            </ElDescriptionsItem>
                        </ElDescriptions>
                    </div>
                </div>
            </ElScrollbar>
        </div>
    </PageShell>
</template>

<style scoped>
.numerology-page__missing {
    margin-top: 48px;
}

.numerology-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.numerology-page__body {
    flex: 1;
    min-height: 0;
}

.numerology-page__inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 8px;
}

.numerology-page__deps {
    margin-top: 12px;
}
</style>
