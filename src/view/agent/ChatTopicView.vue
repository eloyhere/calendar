<script setup lang="ts">
/**
 * 智能体 · 课题研究
 *
 * 围绕指定课题检索资料并生成分析。
 *
 * ## 与「深度研究」的分工
 *
 * 两页都会检索资料，但输入不同：
 *
 * - **深度研究**：从一个**问题**出发（"ΔT 为什么不能略去"），过程是探索性的，
 *   所以那一页的右栏显示研究环节的推进；
 * - **课题研究**：从一个**命名好的课题**出发（"二十四节气的定气算法"），
 *   过程是收敛的——先把课题拆成提纲，再逐条填依据，所以这一页的右栏显示
 *   **提纲模板与产出格式**。
 *
 * 换句话说：一个是"我不知道答案"，一个是"我知道要写什么，只差材料"。
 *
 * ## 产出格式为什么可选
 *
 * 同一个课题，交提纲和交报告是两种活。先把格式选出来，检索的粒度才定得下来
 * ——要报告就得逐条给依据，只要提纲则先要骨架。这个选择目前只存在界面上，
 * 没有传给任何后端（后端还没接）。
 */

import { computed, ref } from "vue";

import { ChatChannels } from "../../entity/chat";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";
import ChatPromptPanel from "./chat/ChatPromptPanel.vue";

/** 本模式的对话状态。 */
const chat = useChatPage("topic");

/** 课题名；用户可改，改完只影响这一页显示什么。 */
const topic = ref("二十四节气的定气算法");

/** 产出格式。 */
const format = ref("outline");

/** 三种产出格式及其说明。 */
const Formats = [
    { value: "outline", label: "提纲", note: "先要骨架：分几节、每节答什么" },
    { value: "summary", label: "摘要", note: "一页之内给出结论与关键依据" },
    { value: "report", label: "完整报告", note: "逐条给依据与出处，可核对" }
] as const;

/** 当前格式的说明。 */
const formatNote = computed(
    (): string => Formats.find((item) => item.value === format.value)?.note ?? ""
);

/**
 * 提纲模板。
 *
 * 四节是历法类课题的通用骨架：**规则**（怎么算）、**数据**（拿什么算）、
 * **分歧**（各家口径不一致之处）、**未决**（本项目还没解决的）。第三节最有价值
 * ——分歧点往往就是课题的答案所在，也是本项目注释写得最多的地方。
 */
const Outline = [
    { name: "规则", note: "课题涉及的历法规则与判据" },
    { name: "数据", note: "落在哪几个分库、哪几张表" },
    { name: "分歧", note: "各家口径不一致之处，以及本项目的取法" },
    { name: "未决", note: "本项目尚未解决的问题，逐条列出" }
] as const;
</script>

<template>
    <ChatPage
        channel="topic"
        hint="先定课题与产出格式，再检索；提纲模板见右栏，第三节「分歧」通常最有价值。">
        <section class="xy-panel">
            <h4 class="xy-panel-title">课题</h4>

            <ElInput v-model="topic" size="small" placeholder="输入课题名称" class="topic-name" />

            <ElRadioGroup v-model="format" class="topic-formats">
                <ElRadio v-for="item in Formats" :key="item.value" :value="item.value">
                    {{ item.label }}
                </ElRadio>
            </ElRadioGroup>

            <p class="xy-note">{{ formatNote }}</p>
            <p class="xy-note">
                课题名与格式**还没有传给任何后端**（对话尚未接入），
                现在只影响这一页显示什么。
            </p>
        </section>

        <section class="xy-panel">
            <h4 class="xy-panel-title">提纲模板</h4>

            <ol class="topic-outline">
                <li v-for="(item, order) in Outline" :key="item.name" class="topic-outline__item">
                    <span class="topic-outline__order numeral">{{ order + 1 }}</span>
                    <div class="topic-outline__body">
                        <span class="topic-outline__name">{{ item.name }}</span>
                        <span class="xy-dim">{{ item.note }}</span>
                    </div>
                </li>
            </ol>

            <p class="xy-note">
                模板固定四节，课题不同只改每节的内容。**先把四节填满再谈结论**，
                比直接要一份报告更容易发现缺材料的地方。
            </p>
        </section>

        <ChatPromptPanel
            :chat="chat"
            :items="ChatChannels.topic.starters"
            title="课题示例"
            note="点一下即以此为题开一条会话。" />
    </ChatPage>
</template>

<style scoped>
.topic-name {
    margin-bottom: 10px;
}

.topic-formats {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.topic-outline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.topic-outline__item {
    align-items: flex-start;
    display: flex;
    gap: 8px;
}

.topic-outline__order {
    background: var(--el-fill-color);
    border-radius: 50%;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    font-size: 11px;
    height: 18px;
    line-height: 18px;
    text-align: center;
    width: 18px;
}

.topic-outline__body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.topic-outline__name {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}
</style>
