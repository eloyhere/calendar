/**
 * 对话历史缓存：把会话与消息存到 `localStorage`，刷新与重启都还在。
 *
 * ## 为什么缓存放在 store 这一层
 *
 * `docs/design.md` 的链路是 `UI -> entity -> store -> service -> repository -> sqlite`。
 * 对话**没有对应的表**（见 `src/entity/chat.ts` 的说明），所以它不能像其余实体那样
 * 走 service / repository 落到 sqlite。但"关掉应用再打开，上次聊的还在"是对话页的
 * 基本预期，不能等表结构定下来再做。
 *
 * 于是持久化落在 store 这一层：store 持有内存状态，本文件负责把它投影成一份可存
 * 的快照再写回。**将来对话有表了，替换的只是本文件**——把 `readCache()` 换成
 * `sqlite` 查询、`schedule()` 换成一次落库调用即可，store 的读写接口与页面都不用动。
 *
 * ## 为什么直接用 localStorage 而不是 IPC + 主进程文件
 *
 * 同一个应用里已经有先例：`src/state/use-workflow.ts` 把工作流步骤存在
 * `localStorage`（键 `calendar.workflow.steps.v1`）。对话与工作流是同一类东西——
 * 都是用户在界面里编出来的、与历表数据无关的本地状态。两者用同一套机制，
 * 排错时只需要记住一条规则。
 *
 * 这条路径依赖 `main/window.ts` 用自定义协议（`app://`）装载页面：那样页面有正常
 * 来源，`localStorage` 才可用；换回 `file://` 会退化。`use-workflow.ts` 里
 * 已经写明这一点，这里不再重复解释。
 *
 * ## 快照的形状：会话表与消息表分开
 *
 * `sessions` 与 `messages` 分开存（而不是把消息塞进每条会话里）有三个好处：
 *
 * 1. **加载便宜**：左栏只需要 `sessions`，不必为了列标题把全部消息解析一遍；
 * 2. **淘汰便宜**：超出保留上限时按会话整条丢弃，不必在嵌套结构里挑挑拣拣；
 * 3. **将来好换**：真接上 sqlite 时，这正是两张表的样子。
 *
 * 三张表用同一把键存成**一个 JSON**，而不是三把键：一次读写、一次版本判断，
 * 也不会出现"会话写进去了、消息没写进去"的半截状态。
 *
 * ## 坏数据与超限一律当作没有
 *
 * 解析失败、版本不符、结构不对，一律返回"没有缓存"并让调用方重新开始——
 * 页面上出现半截状态比丢掉一次历史更难排查。写入失败（配额满、隐私模式）也不抛错，
 * 只是这次没存上，由 `ChatCacheWrite.lastWriteAt` 反映出来。
 */

import type { ChatChannel, ChatMessage, ChatSession } from "../entity/chat";

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 存储键。
 *
 * 与 `use-workflow.ts` 同一命名法：`calendar.<域>.<东西>.v<版本>`。
 * 版本变了就当旧数据不存在，不做迁移——对话是本地临时内容，迁移代码的维护成本
 * 高于让用户重开一条会话。真要保留，改 `ChatCacheVersion` 并在 `read()` 里按
 * 旧版本号分支解析即可。
 */
const StorageKey = "calendar.chat.history.v1";

/** 快照格式版本，与存储键里的版本号同步改。 */
const CacheVersion = 1;

/** 每个模式最多保留的会话数；按最后活动时间倒序，超出的丢掉最旧的。 */
export const CacheSessionLimit = 50;

/** 每个模式最多保留的消息条数；按会话整体丢弃，不会只丢半条会话。 */
export const CacheMessageLimit = 400;

/** 单个模式的对话缓存（`sessions` 与 `messages` 是两张表，见文件头说明）。 */
interface ChannelCache {
    sessions: ChatSession[];
    messages: Record<string, ChatMessage[]>;
}

/** 快照根结构。 */
interface ChatCachePayload {
    version: number;
    /** 写入时刻（毫秒时间戳），用于"缓存于多久之前" */
    savedAt: number;
    /** 每个模式一份；缺键表示那个模式还没有缓存 */
    channels: Partial<Record<ChatChannel, ChannelCache>>;
    /** 每个模式上次打开的会话 id */
    activeIds: Partial<Record<ChatChannel, string | null>>;
}

/** 读缓存的结果。 */
export interface ChatCacheRead {
    /** 快照；`null` 表示没有可用缓存 */
    payload: ChatCachePayload | null;
    /**
     * 读取结果说明。
     *
     * `empty` 与 `corrupt` 分开：前者是第一次用，属正常；后者说明存过但坏了，
     * 值得在控制台留一句，否则"历史莫名没了"永远查不出原因。
     */
    status: "hit" | "empty" | "corrupt";
}

/** 写缓存的结果，供 store 记录最近一次落盘情况。 */
export interface ChatCacheWrite {
    /** 是否写成功 */
    ok: boolean;
    /** 写入时刻（毫秒时间戳）；失败时是本次尝试的时刻 */
    at: number;
    /** 失败原因，成功时为 `null` */
    error: string | null;
    /** 快照的字节数（UTF-16 码元数），用于判断是否接近配额 */
    bytes: number;
}

/** 缓存规模统计，右栏展示用。 */
export interface ChatCacheStats {
    /** 缓存里的会话总数 */
    sessions: number;
    /** 缓存里的消息总数 */
    messages: number;
    /** 快照字节数；没有缓存时为 0 */
    bytes: number;
    /** 快照写入时刻；没有缓存时为 `null` */
    savedAt: number | null;
}

/* -------------------------------------------------------------------------- */
/* 校验                                                                        */
/* -------------------------------------------------------------------------- */

/** 是不是字符串数组里的某个值。 */
function isChannel(value: unknown, list: readonly string[]): value is string {
    return typeof value === "string" && list.includes(value);
}

/** 逐字段校验一条会话；字段缺了或类型不对就当这条不存在。 */
function isSession(value: unknown): value is ChatSession {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const item = value as Record<string, unknown>;

    return (
        typeof item.id === "string" &&
        typeof item.channel === "string" &&
        typeof item.title === "string" &&
        typeof item.summary === "string" &&
        typeof item.status === "string" &&
        typeof item.createdAt === "number" &&
        typeof item.updatedAt === "number" &&
        typeof item.messageCount === "number"
    );
}

/** 逐字段校验一条消息；`citations` / `todos` 只检查是不是数组，内容由渲染层兜。 */
function isMessage(value: unknown): value is ChatMessage {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const item = value as Record<string, unknown>;

    return (
        typeof item.id === "string" &&
        typeof item.sessionId === "string" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.text === "string" &&
        typeof item.time === "number" &&
        (item.citations === undefined || Array.isArray(item.citations)) &&
        (item.todos === undefined || Array.isArray(item.todos))
    );
}

/**
 * 校验并规整一个模式的分片。
 *
 * 两步都做：**先按会话表建白名单**，再只收白名单里的消息。这样即使快照里混进了
 * 没有归属的消息（上一次写入写了一半、或手工改过存储），也不会渲染出一条
 * 谁都认领不了的发言。
 */
function parseChannel(value: unknown, channels: readonly string[]): ChannelCache | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const item = value as Record<string, unknown>;
    const sessions = Array.isArray(item.sessions)
        ? item.sessions.filter(isSession).filter((one) => isChannel(one.channel, channels))
        : [];
    if (sessions.length === 0) {
        return null;
    }

    const known = new Set(sessions.map((session) => session.id));
    const messages: Record<string, ChatMessage[]> = {};
    const rawMessages =
        typeof item.messages === "object" && item.messages !== null
            ? (item.messages as Record<string, unknown>)
            : {};

    for (const [sessionId, list] of Object.entries(rawMessages)) {
        if (!known.has(sessionId) || !Array.isArray(list)) {
            continue;
        }
        const entries = list.filter(isMessage);
        if (entries.length > 0) {
            messages[sessionId] = entries;
        }
    }

    // 会话表里的条数以内层数组为准重算：快照里的 messageCount 可能是上一版写的，
    // 也可能因为只保留最近若干条而不再等于数组长度
    return {
        sessions: sessions.map((session): ChatSession => {
            return { ...session, messageCount: messages[session.id]?.length ?? 0 };
        }),
        messages
    };
}

/* -------------------------------------------------------------------------- */
/* 读写                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 读缓存。
 *
 * 任何异常都折叠成 `empty`：`localStorage` 在某些环境下连读都会抛
 * （隐私模式、被策略禁用），而"读不到缓存"和"第一次用"对调用方是一回事。
 */
export function readChatCache(channels: readonly ChatChannel[]): ChatCacheRead {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(StorageKey);
    } catch {
        return { payload: null, status: "empty" };
    }
    if (raw === null || raw.length === 0) {
        return { payload: null, status: "empty" };
    }

    let parsed: unknown = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { payload: null, status: "corrupt" };
    }
    if (typeof parsed !== "object" || parsed === null) {
        return { payload: null, status: "corrupt" };
    }

    const root = parsed as Record<string, unknown>;
    if (root.version !== CacheVersion) {
        return { payload: null, status: "corrupt" };
    }

    const rawChannels =
        typeof root.channels === "object" && root.channels !== null
            ? (root.channels as Record<string, unknown>)
            : {};
    const bag: Partial<Record<ChatChannel, ChannelCache>> = {};
    for (const channel of channels) {
        const piece = parseChannel(rawChannels[channel], channels);
        if (piece !== null) {
            bag[channel] = piece;
        }
    }
    if (Object.keys(bag).length === 0) {
        return { payload: null, status: "empty" };
    }

    const rawActive =
        typeof root.activeIds === "object" && root.activeIds !== null
            ? (root.activeIds as Record<string, unknown>)
            : {};
    const activeIds: Partial<Record<ChatChannel, string | null>> = {};
    for (const channel of channels) {
        const value = rawActive[channel];
        if (value === null || typeof value === "string") {
            activeIds[channel] = value;
        }
    }

    return {
        payload: {
            version: CacheVersion,
            savedAt: typeof root.savedAt === "number" ? root.savedAt : Date.now(),
            channels: bag,
            activeIds
        },
        status: "hit"
    };
}

/**
 * 按保留上限做 LRU 淘汰。
 *
 * 先按最后活动时间倒序取前 `CacheSessionLimit` 条，再从最旧的开始丢，直到消息
 * 总数不超 `CacheMessageLimit`。**按会话整条丢**，不做"只留最近 N 条消息"——
 * 一条会话被截掉开头之后，文不对题（第一条往往是提问），读的人会以为是错的。
 *
 * 返回新对象，不改入参：调用方拿到的是可以直接写进状态的快照。
 */
export function capChannel(channel: ChannelCache): ChannelCache {
    const ordered = channel.sessions
        .slice()
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, CacheSessionLimit);

    const kept: ChatSession[] = [];
    let count = 0;
    for (const session of ordered) {
        const size = channel.messages[session.id]?.length ?? 0;
        if (kept.length > 0 && count + size > CacheMessageLimit) {
            break;
        }
        kept.push(session);
        count += size;
    }

    const messages: Record<string, ChatMessage[]> = {};
    for (const session of kept) {
        const list = channel.messages[session.id];
        if (list !== undefined) {
            messages[session.id] = list;
        }
    }

    return { sessions: kept, messages };
}

/**
 * 写缓存。
 *
 * `bytes` 取 `JSON.stringify` 结果的 `length`：localStorage 按 UTF-16 码元计费
 * （多数实现的上限约 5 MB 码元），用码元数而不是字节数才对得上配额。
 */
export function writeChatCache(payload: ChatCachePayload): ChatCacheWrite {
    const at = Date.now();
    const snapshot: ChatCachePayload = { ...payload, version: CacheVersion, savedAt: at };

    let text = "";
    try {
        text = JSON.stringify(snapshot);
    } catch (error) {
        return {
            ok: false,
            at,
            error: error instanceof Error ? error.message : String(error),
            bytes: 0
        };
    }

    try {
        localStorage.setItem(StorageKey, text);
    } catch (error) {
        // 配额满是最常见的失败：不清掉旧数据的话，之后每次写都会失败
        return {
            ok: false,
            at,
            error: error instanceof Error ? error.message : String(error),
            bytes: text.length
        };
    }

    return { ok: true, at, error: null, bytes: text.length };
}

/** 删掉缓存。返回是否真的删掉了（本来就没有时也算成功）。 */
export function clearChatCache(): boolean {
    try {
        localStorage.removeItem(StorageKey);
        return true;
    } catch {
        return false;
    }
}

/** 当前缓存的规模；读不出来时全为零。 */
export function chatCacheStats(channels: readonly ChatChannel[]): ChatCacheStats {
    const { payload } = readChatCache(channels);
    if (payload === null) {
        return { sessions: 0, messages: 0, bytes: 0, savedAt: null };
    }

    let sessions = 0;
    let messages = 0;
    for (const channel of channels) {
        const piece = payload.channels[channel];
        if (piece === undefined) {
            continue;
        }
        sessions += piece.sessions.length;
        messages += Object.values(piece.messages).reduce(
            (sum: number, list: ChatMessage[]): number => sum + list.length,
            0
        );
    }

    let bytes = 0;
    try {
        bytes = localStorage.getItem(StorageKey)?.length ?? 0;
    } catch {
        bytes = 0;
    }

    return { sessions, messages, bytes, savedAt: payload.savedAt };
}
