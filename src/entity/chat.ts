/**
 * 对话域模型：一条会话、一条消息、一个模式。
 *
 * ## 为什么单独有一份模型，而不直接写进页面
 *
 * 会话与消息要被**三处**同时读到：
 *
 * 1. 五个模式页（新建 / 深度研究 / 数据调研 / 思维碰撞 / 课题研究）；
 * 2. 左侧会话列表与中间消息流（两个组件，分处不同文件）；
 * 3. store——它要在模式之间共享同一份数据。
 *
 * 类型写在页面里，这三处就会各写一份结构相同的 `interface`，改字段时漏掉一处
 * 是迟早的事。所以模型归 `src/entity/`，页面与组件只做渲染。
 *
 * ## 与数据层的关系
 *
 * `docs/design.md` 的链路是 `UI -> entity -> store -> service -> repository -> sqlite`，
 * 每一层对应一个实体表。**对话目前没有对应的表**：会话是这次运行里产生的，
 * 还没有持久化方案（落在哪一层、是否复用 `temporal` 的时间主键，都未定）。
 *
 * 因此本实体先只定义形状，由 `src/store/chat.store.ts` 用内存数据填充。
 * 等表结构定下来，改动只落在 store 一层：本文件加 `identity` / `start` / `end`
 * 三个字段（与其余实体一致，见 `src/entity/entity.ts`），页面与组件不用动。
 */

import type { IconName } from "../plugin/icons";
import type { CitationConfidence, CitationStance } from "./research";

/* -------------------------------------------------------------------------- */
/* 模式                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 五个聊天模式。与路由表 `plugin/router.ts` 里的五条子路由一一对应。
 *
 * 做成联合类型而不是 `string`：模式是会话的**归属键**，写错一个字母就会让某条
 * 会话在任何页面上都查不到（列表空白，且不报错）。收成字面量联合后，`vue-tsc`
 * 会在赋值点直接报出来。
 */
export type ChatChannel = "create" | "research" | "survey" | "thought" | "topic";

/** 模式的静态说明：标题、图标、占位文案、开场白。 */
export interface ChatChannelInfo {
    /** 模式名，与路由 `meta.title` 一致 */
    title: string;
    /** 图标名，取值来自 `src/plugin/icons.ts` 的白名单 */
    icon: IconName;
    /** 一句话说明，页面不再各写一遍 */
    description: string;
    /** 输入框占位文案 */
    placeholder: string;
    /** 开场提示：空会话时列在消息流里的那几条可点选题 */
    starters: readonly string[];
}

/**
 * 五个模式的登记表。
 *
 * **这是模式的唯一来源**：页面标题、图标、占位文案、开场白全部取自这里，
 * 五个模式页因此只描述"我这一页比共用壳多了什么"，不再重复这些字段。
 *
 * 键的顺序即菜单顺序（与路由表一致）。
 */
export const ChatChannels: Record<ChatChannel, ChatChannelInfo> = {
    create: {
        title: "新建对话",
        icon: "ChatDotRound",
        description: "与助手自由对话，快速开始任务",
        placeholder: "说点什么，开始一个任务……",
        starters: [
            "把 docs/design.md 的分层约定讲清楚",
            "列出 22 个分库与各自的表",
            "这条链路里 entity 与 store 的分工是什么"
        ]
    },
    research: {
        title: "深度研究",
        icon: "Search",
        description: "检索可信资料，深入分析课题并生成报告",
        placeholder: "输入要研究的课题……",
        /**
         * 三条开场白各落在**不同的提问深度**上（见 `src/entity/research.ts`）：
         * 第一条问"从哪一次改历开始"（应用），第二条问"为什么不能略去"（解释），
         * 第三条问"是怎么定出来的"（综合）。并列摆开时，用户能直接看出这一页
         * 与"查一条记录"的区别——不是格式上的区别，是问题本身的层次。
         */
        starters: [
            "定朔与定气的分歧从哪一次改历开始",
            "ΔT 在远古段为什么不能略去",
            "建元 -2696-03-11 是怎么定出来的"
        ]
    },
    survey: {
        title: "数据调研",
        icon: "TrendCharts",
        description: "查找相关数据，建立统计模型并输出分析结果",
        placeholder: "描述要调研的数据口径……",
        starters: [
            "统计各分库的行数占比",
            "闰月在 290,654 条朔望月里占多少",
            "哪几张表当前是零行，为什么"
        ]
    },
    thought: {
        title: "思维碰撞",
        icon: "Promotion",
        description: "助手向你提问，帮你梳理和拓展思考链路",
        placeholder: "抛出一个还没想清楚的问题……",
        starters: [
            "我为什么总觉得历法分层太绕",
            "对话适合落在哪一层",
            "找一个我一直没想明白的地方问我"
        ]
    },
    topic: {
        title: "课题研究",
        icon: "Collection",
        description: "围绕指定课题检索资料并生成分析",
        placeholder: "输入课题名称……",
        starters: [
            "课题：二十四节气的定气算法",
            "课题：干支纪日的连续性与改历",
            "课题：朔望月的长度分布"
        ]
    }
};

/* -------------------------------------------------------------------------- */
/* 消息                                                                        */
/* -------------------------------------------------------------------------- */

/** 消息的发出方。 */
export type ChatRole = "user" | "assistant";

/**
 * 消息形态。
 *
 * - `text`：普通发言；
 * - `note`：助手的一句说明（例如"这条链路还没接"），渲染成灰底小字，
 *   与正文区分开；
 * - `citation`：引用来源，渲染成可点的资料条目；
 * - `todo`：待办 / 提纲，渲染成勾选列表。
 *
 * 预留 `tool` / `chart` 两种形态：数据调研要贴查询结果，深度研究要贴工具调用，
 * 接入时只加渲染分支，不动消息结构。
 */
export type ChatMessageKind = "text" | "note" | "citation" | "todo";

/**
 * 一条引用来源。
 *
 * ## 为什么引用要带立场与置信度
 *
 * 消息上的引用最初只有"标题 + 位置 + 一句话"。深度研究页把它当证据用之后，
 * 缺两个字段就会出两类问题：
 *
 * 1. 只列**支持**结论的材料——这正是确认偏误的界面版本。用户看到三条同向
 *    证据，会读成"这条结论很稳"。所以 `stance` 要能取 `contradict`，
 *    让反证在版面上与支持证据一样显眼；
 * 2. 不写**有多确定**，读的人只能默认"就是确定"。而本项目大量结论依赖口径
 *    （哪一段用平气、哪一段用定气），只给一处出处的材料本就只能算中等置信。
 *    所以 `confidence` 三档必写在卡片上，缺省按"中"计。
 *
 * 两个字段都可选：课题研究里的引用是"顺着这条线可以去哪儿看"，
 * 不是待评估的证据，那时不标立场是恰当的。
 *
 * 形状本身（`CitationStance` / `CitationConfidence` 的取值与文案）归
 * `src/entity/research.ts`，因为它们是深度研究这一套方法的词汇。
 */
export interface ChatCitation {
    /** 出处标题 */
    title: string;
    /** 出处位置，例如 `docs/design.md §3` */
    source: string;
    /** 一句话说明这份材料支持了什么 */
    note?: string;
    /** 相对结论的立场：支持 / 反证 / 口径。缺省视为"口径" */
    stance?: CitationStance;
    /** 置信度：高 / 中 / 低。缺省视为"中" */
    confidence?: CitationConfidence;
    /** 取证耗时（秒）；0 或缺省表示构建期就已入库，没有查询耗时 */
    elapsedSeconds?: number;
}

/** 一条待办 / 提纲项。 */
export interface ChatTodo {
    /** 条目正文 */
    text: string;
    /** 是否已完成 */
    done: boolean;
}

/** 一条消息。 */
export interface ChatMessage {
    /** 会话内唯一标识，`crypto.randomUUID()` */
    id: string;
    /** 会话标识，与 `ChatSession.id` 对应 */
    sessionId: string;
    /** 发出方 */
    role: ChatRole;
    /** 形态，缺省 `text` */
    kind?: ChatMessageKind;
    /** 正文；`citation` / `todo` 形态下另作别用（见各自字段） */
    text: string;
    /** 引用来源，`kind === "citation"` 时使用 */
    citations?: readonly ChatCitation[];
    /** 提纲 / 待办，`kind === "todo"` 时使用 */
    todos?: readonly ChatTodo[];
    /** 发出时刻（毫秒时间戳），列表与气泡上显示 */
    time: number;
}

/* -------------------------------------------------------------------------- */
/* 会话                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 会话状态。
 *
 * `replying` 是**消息流自己的状态**而不是"会话属性"：它由 `send()` 置位、
 * 由占位回复落地时清掉，只影响渲染成"正在输入"。放进会话里是为了让左栏能同时
 * 显示哪个会话在等回复。真接上后端后它应当改由流式事件驱动。
 */
export type ChatSessionStatus = "idle" | "replying" | "done";

/** 一条会话。 */
export interface ChatSession {
    /** 会话唯一标识，`crypto.randomUUID()` */
    id: string;
    /** 属于哪个模式；左栏只列当前模式的会话 */
    channel: ChatChannel;
    /** 会话标题，取首条发言的前若干字，可被重命名 */
    title: string;
    /** 一句话摘要，显示在标题下方；没有则退回首条发言 */
    summary: string;
    /** 会话状态 */
    status: ChatSessionStatus;
    /** 创建时刻（毫秒时间戳）；左栏按它倒序 */
    createdAt: number;
    /** 最后一条消息的时刻（毫秒时间戳），用于"多久没聊了" */
    updatedAt: number;
    /** 消息条数；不读 messages 数组即可渲染计数，避免左栏为了显示数字遍历全部消息 */
    messageCount: number;
}

/* -------------------------------------------------------------------------- */
/* 取值                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 会话标题的截断长度。
 *
 * 取 18：左栏宽 240px，中文标题一行约 11 字，两行放得下 18 字且不至于挤成三行。
 * 前缀相同的一批会话（"统计各分库……"连着问）靠这 18 字区分得开。
 */
export const SessionTitleLength = 18;

/**
 * 由一条发言生成会话标题。
 *
 * 换行截断到第一行——多行输入（贴一段 SQL 或一段报错）时，标题若带上第二行，
 * 左栏会被撑得忽高忽低。
 */
export function titleOf(text: string): string {
    const firstLine =
        text.split("\n").find((line: string): boolean => line.trim().length > 0) ?? "";
    const trimmed = firstLine.trim();

    return trimmed.length > SessionTitleLength
        ? `${trimmed.slice(0, SessionTitleLength)}…`
        : trimmed;
}

/**
 * 相对时间：`刚刚` / `12 分钟前` / `3 小时前` / `2 天前` / `2026-02-14`。
 *
 * 会话列表用相对时间而不是绝对时刻：用户判断"要不要接着聊"看的是"隔了多久"，
 * 不是"哪一天几点"。超过一周才退回日期。
 */
export function relativeTime(time: number, now: number = Date.now()): string {
    const elapsed = now - time;

    if (elapsed < 60_000) {
        return "刚刚";
    }
    if (elapsed < 3_600_000) {
        return `${Math.floor(elapsed / 60_000)} 分钟前`;
    }
    if (elapsed < 86_400_000) {
        return `${Math.floor(elapsed / 3_600_000)} 小时前`;
    }
    if (elapsed < 604_800_000) {
        return `${Math.floor(elapsed / 86_400_000)} 天前`;
    }

    const date = new Date(time);
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * 时刻：`14:05`。
 *
 * 气泡上只显示时分——同一次会话内的消息几乎都在同一天，带上日期是噪声。
 */
export function clockOf(time: number): string {
    const date = new Date(time);
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");

    return `${hour}:${minute}`;
}
