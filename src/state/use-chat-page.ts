/**
 * 对话页的组合式逻辑：一条会话从"打字"到"回复"的全过程。
 *
 * ## 它替六个模式页解决了什么
 *
 * 六个模式页共用同一套行为（新建会话 → 发一条 → 等回复 → 切会话 → 删会话），
 * 差异只在**回复内容**。若把这段逻辑抄进六个 `.vue`，任何一处改动（比如加"停止
 * 生成"、改成流式）都要改六遍，且必然漏掉一两个。
 *
 * 因此这里按模式参数化：页面调一次 `useChatPage("research")`，拿到的就是
 * 这个模式的会话、消息、草稿与动作。页面只负责渲染，不持有状态。
 *
 * ## 现状：回复是占位的
 *
 * 后端未接，所以 `send()` 之后由 `createStubLoader()`（`src/state/use-page-state.ts`）
 * 延迟返回一段**与项目内容对得上的**示例回复，让消息流、引用、提纲三种渲染
 * 都看得到效果。改用同一套 loader 而不是裸 `setTimeout`，是为了让"接入点"只有
 * 一个形状：等真接口就位，把 `stubReply()` 换成 `() => service.reply(...)` 即可，
 * 页面与消息结构都不用动。
 *
 * 这也是为什么回复内容是**按项目主题手写的常量**而非随机文案：占位阶段它同时
 * 充当"这一页将来长什么样"的说明书，随机串会让审阅的人以为已经接上了。
 *
 * ## 定时器为什么必须收
 *
 * 回复延迟期间用户可能已经切到别的路由，组件卸载后 `setTimeout` 仍会回调，
 * 于是往一个已卸载页面里写状态。所以句柄存在闭包变量里，`onBeforeUnmount`
 * 一律清掉——只有最后一个未落地的回复会因此丢掉，用户在切页前看不到它，
 * 无副作用。
 */

import { computed, onBeforeUnmount, ref } from "vue";
import type { ComputedRef } from "vue";

import type { ChatChannel, ChatChannelInfo, ChatCitation, ChatMessage, ChatSession } from "../entity/chat";
import { ChatChannels } from "../entity/chat";
import type { ResearchDepth, ResearchDepthId } from "../entity/research";
import { ResearchDepths } from "../entity/research";
import { createStubLoader } from "../state/use-page-state";
import { useChatStore } from "../store/chat.store";

/* -------------------------------------------------------------------------- */
/* 占位回复                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 占位回复的等待时长（毫秒）。
 *
 * 取 700：短到不烦人，长到能看清"正在输入"的三点动画——那个状态本身就是要给人
 * 看的。真接口就位后这个常量与 `stubReply()` 一并删掉。
 */
const ReplyDelay = 700;

/** 各模式的占位回复正文，按轮次交替取用。 */
const StubReplies: Record<ChatChannel, readonly string[]> = {
    create: [
        "收到。这条链路目前只到界面为止：会话与消息都由 `src/store/chat.store.ts` 在内存里持有，还没有对应的表。\n\n要接着往下做，缺的是三样：会话落在哪一层（复用 `temporal` 的时间主键，还是另起一张表）、消息的正文存不存全文、以及历史会话的检索口径。",
        "补一句口径上的事：`docs/design.md` 要求**先改文档再改代码**。所以这三样定下来之后，第一步是往 design.md 的 §3 表格里加一行，而不是先动 `src/entity/chat.ts`。"
    ],
    history: [
        "这条会话之前的结论是：节气与农历月是两套量，靠「中气落在哪个月就定这个月是几月、无中气之月为闰月」这条规则咬合。\n\n继续往下推的话，建议先定「改历前后的算法要不要分叉」——本库跨 -9999 … 13500，1645 年《时宪历》改用定气，之前的平气不能用同一套反推。",
        "这条会话里引用的两份材料都还在库里，出处如下。"
    ],
    research: [
        "查了三处口径，结论一致：ΔT 在远古段可达数万秒，折成太阳黄经约数度，足以让一次交节挪到前一天。而交节时刻直接决定「这个月有没有中气」，也就直接决定闰月的位置——所以它参与判定，不是显示层的修饰。\n\n**置信度：高。** 两处独立出处（口径文档与节气查询语句）一致；反证只有一条，指的是 1912 年前 ΔT 取值本身仍按外推，见右栏「未决问题」的第一条。\n\n下一步建议把 ΔT 的分段多项式与本库的年份区间逐段对齐，看哪几段是外推。",
        "这个结论依赖的材料按立场列在下面：前两条支持，第三条是反证。\n\n反证不影响「要不要算 ΔT」，只影响「算得准不准」——两者不要混成一条结论。"
    ],
    survey: [
        "按 22 个分库逐表 COUNT(*) 的结果，行数分布极不均衡：`temporal`（6,943,509）与 `climate`（1,743,926）两张表占了全库的七成以上，而 `chronology`、`astronomy`、`gregory`、`jupiter`、`natural`、`tree`、`tropical` 这几张当前是零行。\n\n零行不是错误，是「数据源缺失」或「换算法则待实现」——界面要说清原因，不要弹红色提示。",
        "把这次调研拆成三步："
    ],
    thought: [
        "先反问你一句：你说「绕」，绕的是**层的数量**，还是**层与层之间的边界**？\n\n如果是数量——`UI -> entity -> store -> service -> repository -> sqlite` 六层看着多，但每层只回答一个问题，且都是单向依赖，读的时候其实可以跳着看。\n\n如果是边界，那更值得聊：`entity` 为什么不被任何一层 import、`store` 为什么只调 `service` 而不碰 `repository`，这两条才是这套分层的承重点。",
        "再追一句：如果把这六层压成三层，你会在哪里切？切完之后，`generate_datasource.py` 那种代码生成还放得下吗？"
    ],
    topic: [
        "课题：二十四节气的定气算法。先立提纲，再逐条落依据。",
        "这个课题的结论依赖三份材料，其中第一份是口径、后两份是数值来源。"
    ]
};

/** 引用来源：轮次为 `citation` 时附上。 */
const StubCitations: Record<ChatChannel, readonly ChatCitation[]> = {
    create: [],
    history: [
        {
            title: "数据来源与历史分期",
            source: "docs/design.md §1.2",
            note: "定气自 1645 年《时宪历》起行用"
        },
        {
            title: "时间单位与朔望月",
            source: "docs/design.md §4",
            note: "元会运世的换算，朔望月为最底层单位"
        }
    ],
    research: [
        {
            title: "时间坐标系与建元",
            source: "docs/design.md §2",
            note: "absolute 为全表统一的时间主键；建元当天为第 1 日",
            stance: "support",
            confidence: "high",
            elapsedSeconds: 0
        },
        {
            title: "节气表与物候",
            source: "src/sql/climate.sql",
            note: "节气、物候的时刻查询语句，交节时刻取自这里",
            stance: "support",
            confidence: "high",
            elapsedSeconds: 0
        },
        {
            title: "朔望月原始历表",
            source: "calendar.xlsx",
            note: "远古段只覆盖到 -9999，再往前没有可比对的第二条来源，1912 年前 ΔT 亦为外推",
            stance: "contradict",
            confidence: "low",
            elapsedSeconds: 0
        }
    ],
    survey: [],
    thought: [],
    topic: [
        {
            title: "分层设计契约",
            source: "docs/design.md",
            note: "各层职责与文件布局的唯一约定来源"
        },
        {
            title: "数据访问层",
            source: "src/datasource/climate.sqlite.ts",
            note: "12 条标准查询语句的镜像实现"
        }
    ]
};

/** 提纲：轮次为 `todo` 时附上。 */
const StubTodos: Record<ChatChannel, readonly { text: string; done: boolean }[]> = {
    create: [],
    history: [],
    research: [],
    survey: [
        { text: "按分库统计行数并排序", done: true },
        { text: "标出零行的表与原因", done: true },
        { text: "核对是否有重复或乱序", done: false }
    ],
    thought: [],
    topic: [
        { text: "定气与平气的分界（1645 年《时宪历》）", done: true },
        { text: "太阳视黄经每 15° 的判据与实现", done: false },
        { text: "与朔望月的咬合：无中气置闰", done: false }
    ]
};

/* -------------------------------------------------------------------------- */
/* 组合式                                                                      */
/* -------------------------------------------------------------------------- */

/** `useChatPage` 的返回值。 */
export interface ChatPageApi {
    /** 模式常量：标题、图标、占位文案、开场白 */
    info: ComputedRef<ChatChannelInfo>;
    /** 本模式的会话列表，按最后活动时间倒序 */
    sessions: ComputedRef<ChatSession[]>;
    /** 当前打开的会话；停在空会话时为 `null` */
    active: ComputedRef<ChatSession | null>;
    /** 当前会话的消息，按时间正序 */
    messages: ComputedRef<ChatMessage[]>;
    /** 输入框内容（`v-model`） */
    draft: ReturnType<typeof ref<string>>;
    /**
     * 提问深度（`v-model`）。
     *
     * 只有深度研究模式有可选项（见 `depths`），其余模式这个值不会被读到，
     * 页面也不渲染选择器。放在这里而不是页面里，是因为它**属于这次提问**
     * 而不是"我怎么打字"——将来它会作为参数进检索任务。
     */
    depth: ReturnType<typeof ref<ResearchDepthId>>;
    /** 该模式可选的提问深度；空数组表示这个模式不分档 */
    depths: ComputedRef<readonly ResearchDepth[]>;
    /** 助手是否正在回复：显示三点动画、并禁用发送按钮 */
    pending: ComputedRef<boolean>;
    /** 是否允许发送：草稿非空且没有在等回复 */
    sendable: ComputedRef<boolean>;
    /** 发送当前草稿 */
    send: () => void;
    /** 用一条开场白直接发出去 */
    sendStarter: (text: string) => void;
    /** 新建一条会话 */
    startSession: () => void;
    /** 打开一条会话 */
    openSession: (id: string) => void;
    /** 删除一条会话 */
    dropSession: (id: string) => void;
}

/**
 * 给一个模式装配对话状态。
 *
 * @param channel 模式标识，取值见 `src/entity/chat.ts` 的 `ChatChannel`
 *
 * @example
 * ```ts
 * const chat = useChatPage("research");
 * ```
 */
export function useChatPage(channel: ChatChannel): ChatPageApi {
    const store = useChatStore();
    store.ensureSeeded();

    const info = computed((): ChatChannelInfo => ChatChannels[channel]);
    const sessions = computed((): ChatSession[] => store.sessionsOf(channel));
    const active = computed((): ChatSession | null => store.activeOf(channel));
    const messages = computed((): ChatMessage[] => store.messagesOf(active.value?.id ?? null));

    const draft = ref("");

    /**
     * 提问深度，默认"解释"。
     *
     * 默认取第二档而不是第一档：落到"定位"上会让助手只回一条记录，用户要的
     * 通常不止于此；而默认落到"综合"又会把范围撑得过大。第二档是多数人心里
     * 那个"说清楚为什么"的位置，改档只需一次点击。
     */
    const depth = ref<ResearchDepthId>("explain");

    /** 只有深度研究模式有分档；其余模式给空数组，页面据此不渲染选择器。 */
    const depths = computed((): readonly ResearchDepth[] =>
        channel === "research" ? ResearchDepths : []
    );

    /** 正在等的占位回复；`null` 表示没有未落地的回复。 */
    let timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * 按轮次给出这一条占位回复的形态。
     *
     * 轮次（`turn`）从 0 起：同一会话里连问两次拿到两段不同的回复、甚至是不同形态
     * （一次带引用、一次带提纲），而不是复读同一句——占位阶段最容易被看穿的破绽
     * 就是"不管问什么答得都一样"。
     */
    function stubKind(turn: number): ChatMessage["kind"] {
        const kinds: Record<ChatChannel, Array<ChatMessage["kind"]>> = {
            create: ["text", "note"],
            history: ["text", "citation"],
            research: ["text", "citation"],
            survey: ["text", "todo"],
            thought: ["text", "text"],
            topic: ["todo", "citation"]
        };
        const list = kinds[channel];

        return list[turn % list.length];
    }

    /**
     * 是否在等回复。
     *
     * 判据是"会话状态为 `replying` **且**最后一条来自用户"：只看状态的话，用户
     * 发了又删、或回复落地后状态没来得及清，动画会一直转下去；两个条件一起看，
     * 状态与消息流不一致时以消息流为准。
     */
    const pending = computed((): boolean => {
        if (active.value?.status !== "replying") {
            return false;
        }

        return messages.value.at(-1)?.role === "user";
    });

    const sendable = computed((): boolean => draft.value.trim().length > 0 && !pending.value);

    /** 清掉在等的占位回复。 */
    function cancelPending(): void {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    }

    onBeforeUnmount(cancelPending);

    /**
     * 把一段文本作为用户发言发出，并排一条占位回复。
     *
     * 会话不存在时**自动新建一条**：用户在空会话里直接打字是最常见的入口，
     * 让他先去点"新建"是多余的一步。
     */
    function submit(text: string): void {
        const content = text.trim();
        if (content.length === 0) {
            return;
        }

        const session = active.value ?? store.createSession(channel, "新对话");
        store.appendMessage({ sessionId: session.id, role: "user", text: content });

        // 轮次取"这条用户发言是第几条"：同一会话里连问两次拿到两段不同的回复
        const turn = Math.max(Math.floor(store.messagesOf(session.id).length / 2) - 1, 0);
        const kind = stubKind(turn);
        const reply = StubReplies[channel][turn % StubReplies[channel].length] ?? "";
        const citations = kind === "citation" ? StubCitations[channel] : undefined;
        const todos = kind === "todo" ? StubTodos[channel] : undefined;

        cancelPending();
        void createStubLoader([reply], ReplyDelay)().then((): void => {
            timer = null;
            // 会话可能在等待期间被删掉：那时不复核就会写进一条孤儿消息
            if (store.state.messages[session.id] === undefined) {
                return;
            }
            store.appendMessage({
                sessionId: session.id,
                role: "assistant",
                text: reply,
                kind,
                citations,
                todos
            });
        });
    }

    return {
        info,
        sessions,
        active,
        messages,
        draft,
        depth,
        depths,
        pending,
        sendable,
        send: (): void => {
            submit(draft.value);
            draft.value = "";
        },
        sendStarter: (text: string): void => {
            submit(text);
        },
        startSession: (): void => {
            cancelPending();
            store.createSession(channel, "新对话");
            draft.value = "";
        },
        openSession: (id: string): void => {
            cancelPending();
            store.selectSession(channel, id);
        },
        dropSession: (id: string): void => {
            cancelPending();
            store.removeSession(id);
        }
    };
}
