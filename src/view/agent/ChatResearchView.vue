<script setup lang="ts">
/**
 * 智能体 · 深度研究
 *
 * 检索可信资料，深入分析课题并生成报告。
 *
 * ## 这一页与「新建对话」的差别，不在版式而在四件事
 *
 * 上一版把"深度"做成了一个按轮次推进的进度条——问一句走一格。那是不成立的：
 * 进度一旦与内容无关，它就不再是信息，只是装饰。这一版把四个环节的判据换成
 * **消息流里真实出现过的东西**（见 `stageOf()`），并补上三样只有研究报告才有的
 * 内容，四件事都在右栏：
 *
 * 1. **进行到哪一步**（定口径 → 取数 → 交叉验证 → 成文）。分环节而不是给一个
 *    总百分比：信息检索的过程模型里，"探索期的来回"是必然的一段，环节能把
 *    它显示出来，百分比只会把它抹成一个卡住的数字；
 * 2. **证据够不够**。按立场分开计数（支持 / 反证 / 口径）与按置信度分档——
 *    只列支持性材料是确认偏误的界面版本；
 * 3. **什么会推翻这个结论**。每条结论都写出可证伪的条件，把"能被推翻"这件事
 *    直接摆在结论旁边，而不是留给用户自己想到；
 * 4. **读完之后自己还答不上什么**。自检题先给问题、依据收在折叠里，
 *    不直接把答案摊开——摊开的答案会被当成正文略过。
 *
 * ## 为什么用"已完成工作量"而不是百分比
 *
 * 研究耗时不可预知，而进度条一旦走得不线性（先快后停），用户会读成"卡住了"。
 * 所以进度以环节名与已完成的**份数**表述，不给假精确的百分数。
 *
 * ## 提问深度为什么要先选
 *
 * 同一句话在不同深度上要的材料完全不同："是哪一天"只要一条记录，"怎么定出来的"
 * 要文献、旁证与反证。用户不选，助手只能猜；猜错时给出的答案看起来是完整的，
 * 其实只有第一层的材料——这正是"知识错觉"最容易发生的地方。默认停在「解释」，
 * 因为多数人问的是"为什么"，改档只要一次点击。
 *
 * ## 未接后端
 *
 * 环节、证据、置信度都由消息流现算（`src/entity/research.ts`）；而下方四组
 * 内容（否证条件、资料边界、未决问题、自检题）与右栏的资料清单是**按本项目
 * 主题写死的常量**——它们同时充当"这一页将来长什么样"的说明书。接入点只有
 * 一个形状：等检索任务就位，把这几组常量换成任务产出的字段即可，
 * 页面结构与推导函数都不用动。
 */

import { computed, ref } from "vue";
import type { Component } from "vue";

import type { ChatCitation, ChatMessage } from "../../entity/chat";
import { ChatChannels } from "../../entity/chat";
import type { ResearchQuestion, ResearchSelfCheck } from "../../entity/research";
import {
    ConfidenceLabels,
    StanceLabels,
    activeStageOf,
    completedCount,
    evidenceOf,
    stageOf
} from "../../entity/research";
import { resolveIconComponent } from "../../plugin/dependencies";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";
import ChatPromptPanel from "./chat/ChatPromptPanel.vue";
import ChatTyping from "./chat/ChatTyping.vue";

/** 本模式的对话状态。 */
const chat = useChatPage("research");

/* -------------------------------------------------------------------------- */
/* 由消息流推导的部分                                                          */
/* -------------------------------------------------------------------------- */

/** 四个环节的完成情况。判据见 `src/entity/research.ts` 的 `stageOf()`。 */
const stages = computed(() => stageOf(chat.messages.value));

/** 已完成环节数。 */
const doneCount = computed((): number => completedCount(stages.value));

/** 当前正在进行的环节；全部完成时为 `null`。 */
const activeStage = computed(() => activeStageOf(stages.value));

/** 证据概览：出处数、立场分布、置信度分布。 */
const evidence = computed(() => evidenceOf(chat.messages.value));

/** 是否已经开题：用户提了课题。 */
const opened = computed((): boolean =>
    chat.messages.value.some((entry: ChatMessage): boolean => entry.role === "user")
);

/** 研究是否已经走完四步。 */
const finished = computed((): boolean => stages.value.every((state) => state.done));

/** 证据计数的三行：图标、标签、条数。 */
const tallyRows = computed((): Array<{ mark: Component | null; className: string; label: string; count: number }> => [
    {
        mark: resolveIconComponent("CircleCheck"),
        className: "is-support",
        label: "支持",
        count: evidence.value.supporting
    },
    {
        mark: resolveIconComponent("Warning"),
        className: "is-contradict",
        label: "反证",
        count: evidence.value.contradicting
    },
    {
        mark: resolveIconComponent("InfoFilled"),
        className: "is-neutral",
        label: "不同出处",
        count: evidence.value.origins
    }
]);

/** 自检题左侧的图标：未展开时是问号，展开后换成勾（见模板里的三元）。 */
const checkIcon = computed((): Component | null => resolveIconComponent("QuestionFilled"));

/** 自检题的展开状态：id -> 是否已展开。 */
const revealed = ref<Record<string, boolean>>({});

/** 已展开依据的自检题数。 */
const revealedCount = computed((): number =>
    SelfChecks.filter((item: ResearchSelfCheck): boolean => revealed.value[item.id] === true).length
);

/** 展开 / 收起一条自检题的依据。 */
function toggleRevealed(id: string): void {
    revealed.value = { ...revealed.value, [id]: !revealed.value[id] };
}

/**
 * 去重后的出处清单，供右栏快速核对。
 *
 * 消息里的证据卡片已经逐条列过，这里再列一遍是为了**把不同来源凑到一起**：
 * 卡片按发言时间排，同一结论的两条材料可能隔着好几屏；交叉验证要看的是
 * "这两条是不是彼此独立"，那必须在同一处看到它们。
 */
const origins = computed((): ChatCitation[] => {
    const seen = new Map<string, ChatCitation>();

    for (const entry of chat.messages.value) {
        for (const citation of entry.citations ?? []) {
            if (!seen.has(citation.source)) {
                seen.set(citation.source, citation);
            }
        }
    }

    return [...seen.values()];
});

/**
 * 各环节的当前状态。
 *
 * 三态而不是两态：`wait`（还没轮到）、`process`（正在进行）、`finish`（已完成）。
 * 只分"做了 / 没做"时，那一步正在进行还是根本没开始，界面上分不出来——
 * 而这两件事对"要不要等下去"的影响完全不同。
 */
function stepStatus(index: number): "wait" | "process" | "finish" {
    if (stages.value[index]?.done) {
        return "finish";
    }

    return stages.value.findIndex((state) => !state.done) === index ? "process" : "wait";
}

/** 某一环节已完成时的产出说明；正在进行时给判据，用户知道还差什么。 */
function stageNote(index: number): string {
    const state = stages.value[index];

    return state?.done ? state.stage.delivers : state?.stage.criterion ?? "";
}

/* -------------------------------------------------------------------------- */
/* 页面内容                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 否证条件：什么情况下这个结论就不成立。
 *
 * 每条都必须是**可判定的**——"再多查一些资料"不是否证条件，"出现了另一个交节
 * 时刻"才是。写在这里的用途是让结论带着自己的失效边界出现。
 */
const Disconfirming = [
    {
        id: "phenology-conflict",
        text: "`phenology` 与 `climate` 对同一次交节给出两个不同时刻",
        effect: "交节时刻不可复现，本条结论降为低置信"
    },
    {
        id: "pingqi-before-1645",
        text: "1645 年之前某一段其实也按定气排算",
        effect: "改历前后的算法无需分叉，日期换算要重做"
    },
    {
        id: "delta-t-small",
        text: "该段的 ΔT 外推误差被证明小于一小时（约 0.04°）",
        effect: "量级不足以挪动交节，ΔT 可退到显示层"
    }
] as const;

/**
 * 资料边界：这一页能核到什么、不能核到什么。
 *
 * 主动写出**没有覆盖到的部分**，而不是等用户问"这个你查了吗"。信息检索里
 * 最贵的一次返工，就是在读完一份完整报告之后才发现它用的口径本来就不适用。
 */
const Boundaries = {
    covered: [
        "本项目的 22 个分库与 `calendar.xlsx` 原始历表",
        "`docs/` 下的口径文档与 `src/sql/` 下的查询语句",
        "zh.wikipedia「中国朝代」「中国年号列表」两个条目"
    ],
    uncovered: [
        "本项目之外的数据库与原典（如《历代长术辑要》原文）",
        "未入库的历表：`astronomy`、`jupiter`、`tree` 等七张当前零行的表",
        "实时天文观测数据与 JPL / IAU 的历表产品"
    ]
} as const;

/** 未决问题：卡在哪里、不解决会影响什么。 */
const OpenQuestions: readonly ResearchQuestion[] = [
    {
        id: "delta-t-extrapolation",
        text: "1645 年之前各段的 ΔT 取值是实测还是外推，本库未标注",
        blockedBy: "`docs/design.md` 只写了建元与换算，没有 ΔT 的来源与分段",
        impact: "若整段都是外推，远古段的交节时刻只能算到「哪一天」，算不到「哪一刻」"
    },
    {
        id: "zero-row-tables",
        text: "`astronomy`、`jupiter`、`tree` 七张表为零行，换算法则尚未实现",
        blockedBy: "`docs/design.md` §3 标注为「换算法则待实现」",
        impact: "凡结论涉及这几个历法体系，本库都无法交叉验证，只能单源"
    },
    {
        id: "xlsx-truncation",
        text: "`calendar.xlsx` 的「第14」表在 13001 年之后被截断",
        blockedBy: "原始工作簿只到 6186 行，13000 年之后的历表不完整",
        impact: "跨 13000 年的统计会把「没有数据」误读成「没有事件」"
    }
];

/** 读后自检：先问，依据收在折叠里。 */
const SelfChecks: readonly ResearchSelfCheck[] = [
    {
        id: "why-matters",
        question: "ΔT 为什么参与判定，而不是显示层的修饰？",
        evidence: "因为它决定交节时刻落在哪一天，而交节时刻决定这个月有没有中气——闰月的位置由此推出"
    },
    {
        id: "which-source",
        question: "这个结论的第二条独立出处是什么？",
        evidence: "`src/sql/climate.sql`（查询语句）与 `docs/design.md` §2（口径）是两个不同来源；同一份文档引三次只算一处"
    },
    {
        id: "what-breaks",
        question: "哪一条证据被推翻时，结论要跟着改？",
        evidence: "见右栏「什么会推翻它」第二条：若 1645 年之前也按定气排算，改历前后就无需分叉"
    },
    {
        id: "not-covered",
        question: "这个问题上，本库**查不到**的是什么？",
        evidence: "见「资料边界」：原典、七张零行的表、以及实时天文观测数据都不在范围内"
    }
];

/**
 * 读完这一页值得记住的三件事。
 *
 * 只给三条，且是**结论**而不是"本章要点"：研究类内容的最短可复述单元是
 * 三句能独立站住的话，再多就退回成摘要，那和正文没有区别了。
 *
 * 下面「未决问题」那一栏的第三条讲的是同一件事的边界（13000 年之后没有数据），
 * 两处**不重复表述**：这里说的是结论，那里说的是这个结论还没解决的缺口。
 */
const Takeaways = [
    "远古段 ΔT 可达数万秒，折成黄经数度，足以让一次交节挪到前一天",
    "交节时刻决定「这个月有没有中气」，因而直接决定闰月的位置",
    "本库跨 -9999 … 13500，1645 年《时宪历》前后的节气算法不能不分叉地反推"
] as const;

/** 资料清单：本项目里真实存在、且与这一页的结论直接相关的位置。 */
const Sources = [
    { title: "分层设计契约", source: "docs/design.md", note: "口径、表结构、换算关系的唯一来源" },
    { title: "数据表清单", source: "docs/table.md", note: "各表字段与行数的完整清单" },
    { title: "节气查询语句", source: "src/sql/climate.sql", note: "节气与物候的时刻查询" },
    { title: "朔望月原始历表", source: "calendar.xlsx", note: "24 个工作表，交节与合朔的原始值" }
] as const;
</script>

<template>
    <ChatPage
        channel="research"
        hint="研究按环节推进；资料范围限于本项目内的文档、历表与查询语句。">
        <!-- 开题之后，把选题卡片的位置让给证据；之前才显示它 -->
        <ChatPromptPanel
            v-if="!opened"
            :chat="chat"
            :items="ChatChannels.research.starters"
            title="研究选题"
            note="三条各落在不同的提问深度上；先选下面的深度，再点其中一条。" />

        <!-- 研究进度：环节 + 判据，不给假精确的百分比 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">
                研究进度
                <ElTag
                    :type="finished ? 'success' : 'primary'"
                    size="small"
                    effect="plain"
                    class="numeral">
                    {{ doneCount }} / {{ stages.length }} 步
                </ElTag>
            </h4>

            <ElSteps direction="vertical" :active="doneCount" :space="56" class="research-steps">
                <ElStep
                    v-for="(state, order) in stages"
                    :key="state.stage.id"
                    :title="state.stage.name"
                    :description="stageNote(order)"
                    :status="stepStatus(order)" />
            </ElSteps>

            <!-- 正在等回复：非打断式的就地提示，不弹窗、不抢焦点 -->
            <div v-if="chat.pending.value" class="research-running" aria-live="polite">
                <ChatTyping />
                <span class="xy-dim">正在核对材料，本页会自动更新，不用等着看</span>
            </div>

            <p class="xy-note">
                进度按**环节**计，不折算百分比：研究耗时不可预知，走得不线性的进度条
                会被读成「卡住了」。当前环节：<strong>{{
                    activeStage?.stage.name ?? "四步已走完"
                }}</strong>。
            </p>

            <p v-if="!opened" class="xy-note">
                还没开题。四个环节的判据分别是：提出课题、给出可核对的位置、
                找到两处**互相独立**的出处、给出带引用的结论。
            </p>

            <p v-else-if="!finished" class="xy-note">
                这一页与「新建对话」的区别不在排版：**探索阶段的不确定是正常的**。
                同一份材料可能一会儿支持、一会儿反证，那不是跑偏了，而是结论还没收敛。
                真卡住时右栏会多出「未决问题」一栏，而不是弹一个错误提示。
            </p>
        </section>

        <!-- 提问深度：这一档在问什么、要什么材料 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">提问深度</h4>

            <ElRadioGroup v-model="chat.depth.value" class="research-depths">
                <ElRadio
                    v-for="item in chat.depths.value"
                    :key="item.id"
                    :value="item.id"
                    class="research-depths__item">
                    <span class="research-depths__name">{{ item.name }}</span>
                    <span class="xy-dim">{{ item.question }}</span>
                </ElRadio>
            </ElRadioGroup>

            <p class="xy-note">
                这一档需要的材料：<strong>{{
                    chat.depths.value.find((item) => item.id === chat.depth.value)?.needs
                }}</strong>。深度选择目前**没有传给检索任务**——它只影响你怎么描述问题。
            </p>
        </section>

        <!-- 证据：按立场与置信度分档 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">
                证据
                <ElTag v-if="evidence.origins >= 2" type="success" size="small" effect="plain">
                    已交叉验证
                </ElTag>
                <ElTag v-else-if="evidence.citations > 0" type="warning" size="small" effect="plain">
                    单源
                </ElTag>
                <ElTag v-else type="info" size="small" effect="plain">尚未取数</ElTag>
            </h4>

            <ul v-if="evidence.citations > 0" class="research-tally">
                <li v-for="row in tallyRows" :key="row.label">
                    <ElIcon :size="14" :class="['research-tally__icon', row.className]">
                        <component :is="row.mark" />
                    </ElIcon>
                    <span class="research-tally__label">{{ row.label }}</span>
                    <span class="numeral">{{ row.count }}</span>
                </li>
            </ul>

            <ul v-if="origins.length > 0" class="research-origins">
                <li v-for="item in origins" :key="item.source" class="research-origins__item">
                    <div class="research-origins__head">
                        <span class="research-origins__title">{{ item.title }}</span>
                        <ElTag
                            v-if="item.stance"
                            :type="StanceLabels[item.stance].type"
                            size="small"
                            effect="plain">
                            {{ StanceLabels[item.stance].text }}
                        </ElTag>
                        <ElTooltip
                            v-if="item.confidence"
                            :content="ConfidenceLabels[item.confidence].note"
                            placement="left"
                            effect="light">
                            <span class="xy-dim numeral">
                                置信 {{ ConfidenceLabels[item.confidence].text }}
                            </span>
                        </ElTooltip>
                    </div>
                    <span class="xy-chip">{{ item.source }}</span>
                </li>
            </ul>

            <ElEmpty v-else description="还没有核对过的材料" :image-size="46" />

            <p class="xy-note">
                同一份文档引三次只算**一处**出处。独立出处才是交叉验证，
                多数几行引用不是。反证与支持一样列在这里：只列支持性材料时，
                「支持有三条」会被读成「这条结论很稳」。
            </p>
        </section>

        <!-- 否证条件：把可被推翻这件事摆在结论旁边 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">什么会推翻它</h4>

            <ul class="research-falsify">
                <li v-for="item in Disconfirming" :key="item.id" class="research-falsify__item">
                    <span class="research-falsify__text">{{ item.text }}</span>
                    <span class="xy-dim">→ {{ item.effect }}</span>
                </li>
            </ul>

            <p class="xy-note">
                这几条是**可判定的**：任一条成立，上面的结论就要改。
                「再多查一些资料」不在此列——它不是否证条件。
            </p>
        </section>

        <!-- 资料边界：查到什么、查不到什么 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">资料边界</h4>

            <p class="research-boundary__label">已覆盖</p>
            <ul class="research-boundary">
                <li v-for="item in Boundaries.covered" :key="item">{{ item }}</li>
            </ul>

            <p class="research-boundary__label is-uncovered">未覆盖</p>
            <ul class="research-boundary is-uncovered">
                <li v-for="item in Boundaries.uncovered" :key="item">{{ item }}</li>
            </ul>

            <p class="xy-note">
                范围外的部分不会出现在结论里，也不会出现在引用里——
                缺资料时页面宁可说「这里没有」，不拿相近的东西顶上。
            </p>
        </section>

        <!-- 未决问题：卡在哪里、影响什么 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">
                未决问题
                <ElTag type="warning" size="small" effect="plain" class="numeral">
                    {{ OpenQuestions.length }} 条
                </ElTag>
            </h4>

            <ul class="research-questions">
                <li v-for="item in OpenQuestions" :key="item.id" class="research-questions__item">
                    <span class="research-questions__text">{{ item.text }}</span>
                    <span class="xy-dim">卡在：{{ item.blockedBy }}</span>
                    <span class="xy-dim">影响：{{ item.impact }}</span>
                </li>
            </ul>

            <p class="xy-note">
                报告写出「还没有定论」不是保留，而是结论的一部分：
                掐掉这一栏，读者会把不确定当成确定。
            </p>
        </section>

        <!-- 读后自检：先答，依据收在折叠里 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">
                读后自检
                <ElTag type="info" size="small" effect="plain" class="numeral">
                    {{ revealedCount }} / {{ SelfChecks.length }}
                </ElTag>
            </h4>

            <ul class="research-checks">
                <li v-for="item in SelfChecks" :key="item.id" class="research-checks__item">
                    <button
                        type="button"
                        class="research-checks__question"
                        :aria-expanded="revealed[item.id] === true"
                        @click="toggleRevealed(item.id)">
                        <ElIcon :size="14" class="research-checks__mark">
                            <component
                                :is="
                                    revealed[item.id]
                                        ? resolveIconComponent('CircleCheckFilled')
                                        : checkIcon
                                " />
                        </ElIcon>
                        <span>{{ item.question }}</span>
                    </button>
                    <p
                        v-if="revealed[item.id]"
                        class="xy-note research-checks__answer"
                        aria-live="polite">
                        {{ item.evidence }}
                    </p>
                </li>
            </ul>

            <p class="xy-note">
                先自己答一遍再展开依据。直接读到答案时，人会把它当成正文的一部分略过；
                读完只花两成时间在正文上，能留下东西的恰恰是**答不上来的那几条**。
            </p>
        </section>

        <!-- 值得记住的三件事 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">值得记住的三件事</h4>

            <ol class="research-takeaways">
                <li v-for="item in Takeaways" :key="item">{{ item }}</li>
            </ol>

            <p class="xy-note">
                只有三句，且每句都能独立站住。需要第四句时，通常说明结论还没收敛。
            </p>
        </section>

        <!-- 资料清单 -->
        <section class="xy-panel">
            <h4 class="xy-panel-title">可用资料</h4>

            <ul class="research-sources">
                <li v-for="item in Sources" :key="item.source" class="research-sources__item">
                    <span class="research-sources__title">{{ item.title }}</span>
                    <span class="xy-chip">{{ item.source }}</span>
                    <span class="xy-dim">{{ item.note }}</span>
                </li>
            </ul>
        </section>
    </ChatPage>
</template>

<style scoped>
/* 环节：竖排步骤条，描述文字用小字，避免比标题还抢眼 */
.research-steps {
    margin-bottom: 4px;
}

.research-steps :deep(.el-step__title) {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.6;
}

.research-steps :deep(.el-step__description) {
    font-size: 12px;
    line-height: 1.7;
    padding-right: 4px;
}

/* 提问深度 */
.research-depths {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.research-depths__item {
    align-items: flex-start;
    display: flex;
    height: auto;
    margin-right: 0;
}

.research-depths__item :deep(.el-radio__label) {
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.5;
    white-space: normal;
}

.research-depths__name {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}

/* 证据计数 */
.research-tally {
    display: flex;
    flex-direction: column;
    gap: 6px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.research-tally li {
    align-items: center;
    display: flex;
    gap: 6px;
}

.research-tally__icon.is-support {
    color: var(--el-color-success);
}

.research-tally__icon.is-contradict {
    color: var(--el-color-danger);
}

.research-tally__icon.is-neutral {
    color: var(--el-text-color-placeholder);
}

.research-tally__label {
    color: var(--el-text-color-regular);
    flex: 1;
    font-size: 13px;
}

/* 出处清单 */
.research-origins {
    border-top: 1px dashed var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 10px 0 0;
    padding: 10px 0 0;
}

.research-origins__item {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.research-origins__head {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.research-origins__title {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}

/* 否证条件 */
.research-falsify {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.research-falsify__item {
    border-left: 2px solid var(--el-color-danger-light-5);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 8px;
}

.research-falsify__text {
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.7;
}

/* 资料边界 */
.research-boundary__label {
    color: var(--el-text-color-regular);
    font-size: 12px;
    font-weight: 600;
    margin: 0 0 4px;
}

.research-boundary__label.is-uncovered {
    margin-top: 12px;
}

.research-boundary {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.8;
    margin: 0;
    padding-left: 18px;
}

.research-boundary.is-uncovered li::marker {
    color: var(--el-color-warning);
}

/* 未决问题 */
.research-questions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.research-questions__item {
    border-left: 2px solid var(--el-color-warning-light-5);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: 8px;
}

.research-questions__text {
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.7;
}

/* 自检题 */
.research-checks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.research-checks__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.research-checks__question {
    align-items: flex-start;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    display: flex;
    font-family: inherit;
    font-size: 13px;
    gap: 6px;
    line-height: 1.7;
    padding: 8px 10px;
    text-align: left;
    transition:
        border-color 0.15s,
        background 0.15s;
    width: 100%;
}

.research-checks__question:hover {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-7);
}

.research-checks__question:focus-visible {
    border-color: var(--el-color-primary);
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 1px;
}

.research-checks__mark {
    color: var(--el-color-primary);
    flex-shrink: 0;
    margin-top: 4px;
}

.research-checks__answer {
    background: var(--el-fill-color-light);
    border-radius: 6px;
    margin: 0;
    padding: 8px 10px;
}

/* 值得记住的三件事 */
.research-takeaways {
    color: var(--el-text-color-regular);
    display: flex;
    flex-direction: column;
    font-size: 13px;
    gap: 8px;
    line-height: 1.8;
    margin: 0;
    padding-left: 20px;
}

.research-takeaways li::marker {
    color: var(--el-color-primary);
    font-variant-numeric: tabular-nums;
}

/* 资料清单 */
.research-sources {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.research-sources__item {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.research-sources__title {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}
</style>
