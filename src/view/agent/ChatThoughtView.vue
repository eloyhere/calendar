<script setup lang="ts">
/**
 * 智能体 · 思维碰撞
 *
 * 助手向你提问，帮你梳理和拓展思考链路。
 *
 * ## 这一页与其余五个模式反过来
 *
 * 别的模式是"我问、助手答"，这一页是**助手问、我答**。所以界面要回答的不是
 * "查到什么了"，而是"问到哪一步了、还差哪一问"：
 *
 * - **当前这一问**：把正在问的那句话单独摆在右栏顶部，配"换一问"与"就答这一问"。
 *   人被打断思路时最需要的是"问题还在那儿"，而不是翻回聊天记录里找；
 * - **提问链路**：四个类型按顺序推进（澄清 → 反例 → 边界 → 后果），
 *   当前停在那一类标出来。这是把"苏格拉底式追问"落成看得见的进度。
 *
 * 四个类型不是装饰：它们是**可迁移的追问法**，用熟之后不必再靠助手提问。
 */

import { computed, ref } from "vue";

import { ChatChannels } from "../../entity/chat";
import { useChatPage } from "../../state/use-chat-page";
import ChatPage from "./chat/ChatPage.vue";
import ChatPromptPanel from "./chat/ChatPromptPanel.vue";

/** 本模式的对话状态。 */
const chat = useChatPage("thought");

/**
 * 四种追问及其问法。
 *
 * 每一类给两句（`asks`）：用户答完一句之后换同类里的另一句继续追——重复问同一句
 * 会让人以为程序卡住了。
 */
const Chains = [
    {
        name: "澄清",
        note: "先把话说准：你指的是哪一件事",
        asks: [
            "你说的「绕」，具体是指层的数量，还是层与层之间的边界？",
            "这件事里，哪一个词是你自己也没想清楚的？"
        ]
    },
    {
        name: "反例",
        note: "找一条与结论相反的事实",
        asks: [
            "有没有哪一层是**可以不要**的？去掉它，哪个用例会先坏？",
            "如果这套分层是错的，你最可能在哪一处先看到症状？"
        ]
    },
    {
        name: "边界",
        note: "划出它成立与不成立的分界",
        asks: [
            "这套做法在哪种规模下开始不成立？一万行，还是十亿行？",
            "哪一部分是**这个项目特有**的，换一个项目就不成立？"
        ]
    },
    {
        name: "后果",
        note: "顺着结论往下推一步",
        asks: [
            "照这个结论做下去，半年后你最可能后悔的是哪一步？",
            "如果明天就要交付，你会先砍掉哪一部分？"
        ]
    }
] as const;

/** 当前问到第几类：用户每答一句就往前走一格。 */
const stageIndex = computed((): number => {
    const rounds = chat.messages.value.filter((entry) => entry.role === "user").length;

    return Math.min(rounds, Chains.length - 1);
});

/** 同一类里的第几句问法。 */
const askIndex = ref(0);

/** 当前这一问。 */
const currentAsk = computed((): string => {
    const chain = Chains[stageIndex.value];

    return chain.asks[askIndex.value % chain.asks.length] ?? "";
});

/** 换一问：同类里的下一句，填进输入框让用户改完再发。 */
function nextAsk(): void {
    askIndex.value += 1;
    chat.draft.value = currentAsk.value;
}
</script>

<template>
    <ChatPage
        channel="thought"
        hint="这一页由助手提问、你来回答；四个追问类型见右栏，答完一类自动进入下一类。">
        <section class="xy-panel">
            <h4 class="xy-panel-title">当前这一问</h4>

            <blockquote class="thought-ask">{{ currentAsk }}</blockquote>

            <div class="thought-ask__actions">
                <ElButton size="small" plain @click="nextAsk">
                    <ElIcon><Refresh /></ElIcon>
                    <span>换一问</span>
                </ElButton>
                <ElButton size="small" type="primary" @click="chat.sendStarter(currentAsk)">
                    就答这一问
                </ElButton>
            </div>

            <p class="xy-note">
                「就答这一问」把这句话作为你的发言直接发出去；「换一问」只把它填进输入框，
                你可以改完再发。
            </p>
        </section>

        <section class="xy-panel">
            <h4 class="xy-panel-title">提问链路</h4>

            <ol class="thought-chain">
                <li
                    v-for="(chain, order) in Chains"
                    :key="chain.name"
                    :class="[
                        'thought-chain__item',
                        { 'is-current': order === stageIndex, 'is-done': order < stageIndex }
                    ]">
                    <span class="thought-chain__order numeral">{{ order + 1 }}</span>
                    <div class="thought-chain__body">
                        <span class="thought-chain__name">{{ chain.name }}</span>
                        <span class="xy-dim">{{ chain.note }}</span>
                    </div>
                </li>
            </ol>

            <p class="xy-note">
                这四类是**可迁移的追问法**：澄清、反例、边界、后果。用熟之后不必再靠助手
                提问，自己就能沿着这条链路把一件事想透。
            </p>
        </section>

        <ChatPromptPanel
            :chat="chat"
            :items="ChatChannels.thought.starters"
            title="换个角度"
            note="不想被追问时，直接抛一个还没想清楚的问题也行。" />
    </ChatPage>
</template>

<style scoped>
.thought-ask {
    background: var(--el-color-primary-light-9);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 0 6px 6px 0;
    color: var(--el-text-color-primary);
    font-size: 14px;
    line-height: 1.7;
    margin: 0;
    padding: 10px 12px;
}

.thought-ask__actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}

.thought-chain {
    display: flex;
    flex-direction: column;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.thought-chain__item {
    align-items: flex-start;
    display: flex;
    gap: 8px;
    opacity: 0.55;
}

.thought-chain__item.is-current,
.thought-chain__item.is-done {
    opacity: 1;
}

.thought-chain__order {
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

.thought-chain__item.is-current .thought-chain__order {
    background: var(--el-color-primary);
    color: #fff;
}

.thought-chain__item.is-done .thought-chain__order {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
}

.thought-chain__body {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.thought-chain__name {
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 600;
}
</style>
