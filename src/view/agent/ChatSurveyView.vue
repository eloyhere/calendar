<script setup lang="ts">
/**
 * 智能体 · 数据调研
 *
 * 查找相关数据、建立统计模型并输出分析结果。
 *
 * ## 为什么右栏直接摆行数
 *
 * 本项目里有一个**现成的、可核对的调研对象**：22 个分库、1190 万行
 * （见 `docs/design.md` §3）。调研的第一步是"从哪儿取数、那个库有多大"，
 * 这个答案不该藏在概览页里让人来回切——所以右栏把各库行数按从大到小排开。
 *
 * 数字与 `view/OverviewView.vue` 同源（同一份手工登记表），两处必须一起改；
 * 等 `src/store/*.store.ts` 接上 `count()`，这两处都该换成 store 读数，
 * 那时也就不存在"两处不一致"的问题了。
 *
 * ## 三档抽样口径
 *
 * 历表的年份跨度是 -9999 … 13500，抽样口径会直接改变结论：按整库统计会被近代
 * 密集的年份带着走，按世纪均匀抽样才看得到远古段的形态。所以把三档口径写在
 * 界面上先让人选，再谈数——这也正是"数据调研"与"随便查个数"的区别。
 */

import { computed, ref } from "vue";

import { ChatChannels } from "../../entity/chat";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";
import ChatPromptPanel from "./chat/ChatPromptPanel.vue";

/** 本模式的对话状态。 */
const chat = useChatPage("survey");

/**
 * 分库行数，逐个对照 `docs/design.md` §3 的表格。
 *
 * 只列有数据的库：零行的七张表在下面单独说，混进排行里会把图压平。
 */
const Databases = [
    { name: "temporal", label: "时间点", rows: 6943509 },
    { name: "climate", label: "节气历", rows: 1743926 },
    { name: "week", label: "周", rows: 1453271 },
    { name: "phase", label: "月相", rows: 1162616 },
    { name: "part", label: "分段", rows: 871962 },
    { name: "phenology", label: "节气物候", rows: 564000 },
    { name: "synodic", label: "朔望", rows: 314154 },
    { name: "epoch", label: "建元", rows: 9689 },
    { name: "event", label: "事件", rows: 2379 },
    { name: "era", label: "年号", rows: 1184 },
    { name: "perform", label: "行度", rows: 808 },
    { name: "person", label: "人物", rows: 425 },
    { name: "dynasty", label: "朝代", rows: 89 },
    { name: "encounter", label: "交会", rows: 28 },
    { name: "primary", label: "本原", rows: 3 }
] as const;

/** 总行数。 */
const totalRows = computed((): number => Databases.reduce((sum, item) => sum + item.rows, 0));

/** 排行：从大到小，取前六，附占全库的百分比。 */
const ranking = computed(() =>
    Databases.slice()
        .sort((left, right) => right.rows - left.rows)
        .slice(0, 6)
        .map((item) => {
            return {
                name: item.name,
                label: item.label,
                rows: item.rows,
                share: Math.round((item.rows / totalRows.value) * 100)
            };
        })
);

/** 零行的库：数据源缺失或换算法则未实现。 */
const ZeroRows = ["chronology", "astronomy", "gregory", "jupiter", "natural", "tree", "tropical"];

/** 抽样口径，默认按世纪均匀。 */
const sampling = ref("century");

/** 三档口径及其说明。 */
const Samplings = [
    { value: "all", label: "整库统计", note: "全部 1190 万行，结论受近代年份密度影响" },
    { value: "century", label: "按世纪均匀", note: "每世纪等量抽样，看得到远古段的形态" },
    { value: "sample", label: "随机抽样 1%", note: "最快，适合先看分布再定口径" }
] as const;

/** 当前口径的说明。 */
const samplingNote = computed(
    (): string => Samplings.find((item) => item.value === sampling.value)?.note ?? ""
);

/** 行数格式化：`6943509` -> `6,943,509`。 */
function formatRows(rows: number): string {
    return rows.toLocaleString("en-US");
}
</script>

<template>
    <ChatPage
        channel="survey"
        hint="调研对象是本项目的 22 个分库；下列数值取自 docs/design.md §3。">
        <ChatPromptPanel
            :chat="chat"
            :items="ChatChannels.survey.starters"
            title="可以查什么"
            note="提问时把口径说清楚（哪几个库、哪一段年份），回复才落得到数上。" />

        <section class="xy-panel">
            <h4 class="xy-panel-title">
                数据范围
                <ElTag type="info" size="small" effect="plain" class="numeral">
                    {{ Databases.length }} 库 · {{ formatRows(totalRows) }} 行
                </ElTag>
            </h4>

            <ul class="survey-ranking">
                <li v-for="item in ranking" :key="item.name" class="survey-ranking__item">
                    <div class="survey-ranking__head">
                        <span class="survey-ranking__label">{{ item.label }}</span>
                        <span class="xy-dim numeral">{{ formatRows(item.rows) }}</span>
                    </div>
                    <ElProgress
                        :percentage="item.share"
                        :stroke-width="8"
                        :show-text="false"
                        class="survey-ranking__bar" />
                    <span class="xy-dim numeral">{{ item.name }} · 占 {{ item.share }}%</span>
                </li>
            </ul>

            <p class="xy-note">
                另有 <strong>{{ ZeroRows.length }} 张表是零行</strong>：
                {{ ZeroRows.join("、") }}——数据源缺失或换算法则未实现，**不是查询失败**。
            </p>
        </section>

        <section class="xy-panel">
            <h4 class="xy-panel-title">抽样口径</h4>

            <ElRadioGroup v-model="sampling" class="survey-sampling">
                <ElRadio v-for="item in Samplings" :key="item.value" :value="item.value">
                    {{ item.label }}
                </ElRadio>
            </ElRadioGroup>

            <p class="xy-note">{{ samplingNote }}</p>
            <p class="xy-note">
                口径目前**只是界面上的选择，没有接到查询**：真正的取数要等
                `src/store/*.store.ts` 的 `load()` 与 `count()` 接上。
            </p>
        </section>
    </ChatPage>
</template>

<style scoped>
.survey-ranking {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.survey-ranking__head {
    align-items: baseline;
    display: flex;
    gap: 8px;
    justify-content: space-between;
}

.survey-ranking__label {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}

.survey-ranking__bar {
    margin: 4px 0 2px;
}

.survey-sampling {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
</style>
