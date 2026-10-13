/**
 * 深度研究域模型：环节、深度、证据强度与未决问题。
 *
 * ## 为什么另起一份模型，而不是继续写在页面里
 *
 * 深度研究页原先把四个环节写成页面里的一个数组，判据是"已经问过几轮"。
 * 那份实现有两个问题，且都不是排版问题：
 *
 * 1. **判据与说法不一致**。环节名（定口径 / 取数 / 交叉验证 / 成文）说的是
 *    研究方法，判据却是聊了几轮——用户按字面理解"交叉验证已完成"，实际什么
 *    都没核对过。界面上的进度一旦不可信，它比没有进度更糟；
 * 2. **没有第二处能读到它**。消息流要按环节分段渲染、左栏要显示"这条会话
 *    研究到哪一步"、以后接上真实任务状态还要核对同一套环节名——都写在页面里
 *    就得各抄一份。
 *
 * 所以环节、深度、立场、置信度这些**形状**归 `src/entity/`（与 `chat.ts`
 * 同一层，理由也相同），页面只做渲染与取值。
 *
 * ## 判据是可推导的，不是编的
 *
 * `stageOf(messages)` 只看消息流里**已经出现的东西**：有没有引用条目、
 * 有没有两条以上不同出处、有没有反证或明确标注不确定的地方。这些都是
 * `ChatCitation` 上的字段，不是"聊了几轮"这类与内容无关的计数。
 *
 * 这仍然是**启发式**：真正的判据是检索任务本身的状态，等后端接上
 * （见 `use-chat-page.ts` 的说明），把 `stageOf()` 换成读任务状态即可，
 * 页面与消息结构都不用改。
 *
 * ## 文献依据
 *
 * 环节取自信息检索的过程模型：Kuhlthau 的 ISP 六阶段（启动 → 选择 → 探索 →
 * 形成 → 搜集 → 呈现）与 Big6 信息问题解决模型；分阶段而不是给一个总进度条，
 * 是因为过程模型里"探索期的困惑"是**正常且必然**的一段，界面要能把它显示出来
 * 而不是让它看起来像卡住了。
 *
 * 深度分档取自 Bloom 修订版（记忆 → 创造）与 Webb 的知识深度（DOK 1–4）：
 * 同一句话问"是哪个"和问"为什么"，需要的材料与可否证程度完全不同。
 *
 * 置信度按 IPCC 的习惯分三档并**显式给出语言与数值两套说法**——只写"高"
 * 会让人以为是确定，只写"80%"又会被当成精确概率。
 */

import type { ChatMessage } from "./chat";

/* -------------------------------------------------------------------------- */
/* 环节                                                                        */
/* -------------------------------------------------------------------------- */

/** 研究环节的标识。 */
export type ResearchStageId = "scope" | "collect" | "verify" | "report";

/** 一个研究环节。 */
export interface ResearchStage {
    /** 标识 */
    id: ResearchStageId;
    /** 环节名，两到三字 */
    name: string;
    /** 这一步产出什么，一句话 */
    delivers: string;
    /** 判据：怎样才算这一步做完了 */
    criterion: string;
}

/**
 * 四个环节。
 *
 * 顺序即 `元数据 -> 取数 -> 交叉验证 -> 成文`：这是信息检索过程模型里
 * "先定问题、再找材料、再评估材料、最后表达"的最小闭环。再加一步（比如
 * "选题"）会让最左侧的首屏放不下，减一步则会把"评估材料"和"找材料"混成
 * 一步——而这两件事在界面上要分开，因为它们的失败方式不同（找不到 vs. 找到了
 * 但互相矛盾）。
 */
export const ResearchStages: readonly ResearchStage[] = [
    {
        id: "scope",
        name: "定口径",
        delivers: "课题边界、时间范围与判据",
        criterion: "用户提出了课题，且没在越出资料范围"
    },
    {
        id: "collect",
        name: "取数",
        delivers: "分库、查询语句与原始历表",
        criterion: "已经给出至少一处可核对的位置"
    },
    {
        id: "verify",
        name: "交叉验证",
        delivers: "第二条出处、反证与置信度",
        criterion: "两处以上不同出处，或明确指出仅一处支持"
    },
    {
        id: "report",
        name: "成文",
        delivers: "结论、依据、未决问题",
        criterion: "给出带引用的结论并列出未决问题"
    }
];

/* -------------------------------------------------------------------------- */
/* 深度                                                                        */
/* -------------------------------------------------------------------------- */

/** 提问深度的标识。 */
export type ResearchDepthId = "locate" | "explain" | "apply" | "synthesize";

/** 一档提问深度。 */
export interface ResearchDepth {
    /** 标识 */
    id: ResearchDepthId;
    /** 档位名 */
    name: string;
    /** 这一档在问什么，一句话 */
    question: string;
    /** 这档需要什么材料 */
    needs: string;
}

/**
 * 四档提问深度，对照 Bloom 修订版与 Webb 的 DOK。
 *
 * 放在界面上**先选再问**，是因为同一句话在不同档上要的材料完全不同：
 * "建元是哪一天"只需要一条记录，"建元是怎么定出来的"要文献、要旁证、要反证。
 * 用户不选，助手只能猜；猜错了会给出一个看起来完整、其实只有第一档材料的答案。
 * 这正是"知识错觉"（illusion of explanatory depth）最容易发生的地方。
 */
export const ResearchDepths: readonly ResearchDepth[] = [
    {
        id: "locate",
        name: "定位",
        question: "是哪一条、在哪张表",
        needs: "一条可核对的记录"
    },
    {
        id: "explain",
        name: "解释",
        question: "为什么是这样，依据是什么",
        needs: "口径文档 + 原始历表"
    },
    {
        id: "apply",
        name: "应用",
        question: "换一段年份 / 换一个口径还成立吗",
        needs: "反例与边界条件"
    },
    {
        id: "synthesize",
        name: "综合",
        question: "哪些结论其实还没有定论",
        needs: "多条互相独立的材料"
    }
];

/* -------------------------------------------------------------------------- */
/* 证据                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 材料相对结论的立场。
 *
 * 三档而不是"相关 / 不相关"：深度研究页要能把**反证**单独列出来。
 * 只列支持性材料是确认偏误的界面版本——用户看到的证据全是同向的，
 * 于是把"我找到了三条支持"读成"这条结论很稳"。
 */
export type CitationStance = "support" | "contradict" | "reference";

/**
 * 置信度。
 *
 * 三档对应 IPCC 的 calibrated language：高 = 很可能是这样、中 = 大致如此但有
 * 未定的前提、低 = 只是推测。**不给百分比**：本项目的结论都是历史与算法口径，
 * 没有可重复的频次可算，写"78%"是假精确。
 */
export type CitationConfidence = "high" | "medium" | "low";

/** 立场的界面文案与配色（`ElTag` 的 `type`）。 */
export const StanceLabels: Record<CitationStance, { text: string; type: "success" | "danger" | "info" }> =
    {
        support: { text: "支持", type: "success" },
        contradict: { text: "反证", type: "danger" },
        reference: { text: "口径", type: "info" }
    };

/** 置信度的界面文案与说明。 */
export const ConfidenceLabels: Record<CitationConfidence, { text: string; note: string }> = {
    high: { text: "高", note: "多处独立出处一致" },
    medium: { text: "中", note: "有一处出处，但前提未全定" },
    low: { text: "低", note: "仅推测，材料不足以支撑" }
};

/* -------------------------------------------------------------------------- */
/* 问题与自检                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * 一条未决问题。
 *
 * "未决问题"是深度研究页与"问答页"在内容上的分界：只给结论的页面把不确定性
 * 藏起来了，而结论**能被推翻**这一点恰恰是它可信的原因。所以每份报告末尾都要
 * 有这一栏，且允许为空（空时写"未发现"而不是不渲染）。
 */
export interface ResearchQuestion {
    /** 标识 */
    id: string;
    /** 问题本身 */
    text: string;
    /** 卡在哪里 */
    blockedBy: string;
    /** 这个问题不解决会影响什么结论 */
    impact: string;
}

/**
 * 一条读后自检题。
 *
 * 取自检索练习（retrieval practice）与"自我解释"：让读者先自己回答再看依据，
 * 比再读一遍正文更能留下东西。所以每题**先给问题、依据藏在折叠里**，
 * 不直接把答案摊开——摊开的答案会被当成正文的一部分略过。
 */
export interface ResearchSelfCheck {
    /** 标识 */
    id: string;
    /** 自检题 */
    question: string;
    /** 答不上来时去哪儿找 */
    evidence: string;
}

/* -------------------------------------------------------------------------- */
/* 推导                                                                        */
/* -------------------------------------------------------------------------- */

/** 一个环节的当前状态。 */
export interface ResearchStageState {
    /** 环节定义 */
    stage: ResearchStage;
    /** 是否已完成 */
    done: boolean;
}

/** 消息流里与判据有关的那几个计数。 */
interface EvidenceTally {
    /** 用户发言条数 */
    asked: number;
    /** 引用条目总数 */
    citations: number;
    /** 不同出处数（按 `source` 去重） */
    origins: number;
    /** 反证条数 */
    contradicting: number;
    /** 明确标注低置信度的条数 */
    uncertain: number;
}

/**
 * 统计消息流里可用于判定的证据。
 *
 * `origins` 按 `source` 去重而不是数条数：同一份 `docs/design.md` 引三次
 * 只算**一处**出处。这正是"交叉验证"与"多贴几条引用"的分界——独立出处
 * 才是交叉。
 */
function tally(messages: readonly ChatMessage[]): EvidenceTally {
    const sources = new Set<string>();
    let citations = 0;
    let contradicting = 0;
    let uncertain = 0;
    let asked = 0;

    for (const entry of messages) {
        if (entry.role === "user") {
            asked += 1;
        }
        for (const citation of entry.citations ?? []) {
            citations += 1;
            sources.add(citation.source);
            if (citation.stance === "contradict") {
                contradicting += 1;
            }
            if (citation.confidence === "low") {
                uncertain += 1;
            }
        }
    }

    return { asked, citations, origins: sources.size, contradicting, uncertain };
}

/**
 * 由消息流推出各环节的完成情况。
 *
 * 判据逐条写在 `ResearchStages` 的 `criterion` 上，这里是它的实现。刻意**不用
 * 轮次**：轮次与"研究到哪一步"没有因果关系，用户连问三句"再详细点"不该让
 * "交叉验证"变成已完成。
 *
 * 最后一步（成文）用"助手已给出带引用的结论"判定：`citation` 形态的助手消息
 * 在本项目里就是"正文 + 出处"这一种排版，它出现即意味着已成文。
 */
export function stageOf(messages: readonly ChatMessage[]): ResearchStageState[] {
    const tallyResult = tally(messages);
    const answered = messages.some((entry: ChatMessage): boolean => entry.role === "assistant");

    /** 环节 id -> 是否完成。顺序与 `ResearchStages` 一致。 */
    const done: Record<ResearchStageId, boolean> = {
        scope: tallyResult.asked >= 1,
        collect: tallyResult.citations >= 1,
        verify: tallyResult.origins >= 2 || tallyResult.contradicting >= 1,
        report: messages.some(
            (entry: ChatMessage): boolean =>
                entry.role === "assistant" && (entry.citations ?? []).length > 0
        )
    };

    // 助手一句都没答时，后三步一律不算完成：材料只可能来自助手，
    // 用户自己贴的引用不该把"取数"点亮。
    if (!answered) {
        done.collect = false;
        done.verify = false;
        done.report = false;
    }

    return ResearchStages.map(
        (stage: ResearchStage): ResearchStageState => ({ stage, done: done[stage.id] })
    );
}

/** 已完成的环节数。 */
export function completedCount(states: readonly ResearchStageState[]): number {
    return states.filter((state: ResearchStageState): boolean => state.done).length;
}

/**
 * 进度百分数。
 *
 * 用"已完成环节数 / 总环节数"而不是把环节等权成一个连续值：环节是离散的，
 * 4 个环节的进度只能是 0 / 25 / 50 / 75 / 100。给出 37% 这种数字会让人以为
 * 背后有一个可测量的连续过程，而这里没有。
 */
export function progressOf(states: readonly ResearchStageState[]): number {
    if (states.length === 0) {
        return 0;
    }

    return Math.round((completedCount(states) / states.length) * 100);
}

/**
 * 当前正在进行的环节。
 *
 * 全部完成时返回 `null`（没有"正在进行"的那一步），而不是硬指向最后一步——
 * 界面上"停留在成文"与"研究已结束"是两回事。
 */
export function activeStageOf(states: readonly ResearchStageState[]): ResearchStageState | null {
    return states.find((state: ResearchStageState): boolean => !state.done) ?? null;
}

/** 由材料统计出的证据概览，右栏显示"支持几条、反证几条"。 */
export interface EvidenceSummary {
    /** 引用条目总数 */
    citations: number;
    /** 不同出处数 */
    origins: number;
    /** 支持条数 */
    supporting: number;
    /** 反证条数 */
    contradicting: number;
    /** 高 / 中 / 低 三档各几条 */
    confidence: Record<CitationConfidence, number>;
}

/** 由消息流统计证据概览。 */
export function evidenceOf(messages: readonly ChatMessage[]): EvidenceSummary {
    const sources = new Set<string>();
    const confidence: Record<CitationConfidence, number> = { high: 0, medium: 0, low: 0 };
    let citations = 0;
    let supporting = 0;
    let contradicting = 0;

    for (const entry of messages) {
        for (const citation of entry.citations ?? []) {
            citations += 1;
            sources.add(citation.source);
            if (citation.stance === "support") {
                supporting += 1;
            }
            if (citation.stance === "contradict") {
                contradicting += 1;
            }
            // 立场与置信度是两件事：没写置信度的材料按"中"计入，
            // 否则"共 3 条"会与三档之和对不上。
            confidence[citation.confidence ?? "medium"] += 1;
        }
    }

    return { citations, origins: sources.size, supporting, contradicting, confidence };
}
