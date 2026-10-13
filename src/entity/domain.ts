/**
 * 领域登记表：全应用一级导航的**唯一来源**。
 *
 * ## 它解决的问题
 *
 * 二十多个页面平铺在一条侧栏里，用户在菜单里做的是"在二十多个标签里找一个"。
 * 分成九个域之后，第一次点击把候选集降到 2–8 个。这不是"限制菜单项数"
 * ——`docs/ui-architecture.md` §2.2 第 5 条已经写明 Miller 的 7±2 常被误用、
 * 长菜单是可以的——而是**让每一层的标签保持具体**。NN/g 在 flat-vs-deep 一文里
 * 的原话是：层级浅而每层选项少时，标签会"变得更泛、更容易混淆"。
 *
 * ## 外壳按这份表渲染
 *
 * ```
 * 图标窄栏（56px）     ← 本文件的 DOMAINS，顺序即显示顺序
 * └─ 二级面板（240px） ← 当前域的 pages，按 group 分段
 *    └─ 内容区
 * ```
 *
 * 这正是 VS Code 的 Activity Bar + Primary Side Bar 结构
 * （<https://code.visualstudio.com/docs/configure/custom-layout>）。
 * 用它的理由很直接：九个域用图标加悬停提示就能表意，而二十多个页面必须写全名，
 * 两者对宽度的要求差一个数量级，塞进同一条侧栏必然有一边将就。
 *
 * ## 与路由表的关系
 *
 * **本文件不定义路由**，只声明"哪个域包含哪些路径、叫什么、用什么图标"。
 * `verifyDomainRoutes()` 在启动时检查每条路径都真的存在，
 * 找不到就抛错——早炸比点进去发现面板里少一项好。
 *
 * ## 列表页与详情页是两条路径
 *
 * 八套历法共用一条参数化路由 `/calendar/:system/:view?`。面板里为每套历法写的
 * 是具体路径（`/calendar/natural`），而「节气一览」这类**数据表格**
 * 写成 `/calendar/climate/table`。`locate()` 因此同时做精确匹配与最长前缀匹配：
 * 用户在 `/calendar/natural/week` 时，窄栏仍应亮在「历法」上。
 */

import type { IconName } from "../plugin/icons";
import { routeAt } from "../plugin/menu";

/** 域的标识。 */
export type DomainId =
    | "home"
    | "agent"
    | "calendar"
    | "astrology"
    | "divination"
    | "sky"
    | "history"
    | "library"
    | "system";

/** 二级面板里的一项。 */
export interface DomainPage {
    /** 面板文案 */
    title: string;
    /** 绝对路径；必须与 `plugin/router.ts` 里的一条路由对应 */
    path: string;
    /** 图标 */
    icon: IconName;
    /** 悬停提示与空态说明 */
    description: string;
    /**
     * 归组标题。面板按这个字段分段，`null` 表示不归组（直接跟在域标题后）。
     *
     * 分组用的是 Gestalt 的接近性原则：靠得近的东西被读成一组。
     * 这比再加一层可折叠的树便宜——面板里一眼能看完，而树要多点一次。
     */
    group: string | null;
}

/** 一个域。 */
export interface Domain {
    id: DomainId;
    /** 域的中文名，出现在窄栏悬停提示、面板标题、面包屑第一段 */
    label: string;
    /** 窄栏图标 */
    icon: IconName;
    /** 一句话说明 */
    description: string;
    /** 域内页面，顺序即显示顺序 */
    pages: readonly DomainPage[];
}

/**
 * 九个域。
 *
 * 顺序按**打开应用之后的自然动线**排，而不是按字母或实现难度：
 * 工作台（我在哪）→ 智能体（帮我做）→ 历法（本应用的核心）→ 命理 → 数术
 * → 天象 → 历史 → 文献 → 系统。
 */
export const DOMAINS: readonly Domain[] = [
    {
        id: "home",
        label: "工作台",
        icon: "Odometer",
        description: "今日、快捷入口与最近活动",
        pages: [
            {
                title: "今日",
                path: "/",
                icon: "Odometer",
                description: "此刻的八套历法表达、今日节气与月相",
                group: null
            },
            {
                title: "数据浏览",
                path: "/data/browse",
                icon: "DataBoard",
                description: "98 张表的逐行浏览与导出",
                group: "数据"
            },
            {
                title: "结构与索引",
                path: "/data/schema",
                icon: "Files",
                description: "每张表的列、类型、主键与构建元数据",
                group: "数据"
            },
            {
                title: "导出",
                path: "/data/export",
                icon: "Download",
                description: "把查询结果导出成 CSV / JSON",
                group: "数据"
            }
        ]
    },
    {
        id: "agent",
        label: "智能体",
        icon: "MagicStick",
        description: "对话、编排与报告",
        pages: [
            {
                title: "对话",
                path: "/agent/chat",
                icon: "ChatDotRound",
                description: "与智能体对话；可切换品牌与模型",
                group: null
            },
            {
                title: "工作流",
                path: "/agent/flow",
                icon: "Connection",
                description: "把多次操作编排成可复用、可回放的流程",
                group: "编排"
            },
            {
                title: "运行记录",
                path: "/agent/flow/run",
                icon: "List",
                description: "每次运行的时间线、产出与授权痕迹",
                group: "编排"
            },
            {
                title: "报告",
                path: "/agent/report",
                icon: "Collection",
                description: "深度研究与课题研究的产出",
                group: "产出"
            },
            {
                title: "智能体设置",
                path: "/agent/setting",
                icon: "Setting",
                description: "品牌、模型、API Key 与预设",
                group: "配置"
            }
        ]
    },
    {
        id: "calendar",
        label: "历法",
        icon: "Calendar",
        description: "八套历法的日历、节气与朔望",
        pages: [
            {
                title: "轩辕历",
                path: "/calendar/natural",
                icon: "Guide",
                description: "以建元 -2696-03-11 为起点的本历（本应用的核心）",
                group: "历法"
            },
            {
                title: "朔望历",
                path: "/calendar/synodic",
                icon: "MoonNight",
                description: "以朔望月为月，29 万条真实历表",
                group: "历法"
            },
            {
                title: "格里高利历",
                path: "/calendar/gregory",
                icon: "Sunny",
                description: "现代通用参照系",
                group: "历法"
            },
            {
                title: "天文历",
                path: "/calendar/astronomy",
                icon: "Star",
                description: "按天文量推算的年月，其余历法的换算底座",
                group: "历法"
            },
            {
                title: "木星历",
                path: "/calendar/jupiter",
                icon: "Opportunity",
                description: "以木星视运动定年月，岁星纪年的依据",
                group: "历法"
            },
            {
                title: "回归历",
                path: "/calendar/tropical",
                icon: "Compass",
                description: "以太阳两次过春分点为一个回归年",
                group: "历法"
            },
            {
                title: "干支历",
                path: "/calendar/tree",
                icon: "Connection",
                description: "以立春为界的六十甲子纪年",
                group: "历法"
            },
            {
                title: "节气历",
                path: "/calendar/climate",
                icon: "Clock",
                description: "二十四气七十二候",
                group: "历法"
            },
            {
                title: "节气一览",
                path: "/calendar/climate/table",
                icon: "Memo",
                description: "逐年逐气的时刻表",
                group: "表"
            },
            {
                title: "朔望表",
                path: "/calendar/synodic/table",
                icon: "Memo",
                description: "29 万个朔望月的合朔时刻表",
                group: "表"
            },
            {
                title: "年表",
                path: "/chronology/timeline",
                icon: "Memo",
                description: "每朔望年一条编年记录，串起朝代、年号与事件",
                group: "表"
            },
            {
                title: "纪元表",
                path: "/chronology/epoch",
                icon: "Timer",
                description: "元会运世与「三十朔望年为一世」的对应",
                group: "表"
            }
        ]
    },
    {
        id: "astrology",
        label: "命理",
        icon: "User",
        description: "八字、紫微斗数、七政四余、西方星盘",
        pages: [
            {
                title: "八字",
                path: "/astrology/bazi",
                icon: "Coin",
                description: "四柱、十神、大运流年；节气定月柱、真太阳时",
                group: null
            },
            {
                title: "紫微斗数",
                path: "/astrology/ziwei",
                icon: "Grid",
                description: "十二宫安星、大限流年",
                group: null
            },
            {
                title: "七政四余",
                path: "/astrology/qizheng",
                icon: "Star",
                description: "七政四余与二十八宿的政余盘",
                group: null
            },
            {
                title: "西方星盘",
                path: "/astrology/horoscope",
                icon: "Compass",
                description: "黄道十二宫、宫位、相位；盘面本身可点击",
                group: null
            }
        ]
    },
    {
        id: "divination",
        label: "数术",
        icon: "MagicStick",
        description: "三式与占卜",
        pages: [
            {
                title: "奇门遁甲",
                path: "/divination/qimen",
                icon: "Grid",
                description: "时家转盘奇门：九宫、八门、九星、八神",
                group: "三式"
            },
            {
                title: "大六壬",
                path: "/divination/liuren",
                icon: "Connection",
                description: "月将加时起四课三传",
                group: "三式"
            },
            {
                title: "太乙神数",
                path: "/divination/taiyi",
                icon: "Odometer",
                description: "太乙九宫、十六神、主客算",
                group: "三式"
            },
            {
                title: "梅花易数",
                path: "/divination/meihua",
                icon: "Opportunity",
                description: "以数起卦、体用互变",
                group: "占卜"
            },
            {
                title: "大衍筮法",
                path: "/divination/dayan",
                icon: "Coin",
                description: "五十蓍草、十八变而成卦",
                group: "占卜"
            },
            {
                title: "六爻纳甲",
                path: "/divination/liuyao",
                icon: "Coin",
                description: "装卦、纳甲、六亲六神、动变",
                group: "占卜"
            }
        ]
    },
    {
        id: "sky",
        label: "天象",
        icon: "Star",
        description: "行星位置与地表投影",
        pages: [
            {
                title: "复平面",
                path: "/sky/plane",
                icon: "Compass",
                description: "八大行星与月球在黄道复平面上的实时位置",
                group: null
            },
            {
                title: "地表投影",
                path: "/sky/projection",
                icon: "Monitor",
                description: "各大天体与月球在地球上的星下点",
                group: null
            }
        ]
    },
    {
        id: "history",
        label: "历史",
        icon: "Collection",
        description: "周期、朝代、年号与事件",
        pages: [
            {
                title: "皇极经世",
                path: "/history/cycle",
                icon: "Odometer",
                description: "元会运世周期表：1 元 = 12 会 = 360 运 = 4320 世",
                group: null
            },
            {
                title: "朝代与年号",
                path: "/history/dynasty",
                icon: "Memo",
                description: "朝代起讫与年号更迭",
                group: null
            },
            {
                title: "历史事件",
                path: "/history/event",
                icon: "List",
                description: "事件与人物，挂在朔望年上",
                group: null
            }
        ]
    },
    {
        id: "library",
        label: "文献",
        icon: "Reading",
        description: "古代与近现代、中国与外国",
        pages: [
            {
                title: "中国古代文献",
                path: "/library/ancient-china",
                icon: "Reading",
                description: "历代历志、律历志与术数典籍",
                group: "古代"
            },
            {
                title: "古代外国文献",
                path: "/library/ancient-foreign",
                icon: "Reading",
                description: "希腊、巴比伦、印度、阿拉伯的历法与天文著作",
                group: "古代"
            },
            {
                title: "现代中国文献",
                path: "/library/modern-china",
                icon: "Document",
                description: "近现代中国学者的历法与天文研究",
                group: "现代"
            },
            {
                title: "现代外国文献",
                path: "/library/modern-foreign",
                icon: "Document",
                description: "现代天文历算、年代学与天体力学的西文文献",
                group: "现代"
            }
        ]
    },
    {
        id: "system",
        label: "系统",
        icon: "Setting",
        description: "数据源、性能与权限",
        pages: [
            {
                title: "数据源",
                path: "/system/datasource",
                icon: "DataBoard",
                description: "22 个分库的表结构、行数与构建时间",
                group: null
            },
            {
                title: "性能",
                path: "/system/performance",
                icon: "Histogram",
                description: "查询耗时、缓存命中与帧预算调度器",
                group: null
            },
            {
                title: "权限与审计",
                path: "/system/permission",
                icon: "Lock",
                description: "只读边界、持久授权与审计日志",
                group: null
            },
            {
                title: "界面设置",
                path: "/system/setting",
                icon: "Tools",
                description: "紧凑度、数字字体与动效",
                group: null
            }
        ]
    }
];

/** `id` → 域。 */
export const DOMAIN_BY_ID: ReadonlyMap<string, Domain> = new Map(
    DOMAINS.map((domain) => [domain.id, domain])
);

/** 一个路径落在哪个域、哪一项上。 */
export interface DomainLocation {
    domain: Domain;
    page: DomainPage;
}

/** 全部路径的索引。 */
const LOCATIONS: ReadonlyMap<string, DomainLocation> = (() => {
    const map = new Map<string, DomainLocation>();
    for (const domain of DOMAINS) {
        for (const page of domain.pages) {
            map.set(page.path, { domain, page });
        }
    }
    return map;
})();

/**
 * 按路径找所属的域与页面。
 *
 * 先精确匹配，失败后退回**最长前缀**匹配：用户在
 * `/calendar/natural/week` 时，窄栏仍应亮在「历法」、面板仍应亮在「轩辕历」。
 * 找不到时返回 `null`，由调用方决定兜底（外壳会回退到「工作台」）。
 */
export const locate = (path: string): DomainLocation | null => {
    const exact = LOCATIONS.get(path);
    if (exact !== undefined) {
        return exact;
    }

    let best: DomainLocation | null = null;
    let bestLength = 0;
    for (const [candidate, location] of LOCATIONS) {
        if (candidate === "/") {
            // 根路径是任何路径的前缀，参与前缀匹配会让一切都落到「今日」
            continue;
        }
        if (candidate.length > bestLength && path.startsWith(`${candidate}/`)) {
            best = location;
            bestLength = candidate.length;
        }
    }
    return best;
};

/**
 * 检查域里每条路径都真的存在于路由表。
 *
 * ## 为什么"报告"而不是"抛错"
 *
 * 早先这里 `throw`，结果是一次路径写法对不上（`routeAt` 当时按字符串相等比对，
 * 而路由表里注册的是 `/calendar/:system/:view?`）就让**整个应用白屏**——
 * 用户看到的是一片空白，控制台里是一份四十条的清单。
 *
 * 导航配置错了，正确的反应是"这一项不出现"，不是"什么都用不了"。
 * 所以这里返回问题清单：`AppShell` 在开发期把它打到控制台，
 * `scripts/verify-nav.mjs` 在构建期把它当错误。**运行时不抛。**
 */
export function verifyDomainRoutes(): string[] {
    const missing: string[] = [];
    for (const domain of DOMAINS) {
        for (const page of domain.pages) {
            if (routeAt(page.path) === null) {
                missing.push(`${domain.label} → ${page.title}（${page.path}）`);
            }
        }
    }
    return missing;
}
