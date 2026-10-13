/**
 * 对话 store：五个聊天模式共用的一份会话，**带本地历史缓存**。
 *
 * ## 三件事
 *
 * 1. **持有状态**：会话、消息、每个模式当前打开的会话；
 * 2. **分组**：每个模式只看自己的会话（`sessionsOf`），互不串场——数据调研里贴过的
 *    查询口径不该出现在深度研究的左栏里；
 * 3. **缓存**：每次改动都落到 `localStorage`（经由 `src/store/chat.cache.ts`），
 *    刷新与重启之后历史还在。启动时**先读缓存，读不到才铺演示数据**。
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
 * 它的缓存语义在这里也用不上：对话要的不是"读过就别再读"，而是"改过就别丢"。
 * 所以本 store 是普通 Pinia setup store，缓存由 `chat.cache.ts` 提供，且是
 * **写入式**的（写状态即写缓存），不设 TTL、不设失效钩子。
 *
 * ## 为什么状态挂在 store 而不是页面里
 *
 * 五个模式页是五条路由，来回切换会**卸载再重建**组件。会话状态若放在页面的
 * `ref` 里，切走再切回就全没了——而"接着上次说"正是对话页最基本的行为。
 * 加上缓存之后，这一条从"切路由不丢"扩展到"关掉应用也不丢"。
 *
 * ## 两个模式之外的状态
 *
 * - `hydrated`：是否已经把缓存读进来过。**每次进入对话页都会调 `ensureReady()`**，
 *   它必须只生效一次，否则用户新建的会话会被下一次读缓存覆盖掉；
 * - `lastWrite`：最近一次落盘的结果。写失败（配额满、隐私模式）不抛错、不打断
 *   对话，但要在界面上看得出来——不然"历史又没了"没法解释。
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

import { computed, onScopeDispose, ref, shallowRef } from "vue";
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
import type { ChatCacheStats, ChatCacheWrite } from "./chat.cache";
import {
    capChannel,
    chatCacheStats,
    clearChatCache,
    readChatCache,
    writeChatCache
} from "./chat.cache";

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 五个模式的清单。
 *
 * 缓存读写、按模式分组、`activeIds` 的键都要用它，所以在这里显式列一份。
 * 类型上它必须与 `ChatChannel` 完全一致——`satisfies` 会在少一个或多一个时直接报错。
 */
const Channels = [
    "create",
    "research",
    "survey",
    "thought",
    "topic"
] as const satisfies readonly ChatChannel[];

/**
 * 落盘防抖时长（毫秒）。
 *
 * 一次发送会产生两次状态改动（用户发言入列、回复落地），流式接入后更是每个分片
 * 一次。逐次 `JSON.stringify` 整个快照是纯浪费，所以要合并。取 400：短到用户
 * 关窗口前基本一定写完，长到能把一段连续操作并成一次。
 *
 * `onScopeDispose` 里会强制落盘，所以"关掉窗口"不会丢掉最后一次改动。
 */
const PersistDelay = 400;

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
 * 刻意铺在两个模式里（新建 / 深度研究），这样左栏与消息流一进应用就有内容可看，
 * 引用分支也看得到；数据调研、思维碰撞、课题研究留空，用来展示各自的空态
 * （`todo` 提纲分支要发一条消息才出现，见 `use-chat-page.ts` 的 `stubKind`）。
 *
 * **只在缓存为空时铺**（见 `ensureReady()`）：用过一次之后历史从缓存里读，
 * 演示数据不再出现。清空缓存后会重新铺一次，这对"第一次打开应用"是合适的。
 */
function seedDemoSessions(): { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> } {
    const sessions: ChatSession[] = [];
    const messages: Record<string, ChatMessage[]> = {};

    /** 把一组发言装进一条会话，省掉每处重复的 push。 */
    function pack(session: Omit<ChatSession, "messageCount">, lines: Array<ChatMessage>): void {
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
                {
                    // 三条**刻意取两种立场**：两条支持、一条反证。深度研究页的
                    // 「证据」面板按立场分开计数，只给同向材料的话反证那一行永远是零，
                    // 页面会显得缺一半——而真实研究里"找到了反证"本身就是要写出来的结论。
                    citations: [
                        {
                            title: "时间坐标系与建元",
                            source: "docs/design.md §2",
                            note: "absolute 为全表统一的时间主键；交节时刻决定「有无中气」",
                            stance: "support",
                            confidence: "high"
                        },
                        {
                            title: "节气表与物候",
                            source: "src/sql/climate.sql",
                            note: "节气、物候的时刻查询语句，交节时刻取自这里",
                            stance: "support",
                            confidence: "high"
                        },
                        {
                            title: "朔望月原始历表",
                            source: "calendar.xlsx",
                            note: "远古段只覆盖到 -9999，1912 年前 ΔT 的取值本身仍按外推，没有第二条来源可比对",
                            stance: "contradict",
                            confidence: "low"
                        }
                    ],
                    time: seededAt - 40 * Minute + 70_000
                }
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

    /** 是否已经把缓存读进来过（读过一次就不再读，免得覆盖用户刚建的会话）。 */
    const hydrated = ref(false);

    /** 本地缓存里有没有历史（启动时读到的、或刚刚写下去的）。 */
    const cached = ref(false);

    /** 最近一次落盘的结果；还没写过时为 `null`。 */
    const lastWrite = ref<ChatCacheWrite | null>(null);

    /** 落盘防抖句柄。 */
    let persistTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * 把当前状态投影成缓存分片，顺带按保留上限淘汰。
     *
     * 淘汰在**写**的时候做，不在读的时候做：读路径只负责还原，多一步判断就多一处
     * 出错的地方；而写在一次会话里只发生几次，代价可以忽略。
     */
    function snapshot(): Partial<Record<ChatChannel, { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> }>> {
        const bag: Partial<
            Record<ChatChannel, { sessions: ChatSession[]; messages: Record<string, ChatMessage[]> }>
        > = {};

        for (const channel of Channels) {
            const sessions = state.value.sessions.filter(
                (session: ChatSession): boolean => session.channel === channel
            );
            if (sessions.length === 0) {
                continue;
            }
            const messages: Record<string, ChatMessage[]> = {};
            for (const session of sessions) {
                messages[session.id] = state.value.messages[session.id] ?? [];
            }
            bag[channel] = capChannel({ sessions, messages });
        }

        return bag;
    }

    /**
     * 立刻落盘（不等防抖）。
     *
     * 三个入口：`persist()` 的定时器到点、组件作用域销毁、用户点「清空缓存」之后。
     */
    function flush(): void {
        if (persistTimer !== null) {
            clearTimeout(persistTimer);
            persistTimer = null;
        }

        const result = writeChatCache({
            version: 1,
            savedAt: Date.now(),
            channels: snapshot(),
            activeIds: state.value.activeIds
        });

        lastWrite.value = result;
        cached.value = result.ok || cached.value;
    }

    /** 安排一次落盘；连续改动合并成一次写。 */
    function persist(): void {
        if (persistTimer !== null) {
            clearTimeout(persistTimer);
        }
        persistTimer = setTimeout(flush, PersistDelay);
    }

    /**
     * 丢掉缓存里超限的部分。
     *
     * `capChannel()` 已经在写的时候限过额，所以这一步通常是空操作；留着它是为了
     * 处理另一种情况：**缓存是旧版本写的**（那时上限更宽），读进来之后要就地瘦身，
     * 否则一个启动周期内内存里一直顶着一份超限的历史。
     */
    function prune(): void {
        const next: Partial<Record<ChatChannel, boolean>> = {};
        let changed = false;
        const sessions: ChatSession[] = [];
        const messages: Record<string, ChatMessage[]> = { ...state.value.messages };

        for (const channel of Channels) {
            const own = state.value.sessions.filter(
                (session: ChatSession): boolean => session.channel === channel
            );
            const messagesOfChannel: Record<string, ChatMessage[]> = {};
            for (const session of own) {
                messagesOfChannel[session.id] = state.value.messages[session.id] ?? [];
            }
            const capped = capChannel({ sessions: own, messages: messagesOfChannel });
            next[channel] = true;
            if (capped.sessions.length !== own.length) {
                changed = true;
                for (const session of own) {
                    if (!capped.messages[session.id] && capped.sessions.every((one) => one.id !== session.id)) {
                        delete messages[session.id];
                    }
                }
            }
            sessions.push(...capped.sessions);
        }

        if (changed) {
            state.value = { ...state.value, sessions, messages };
        }
    }

    /**
     * 读缓存并还原状态；已经在内存里的会话不会被覆盖。
     *
     * **合并而不是替换**：`ensureReady()` 每次进对话页都会调一次，若第二次进来时
     * 直接把缓存盖上去，用户这一轮新建的会话就没了。合并规则按 id 去重，内存里的
     * 版本优先（它更新）。
     */
    function restore(): void {
        const { payload, status } = readChatCache(Channels);

        if (status === "corrupt") {
            // 存过但坏了：说一句就够，页面上按"没有历史"处理
            console.warn("[chat.store] 对话缓存无法解析，已忽略；下一次写入会覆盖它");
            clearChatCache();
            return;
        }
        if (payload === null) {
            return;
        }

        const sessions = [...state.value.sessions];
        const messages = { ...state.value.messages };
        const known = new Set(sessions.map((session) => session.id));

        for (const channel of Channels) {
            const piece = payload.channels[channel];
            if (piece === undefined) {
                continue;
            }
            for (const session of piece.sessions) {
                if (known.has(session.id)) {
                    continue;
                }
                known.add(session.id);
                sessions.push(session);
                messages[session.id] = piece.messages[session.id] ?? [];
            }
        }

        /**
         * `replying` 一律归零。
         *
         * 这个状态表示"正在等一条回复"，而回复只活在进程内存里（是个定时器）。
         * 上次关窗口时没落地的回复，这次启动永远不会来——留着它，输入框会被
         * 永久禁用（`sendable` 看的就是它）。**这是缓存必须做的一步规整。**
         */
        const activeIds = { ...payload.activeIds, ...state.value.activeIds };
        state.value = {
            sessions: sessions.map((session: ChatSession): ChatSession =>
                session.status === "replying" ? { ...session, status: "idle" } : session
            ),
            messages,
            activeIds
        };
        cached.value = true;
        prune();
    }

    /**
     * 准备就绪：先读缓存，读不到才铺演示数据。
     *
     * 这是**唯一的入口**，由 `useChatPage()` 在装配时调用。它必须幂等：第二次进来
     * 只做一次 `restore()` 的判断就返回，不重复铺演示数据，也不覆盖用户的新会话。
     */
    function ensureReady(): void {
        if (hydrated.value) {
            return;
        }
        hydrated.value = true;

        restore();
        if (state.value.sessions.length === 0) {
            seedDemo();
        }
    }

    /** 铺演示数据并把每个模式的当前会话定到最近一条。 */
    function seedDemo(): void {
        const demo = seedDemoSessions();
        const activeIds: Partial<Record<ChatChannel, string | null>> = { ...state.value.activeIds };
        for (const session of demo.sessions) {
            if (activeIds[session.channel] === undefined) {
                activeIds[session.channel] = session.id;
            }
        }
        state.value = { sessions: demo.sessions, messages: demo.messages, activeIds };
        persist();
    }

    /**
     * 清空历史缓存与内存里的全部会话。
     *
     * 先 `clearChatCache()` 再改状态：反过来的话，改状态触发的防抖写入会立刻把
     * 刚清掉的东西又存回去。
     */
    function clearHistory(): void {
        clearChatCache();
        if (persistTimer !== null) {
            clearTimeout(persistTimer);
            persistTimer = null;
        }
        state.value = { sessions: [], messages: {}, activeIds: {} };
        cached.value = false;
        lastWrite.value = null;
    }

    /** 缓存规模；右栏展示用。 */
    function stats(): ChatCacheStats {
        return chatCacheStats(Channels);
    }

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
     * 新建一条空会话并设为当前；返回它。
     */
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
        persist();

        return session;
    }

    /**
     * 打开一条会话；`null` 表示退到空会话（不新建）。
     *
     * 也要落盘：`activeIds` 是缓存的一部分，"上次停在哪条会话"重启后要能接着停在那儿。
     */
    function selectSession(channel: ChatChannel, id: string | null): void {
        state.value = {
            ...state.value,
            activeIds: { ...state.value.activeIds, [channel]: id }
        };
        persist();
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
                (session: ChatSession): boolean =>
                    session.id !== id && session.channel === target.channel
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
        persist();
    }

    /** 重命名一条会话。 */
    function renameSession(id: string, title: string): void {
        state.value = {
            ...state.value,
            sessions: state.value.sessions.map((session: ChatSession): ChatSession =>
                session.id === id ? { ...session, title } : session
            )
        };
        persist();
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
        persist();

        return entry;
    }

    /**
     * 改会话状态（发送时置"正在回复"，占位回复落地后清掉）。
     *
     * 也要落盘，而且**下一次读缓存时会被强制归零**（见 `restore()`）：这个状态
     * 依赖一个内存里的定时器，重启后不可能恢复。写它只是为了同一进程内切路由时
     * 三点动画不丢。
     */
    function setStatus(id: string, status: ChatSessionStatus): void {
        state.value = {
            ...state.value,
            sessions: state.value.sessions.map((session: ChatSession): ChatSession =>
                session.id === id ? { ...session, status } : session
            )
        };
        persist();
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

    /**
     * 作用域销毁时强制落盘。
     *
     * 防抖意味着最后一次改动可能还等在定时器里；Pinia 的 setup store 建在应用级的
     * effectScope 上，这个钩子在窗口关掉时执行。`flush()` 本身不抛错
     * （写失败只记进 `lastWrite`），所以这里不需要再包一层。
     */
    onScopeDispose(flush);

    return {
        state,
        hydrated,
        cached,
        lastWrite,
        total,
        messageTotal,
        sessionsOf,
        messagesOf,
        activeOf,
        ensureReady,
        clearHistory,
        stats,
        flush,
        createSession,
        selectSession,
        removeSession,
        renameSession,
        appendMessage,
        setStatus
    };
});
