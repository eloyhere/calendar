/**
 * 对话 store：六个聊天模式共用的一份会话内存。
 *
 * ## 为什么不是 `defineEntityStore`
 *
 * `src/store/store.ts` 里的 `defineEntityStore` 是**读穿缓存**，它假设背后有一条
 * `service -> repository -> sqlite` 的链路，并且数据是构建期产物、运行期只读。
 * 对话两者都不成立：
 *
 * - 没有表（见 `src/entity/chat.ts` 的说明），没有 service / repository 可解析；
 * - 会话是**运行期写出来的**——用户发的每一条都要立刻进状态。
 *
 * 硬套那个工厂会得到一堆用不上的缓存语义，还得先编一个假的 service。
 * 所以本 store 是普通 Pinia setup store，只做三件事：持有会话与消息、
 * 按模式分组、提供增删改选。等对话的持久化方案定下来，**改动只落在本文件**：
 * 把 `ensureSeeded()` 换成 `await load()`，再给 `createSession()` 之类补一次
 * 落库调用即可，页面与组件不用动。
 *
 * ## 为什么状态挂在 store 而不是页面里
 *
 * 六个模式页是六条路由，来回切换会**卸载再重建**组件。会话状态若放在页面的
 * `ref` 里，切走再切回就全没了——而"接着上次说"正是对话页最基本的行为。
 * Pinia 的 store 活在应用级，所以切换路由不丢。
 *
 * ## 分模式隔离
 *
 * 每个模式有自己的会话列表（`sessionsOf`），互不串场：数据调研里贴过的查询口径
 * 不该出现在深度研究的左栏里。`activeIds` 也按模式各记一个，切回某个模式时
 * 停在它上次打开的那条会话上。
 *
 * ## 状态为什么长这样（一次踩坑记录）
 *
 * 三个状态（`sessions` / `messages` / `activeIds`）都要求**整体替换**
 * （`filter` / `map` / 展开），因为页面与组件读的是它们的快照。三条路都试过：
 *
 * 1. `ref<Record<string, ChatMessage[]>>(…)`：Pinia 会把 store 返回的 ref 做
 *    `UnwrapRef`，而 `UnwrapRef<Record<string, X>>` 在映射类型里**会丢掉字符串
 *    索引签名**，于是 `messages.value = {…}` 报「`X[]` 不能赋给 `Record<string, X[]>`」
 *    ——一个看起来毫无道理的错；
 * 2. 用 `shallowReactive` 直接持有数组 / 对象：类型干净了，但它们不是 ref，
 *    `const` 绑定的变量本身不能整体替换，报「Cannot assign to 'sessions' because
 *    it is a constant」；
 * 3. 把三样装进一个 `shallowReactive` 的对象：索引签名在类型推断里仍然会丢。
 *
 * 最终方案：状态收进一个 `shallowRef` 的对象（**它的类型就是 `{ value: ChatState }`，
 * Pinia 不做递归解包**），并在声明处标注 `ChatState`。读写都走 `state.value.*`，
 * 既不经过 `UnwrapRef`，也不是"给常量赋值"。
 */

import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";

import type {
    ChatChannel,
    ChatCitation,
    ChatMessage,
    ChatMessageKind,
    ChatSession,
    ChatSessionStatus,
    ChatTodo
} from "../entity/chat";
import { titleOf } from "../entity/chat";

/* -------------------------------------------------------------------------- */
/* 状态形状                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 可写状态。
 *
 * 单独写成一个接口而不是内联在 `shallowRef({…})` 里：内联时 `messages` 的
 * 索引签名会在类型推断中丢掉，`state.value.messages = {…}` 又会回到上面第 1 条的
 * 老错上。标注了目标类型，赋值才有可比对的形状。
 */
interface ChatState {
    /** 全部会话（所有模式混在一起，按模式过滤由 `sessionsOf` 负责） */
    sessions: ChatSession[];
    /** 全部消息，按会话 id 分组 */
    messages: Record<string, ChatMessage[]>;
    /** 每个模式当前打开的会话 id；`null` 表示停在"空会话"（还没开始聊） */
    activeIds: Partial<Record<ChatChannel, string | null>>;
}

/* -------------------------------------------------------------------------- */
/* 演示数据                                                                    */
/* -------------------------------------------------------------------------- */

/** 一分钟的毫秒数，演示数据里用来错开时间。 */
const Minute = 60_000;

/** 演示会话的固定起点：以"创建 store 的时刻"为基准往前推，避免写死日期。 */
const seededAt = Date.now();

/** 造一条消息。演示数据与运行期发文共用它，保证字段齐全。 */
function message(
    sessionId: string,
    role: ChatMessage["role"],
    text: string,
    options: {
        kind?: ChatMessageKind;
        citations?: readonly ChatCitation[];
        todos?: readonly ChatTodo[];
        time: number;
    }
): ChatMessage {
    return {
        id: crypto.randomUUID(),
        sessionId,
        role,
        kind: options.kind,
        text,
        citations: options.citations,
        todos: options.todos,
        time: options.time
    };
}

/**
 * 铺一批演示会话。
 *
 * 刻意铺在三个模式里（新建 / 历史 / 深度研究），这样左栏、消息流、引用与提纲
 * 四种渲染分支一进应用就都看得到；数据调研、思维碰撞、课题研究留空，
 * 用来展示各自的空态。真接上数据层后，这个函数与 `ensureSeeded()` 一并删掉。
 */
function seedDemoSessions(): { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> } {
    const sessions: ChatSession[] = [];
    const messages: Record<string, ChatMessage[]> = {};

    /** 把一组发言装进一条会话，省掉每处重复的 push。 */
    function pack(
        session: Omit<ChatSession, "messageCount">,
        lines: Array<ChatMessage>
    ): void {
        messages[session.id] = lines;
        sessions.push({ ...session, messageCount: lines.length });
    }

    /* ── 新建对话：一条刚聊完的短会话 ─────────────────────────────────────── */

    const createId = crypto.randomUUID();
    pack(
        {
            id: createId,
            channel: "create",
            title: "entity 与 store 的分工",
            summary: "分层约定、identity 为什么用 bigint",
            status: "idle",
            createdAt: seededAt - 6 * Minute,
            updatedAt: seededAt - 3 * Minute + 35_000
        },
        [
            message(createId, "user", "docs/design.md 里的分层约定，entity 与 store 各自管什么？", {
                time: seededAt - 6 * Minute
            }),
            message(
                createId,
                "assistant",
                "一句话分工：**entity 定形状，store 管状态**。\n\nentity 是一张表在内存里的样子（`src/entity/*.ts`），只有字段与类型，没有任何行为；store 是它的响应式容器与读穿缓存（`src/store/store.ts`），负责取数、缓存、以及 create / replace 这类本地改动。\n\n中间的 service 与 repository 都不进 entity——entity 不被任何一层 import，所以它可以同时被主进程与渲染进程使用，也不会因为换数据库而改。",
                { time: seededAt - 6 * Minute + 40_000 }
            ),
            message(createId, "user", "那 identity 为什么是 bigint 而不是 string？", {
                time: seededAt - 3 * Minute
            }),
            message(
                createId,
                "assistant",
                "因为 identity 就是 `temporal.absolute`，它是一个**全库递增的时间主键**（建元 -2696-03-11 起算的秒数），远古段的数值远超 2^53，用 number 会丢精度。\n\n但 store 的状态里必须没有 bigint（要能跨进程传递），所以 `serialize()` 把它转成十进制字符串，`identityOf()` 再转回来——这一进一出是 store 里唯一处理 bigint 的地方。",
                { time: seededAt - 3 * Minute + 35_000 }
            )
        ]
    );

    /* ── 历史对话：一条带引用与提纲的长会话 ──────────────────────────────── */

    const historyId = crypto.randomUUID();
    pack(
        {
            id: historyId,
            channel: "history",
            title: "节气与农历月的咬合",
            summary: "定朔、定气与无中气置闰",
            status: "idle",
            createdAt: seededAt - 27 * 60 * Minute,
            updatedAt: seededAt - 9 * 60 * Minute + 45_000
        },
        [
            message(historyId, "user", "节气和农历月是两套东西吗？", {
                time: seededAt - 27 * 60 * Minute
            }),
            message(
                historyId,
                "assistant",
                '是两套，但通过"中气"咬合在一起。\n\n节气按**太阳视黄经每 15°** 定（定气），是天文量；农历月按**合朔**定月首（定朔），是月相量。两者的周期（回归年 365.2422 日、朔望月 29.5306 日）不可通约，所以必须有一条规则把月份序列与节气序列对齐——那条规则就是"**中气落在哪个月，就定这个月是几月；没有中气的月为闰月**"。',
                { time: seededAt - 27 * 60 * Minute + 50_000 }
            ),
            message(historyId, "assistant", "顺着这条线，接下来要核三件事：", {
                kind: "todo",
                todos: [
                    { text: "定朔与定气的分歧起点（平气 → 定气）", done: true },
                    { text: "ΔT 在远古段的量级与折成黄经的度数", done: true },
                    { text: "建元 -2696-03-11 的文献依据", done: false }
                ],
                time: seededAt - 27 * 60 * Minute + 55_000
            }),
            message(
                historyId,
                "assistant",
                "定气的行用自 1645 年《时宪历》起（此前是平气）。本库跨公历 -9999 … 13500，**改历前后的节气时刻不能按同一套算法反推**。",
                { kind: "note", time: seededAt - 26 * 60 * Minute }
            ),
            message(historyId, "user", "那闰月是怎么统计出来的？", {
                time: seededAt - 9 * 60 * Minute
            }),
            message(
                historyId,
                "assistant",
                "按 `synodic_month` 表逐月判定：一个朔望月内若不含任何中气，该月即闰月。全库 290,654 条朔望月里，闰月与闰年都由这条规则现算，不另存字段。",
                {
                    kind: "citation",
                    citations: [
                        {
                            title: "数据来源与历史分期",
                            source: "docs/design.md §1.2",
                            note: "定气自 1645 年《时宪历》起行用"
                        },
                        {
                            title: "朔望月与月相",
                            source: "src/sql/synodic.sql",
                            note: "朔望月的查询语句"
                        }
                    ],
                    time: seededAt - 9 * 60 * Minute + 45_000
                }
            )
        ]
    );

    /* ── 历史对话：一条更早的会话，左栏才有"倒序"可看 ────────────────────── */

    const olderId = crypto.randomUUID();
    pack(
        {
            id: olderId,
            channel: "history",
            title: "跨库关联怎么记",
            summary: "不施外键，靠三处注释与合并库",
            status: "idle",
            createdAt: seededAt - 3 * 24 * 60 * Minute,
            updatedAt: seededAt - 3 * 24 * 60 * Minute + 60_000
        },
        [
            message(olderId, "user", "22 个分库怎么保证跨库关联不断？", {
                time: seededAt - 3 * 24 * 60 * Minute
            }),
            message(
                olderId,
                "assistant",
                "SQLite 不支持跨文件外键，所以各分库之间**不施加外键约束**，关联只记在三处：`docs/design.md` 的表格、各 `src/sql/<entity>.sql` 的表头注释、以及 `database/sql/<entity>/table.sql` 的表头注释。要跨实体查数时，用 `database/combine.py` 把分库合成全库 `src/sqlite/calendar.sqlite`（派生产物，可随时重建）。",
                { time: seededAt - 3 * 24 * 60 * Minute + 60_000 }
            )
        ]
    );

    /* ── 深度研究：一条问了一句的会话 ────────────────────────────────────── */

    const researchId = crypto.randomUUID();
    pack(
        {
            id: researchId,
            channel: "research",
            title: "ΔT 为什么不能略去",
            summary: "远古段数万秒，折成黄经数度，能挪动交节",
            status: "idle",
            createdAt: seededAt - 40 * Minute,
            updatedAt: seededAt - 40 * Minute + 70_000
        },
        [
            message(researchId, "user", "ΔT 在远古段为什么不能略去？", {
                time: seededAt - 40 * Minute
            }),
            message(
                researchId,
                "assistant",
                '因为它的量级足以改变结论。本库跨公历 -9999 … 13500，远古段 ΔT（TT − UT）可达数万秒，折成太阳黄经约数度——**足以让一次交节落在前一天**。节气时刻直接决定"这个月有没有中气"，也就直接决定闰月的位置，所以 ΔT 不是显示层的修饰，而是参与判定的量。',
                { time: seededAt - 40 * Minute + 70_000 }
            )
        ]
    );

    return { sessions, messages };
}

/* -------------------------------------------------------------------------- */
/* store                                                                       */
/* -------------------------------------------------------------------------- */

export const useChatStore = defineStore("chat", () => {
    /**
     * 可写状态。整体替换三样内容，所以用 `shallowRef` 装一个对象——
     * 理由见文件头「状态为什么长这样」。
     */
    const state = shallowRef<ChatState>({
        sessions: [],
        messages: {},
        activeIds: {}
    });

    /** 是否已铺过演示数据。 */
    const seeded = ref(false);

    /** 某个模式的会话，按最后活动时间倒序。 */
    function sessionsOf(channel: ChatChannel): ChatSession[] {
        return state.value.sessions
            .filter((session: ChatSession): boolean => session.channel === channel)
            .sort(
                (left: ChatSession, right: ChatSession): number => right.updatedAt - left.updatedAt
            );
    }

    /** 一条会话的消息，按时间正序（即写入顺序）。 */
    function messagesOf(sessionId: string | null): ChatMessage[] {
        return sessionId === null ? [] : (state.value.messages[sessionId] ?? []);
    }

    /** 某个模式当前打开的会话；没有则 `null`。 */
    function activeOf(channel: ChatChannel): ChatSession | null {
        const id = state.value.activeIds[channel] ?? null;
        if (id === null) {
            return null;
        }

        return (
            state.value.sessions.find((session: ChatSession): boolean => session.id === id) ?? null
        );
    }

    /**
     * 铺演示数据；已经铺过就什么都不做。
     *
     * 由页面在装配时调用，而不是在 store 定义里直接铺：store 的 setup 在第一次
     * `useChatStore()` 时执行，那时若直接写状态，"以后换成从库里读"就会变成一次
     * 异步改造。留一个显式的入口，将来把这里换成 `await load()` 即可。
     */
    function ensureSeeded(): void {
        if (seeded.value) {
            return;
        }
        const demo = seedDemoSessions();
        const activeIds: Partial<Record<ChatChannel, string | null>> = {};
        // 演示数据里每个模式"最近聊过"的那条即当前会话，页面一进来就有内容可看
        for (const session of demo.sessions) {
            if (activeIds[session.channel] === undefined) {
                activeIds[session.channel] = session.id;
            }
        }
        state.value = { sessions: demo.sessions, messages: demo.messages, activeIds };
        seeded.value = true;
    }

    /** 新建一条空会话并设为当前；返回它。 */
    function createSession(channel: ChatChannel, seed = "新对话"): ChatSession {
        const now = Date.now();
        const session: ChatSession = {
            id: crypto.randomUUID(),
            channel,
            title: seed,
            summary: "还没有发言",
            status: "idle",
            createdAt: now,
            updatedAt: now,
            messageCount: 0
        };
        state.value = {
            sessions: [session, ...state.value.sessions],
            messages: { ...state.value.messages, [session.id]: [] },
            activeIds: { ...state.value.activeIds, [channel]: session.id }
        };

        return session;
    }

    /** 打开一条会话；`null` 表示退到空会话（不新建）。 */
    function selectSession(channel: ChatChannel, id: string | null): void {
        state.value = {
            ...state.value,
            activeIds: { ...state.value.activeIds, [channel]: id }
        };
    }

    /** 删除一条会话；删的是当前会话时，回到该模式最近的一条。 */
    function removeSession(id: string): void {
        const target = state.value.sessions.find(
            (session: ChatSession): boolean => session.id === id
        );
        if (target === undefined) {
            return;
        }

        const messages = { ...state.value.messages };
        delete messages[id];

        const activeIds = { ...state.value.activeIds };
        if (activeIds[target.channel] === id) {
            const rest = state.value.sessions.filter(
                (session: ChatSession): boolean => session.id !== id && session.channel === target.channel
            );
            const next = rest.sort(
                (left: ChatSession, right: ChatSession): number => right.updatedAt - left.updatedAt
            )[0];
            activeIds[target.channel] = next?.id ?? null;
        }

        state.value = {
            sessions: state.value.sessions.filter(
                (session: ChatSession): boolean => session.id !== id
            ),
            messages,
            activeIds
        };
    }

    /** 重命名一条会话。 */
    function renameSession(id: string, title: string): void {
        state.value = {
            ...state.value,
            sessions: state.value.sessions.map(
                (session: ChatSession): ChatSession =>
                    session.id === id ? { ...session, title } : session
            )
        };
    }

    /**
     * 追加一条消息，顺带维护会话的标题、摘要、计数与活动时间。
     *
     * 标题只在**首条发言**时由发言内容生成（`titleOf`）——之后用户改过标题也不该
     * 被下一句话覆盖，左栏的条目才能稳定下来。
     */
    function appendMessage(input: {
        sessionId: string;
        role: ChatMessage["role"];
        text: string;
        kind?: ChatMessageKind;
        citations?: readonly ChatCitation[];
        todos?: readonly ChatTodo[];
    }): ChatMessage {
        const now = Date.now();
        const entry: ChatMessage = message(input.sessionId, input.role, input.text, {
            kind: input.kind,
            citations: input.citations,
            todos: input.todos,
            time: now
        });

        const list = state.value.messages[input.sessionId] ?? [];

        state.value = {
            ...state.value,
            messages: { ...state.value.messages, [input.sessionId]: [...list, entry] },
            sessions: state.value.sessions.map((session: ChatSession): ChatSession => {
                if (session.id !== input.sessionId) {
                    return session;
                }
                const isFirst = session.messageCount === 0;

                return {
                    ...session,
                    title: isFirst ? titleOf(input.text) : session.title,
                    summary: isFirst ? input.text.slice(0, 40) : session.summary,
                    messageCount: session.messageCount + 1,
                    updatedAt: now,
                    status: input.role === "user" ? "replying" : "idle"
                };
            })
        };

        return entry;
    }

    /** 改会话状态（发送时置"正在回复"，占位回复落地后清掉）。 */
    function setStatus(id: string, status: ChatSessionStatus): void {
        state.value = {
            ...state.value,
            sessions: state.value.sessions.map(
                (session: ChatSession): ChatSession =>
                    session.id === id ? { ...session, status } : session
            )
        };
    }

    /** 会话总数。 */
    const total = computed((): number => state.value.sessions.length);

    /** 消息总数。 */
    const messageTotal = computed((): number =>
        Object.values(state.value.messages).reduce(
            (sum: number, list: ChatMessage[]): number => sum + list.length,
            0
        )
    );

    return {
        state,
        seeded,
        total,
        messageTotal,
        sessionsOf,
        messagesOf,
        activeOf,
        ensureSeeded,
        createSession,
        selectSession,
        removeSession,
        renameSession,
        appendMessage,
        setStatus
    };
});
