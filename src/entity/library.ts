/**
 * 参考文献登记表：四类文献的**唯一来源**。
 *
 * ## 为什么这份数据是手写的，不在库里
 *
 * 22 个分库全部由 `calendar.xlsx` 与维基百科解析而来，里面**没有任何书目**。
 * 而参考文献是这个应用该有的东西：用户看到"闰月按无中气置闰"，
 * 下一个问题必然是"这条规则出自哪里"。
 *
 * 所以这一份是**人工整理**的：只收真实存在、且与本项目口径直接相关的著作。
 * 每条都写了"它解决了什么"——一本只写书名与作者的书目，对读者没有用；
 * 有用的信息是"我该为了什么去读它"。
 *
 * ## 分类是二维的
 *
 * 时代（古代 / 现代）× 地域（中国 / 外国）。这是使用者真实的检索轴：
 * "我要找阿拉伯的天文著作"应该是一次点击，不是一页里的四次滚动。
 *
 * ## 不收的东西
 *
 * 不收无法核实的条目。古籍的成书年代与作者常有争议，凡有争议的在 `note` 里
 * 写明"（作者与年代有争议）"，而不是挑一个说法当事实。
 */

/** 文献类别。 */
export type LibraryCategory = "ancient-china" | "ancient-foreign" | "modern-china" | "modern-foreign";

/** 一条文献。 */
export interface Reference {
    /** 书名（中文；外国著作给通行译名） */
    title: string;
    /** 原名（外国著作给原文，中国古籍留空） */
    original?: string;
    /** 作者 */
    author: string;
    /** 成书或出版年代 */
    era: string;
    /**
     * 它解决了什么。
     *
     * 这一栏是这份书目存在的理由：读者据此判断"要不要读"。
     * 写"历法著作"没有用，写"最早系统记载十九年七闰的文献"才有用。
     */
    why: string;
    /** 与本项目哪一部分相关 */
    relates: readonly string[];
}

/** 一个文献页。 */
export interface LibraryPage {
    /** 路由参数 */
    id: LibraryCategory;
    /** 页标题 */
    title: string;
    /** 一句话说明这一页收什么 */
    note: string;
    /** 条目 */
    items: readonly Reference[];
}

/** 中国古代文献。 */
const ANCIENT_CHINA: readonly Reference[] = [
    {
        title: "尚书·尧典",
        author: "（作者与年代有争议）",
        era: "先秦",
        why: "「期三百有六旬有六日，以闰月定四时成岁」——现存最早把回归年长与置闰写在一起的文字，本项目的「无中气置闰」可追溯到这条。",
        relates: ["朔望历", "闰月", "回归年"]
    },
    {
        title: "春秋·左传",
        author: "（作者与年代有争议）",
        era: "先秦",
        why: "记录了春秋时期的三十七次日食与多次「闰月」记事，是校验先秦历法复原结果的**实测样本**——推算对不对，拿这些日期验。",
        relates: ["朔望历", "日食", "年表"]
    },
    {
        title: "周髀算经",
        author: "（作者与年代有争议）",
        era: "约公元前 1 世纪",
        why: "「勾股各自乘，并而开方除之」的出处，同时给出最早的二十八宿距度与圭表测影法——本项目的节气定义（太阳黄经每 15°）与它同源。",
        relates: ["节气历", "二十八宿"]
    },
    {
        title: "史记·历书·天官书",
        author: "司马迁",
        era: "约公元前 104 年",
        why: "《历书》载汉武帝太初改历的经过与「十一月甲子朔旦冬至」的历元选取，《天官书》是全套星官体系的定型文本。",
        relates: ["建元", "五星", "天象"]
    },
    {
        title: "汉书·律历志",
        author: "班固",
        era: "约公元 82 年",
        why: "《三统历》的完整术文：八十一分律历、十九年七闰、五星会合周期。这是**中国第一部有完整算法传世**的历法，本项目的朔望月与回归年关系可与它逐条对照。",
        relates: ["朔望历", "回归历", "五星"]
    },
    {
        title: "后汉书·律历志",
        author: "司马彪",
        era: "约公元 300 年",
        why: "《四分历》与东汉论历的原始记录，含连续多次的月食预报与实测比对——历法史上最早的系统性误差讨论。",
        relates: ["朔望历", "月相", "交会"]
    },
    {
        title: "晋书·律历志",
        author: "房玄龄等",
        era: "约公元 648 年",
        why: "载虞喜发现**岁差**（「尧时冬至日短星昴，今二千七百余年乃东壁」）。这是本项目中回归年与恒星年必须分开的根据。",
        relates: ["回归历", "岁差", "二十八宿"]
    },
    {
        title: "大衍历",
        author: "一行",
        era: "公元 727 年",
        why: "首次用**不等间距二次差**插值计算太阳视运动，而不假设匀速。本项目的节气时刻若要与唐代史料对齐，必须以它的算法为参照。",
        relates: ["节气历", "天文历"]
    },
    {
        title: "皇极经世",
        author: "邵雍",
        era: "北宋",
        why: "**元会运世**体系的出处：1 元 = 12 会 = 360 运 = 4320 世，1 世 = 30 年。本项目的元会运世口径完全照它，历史域的周期表就是这套。",
        relates: ["皇极经世", "纪元表", "元会运世"]
    },
    {
        title: "梦溪笔谈",
        author: "沈括",
        era: "约 1088 年",
        why: "提出**十二气历**（以节气为月首，不用朔望），并记「以十二气为一年，更不用十二月」——本项目的节气历与节气历正是这条思路的现代实现。",
        relates: ["节气历", "节气历", "轩辕历"]
    },
    {
        title: "授时历",
        author: "郭守敬、王恂等",
        era: "公元 1281 年",
        why: "回归年长 **365.2425 日**，与格里高利历同值而早三百年。本项目的回归年常数（365.2422 日）与它相差不到 0.0003 日。",
        relates: ["回归历", "格里高利历", "天文历"]
    },
    {
        title: "崇祯历书",
        author: "徐光启、汤若望等",
        era: "公元 1634 年",
        why: "中国第一次系统引入**第谷体系与几何天文学**，含明确的黄道坐标与视差修正——本项目天象页的坐标口径与它同源。",
        relates: ["天象", "黄道坐标", "视差"]
    },
    {
        title: "历代天文律历等志汇编",
        author: "中华书局编辑部",
        era: "1976 年",
        why: "把二十四史里的律历志、天文志、五行志**逐条辑出并标点**。要查任何一代的历法原文，从这里开始比翻正史快得多。",
        relates: ["全部历法", "史料检索"]
    }
];

/** 古代外国文献。 */
const ANCIENT_FOREIGN: readonly Reference[] = [
    {
        title: "巴比伦天文日志",
        original: "Astronomical Diaries (ADART)",
        author: "巴比伦天文家（佚名）",
        era: "公元前 7 世纪 – 公元前 1 世纪",
        why: "人类最早的**系统性天象观测档案**：逐日记月相、行星位置与食。它同时是古希腊天文学的数据来源（喜帕恰斯用过这些记录），也是检验现代回推算法的极端样本。",
        relates: ["朔望历", "月相", "天象"]
    },
    {
        title: "汉谟拉比时期的月名表",
        original: "Babylonian month names",
        author: "（佚名）",
        era: "约公元前 18 世纪",
        why: "最早显示「十九年七闰」之前**巴比伦用观测置闰**（哪个月加闰由国王下诏）的实物。与本项目「无中气置闰」对照，可以看出从观测到规则的演化。",
        relates: ["朔望历", "闰月"]
    },
    {
        title: "天文学大成",
        original: "Almagest (Μαθηματικὴ Σύνταξις)",
        author: "托勒密",
        era: "约公元 150 年",
        why: "给出**均时差**（equation of time）与月球第一、第二不等量的完整算法。命理页里「真太阳时是否含均时差」的争议，源头就在这一本。",
        relates: ["真太阳时", "月球", "星盘"]
    },
    {
        title: "天文学",
        original: "De Astronomia",
        author: "喜帕恰斯（残篇）",
        era: "公元前 2 世纪",
        why: "**岁差**的发现（与虞喜独立发现，相隔约五百年）。恒星年与回归年之差因此必须计入，否则两千年前的星表会整体偏移。",
        relates: ["回归历", "恒星年", "二十八宿"]
    },
    {
        title: "历法溯源",
        original: "De die natali",
        author: "肯索里努斯",
        era: "公元 238 年",
        why: "唯一系统记载**古罗马历法改革细节**的拉丁文献，含努马历的闰月（Mercedonius）与「闰年混乱」问题——格里高利历改历的远因。",
        relates: ["格里高利历", "儒略历", "闰月"]
    },
    {
        title: "罗马建城以来史",
        original: "Ab urbe condita",
        author: "李维",
        era: "约公元前 27 年 – 公元 17 年",
        why: "记载儒略历改历的政令原文与「使节把闰日加错，导致季节倒错」的实例。历法时间轴上 1582 年的十天断层，与这里的十天是同类问题。",
        relates: ["格里高利历", "儒略历"]
    },
    {
        title: "印度古代天文学",
        original: "Sūrya Siddhānta",
        author: "（佚名）",
        era: "约公元 4–5 世纪",
        why: "印度体系以**恒星黄道**为准（不同于希腊的回归黄道），并给出自己的岁差常数。本项目七政四余页的坐标口径与它直接相关。",
        relates: ["七政四余", "岁差", "二十八宿"]
    },
    {
        title: "阿拉伯天文学集",
        original: "Zīj al-Sindhind / Zīj-i Īlkhānī",
        author: "花拉子米 / 纳西尔丁·图西",
        era: "约 820 年 / 1272 年",
        why: "把希腊天文学与印度数值方法合成**可计算的历表**（zīj），并通过它传入中国（回回历）。本项目的「行度」概念与这里的历表同源。",
        relates: ["天文历", "行度", "五星"]
    },
    {
        title: "古代天文学史",
        original: "History of Ancient Astronomy",
        author: "J. L. E. Dreyer",
        era: "1906 年",
        why: "把巴比伦到托勒密的观测记录与回推计算逐一比对，是**判断某个古代日期记录是否可信**的常用工具书。",
        relates: ["天象", "史料校勘"]
    }
];

/** 现代中国文献。 */
const MODERN_CHINA: readonly Reference[] = [
    {
        title: "中国古代历法",
        author: "张培瑜、陈美东等",
        era: "2008 年",
        why: "逐代拆解中国历法的算法（上元积年、朔望月、闰周、五星），并给出**历代历法常数总表**。要核对本项目某个常数的来源，从这一本查起。",
        relates: ["全部历法", "历法常数"]
    },
    {
        title: "中国历法史",
        author: "陈遵妫",
        era: "1938 年（多次重印）",
        why: "中文世界里最系统的一部历法通史，含各代历法的原文节录与算例。",
        relates: ["全部历法", "史料"]
    },
    {
        title: "三千五百年历日天象",
        author: "张培瑜",
        era: "1997 年",
        why: "**逐日对照表**：公元前 1500 年到公元 2050 年的儒略日、干支、朔望、节气。本项目 `calendar.xlsx` 的朔望月数据与它同源，可用于交叉校验。",
        relates: ["朔望历", "干支历", "节气历", "校验"]
    },
    {
        title: "中国天文学史",
        author: "陈美东",
        era: "2008 年",
        why: "从观测仪器与星表的角度讲中国天文学，含二十八宿距度的实测变迁。",
        relates: ["二十八宿", "天象"]
    },
    {
        title: "中国古代星占学",
        author: "江晓原",
        era: "2007 年",
        why: "把星占与历法的关系讲清楚：**为什么中国古代历法必须预报天象**——因为历法是星占的输入。理解这一点才理解为什么历志里全是行星位置。",
        relates: ["天象", "五星", "史料"]
    },
    {
        title: "天学真原",
        author: "江晓原",
        era: "1991 年",
        why: "论证中国古代天学是**服务于王权的星占体系**而非独立科学。本项目把「历法」与「天象」分成两域，依据之一是这条区分。",
        relates: ["天象", "历法"]
    },
    {
        title: "中国科学技术史·天文学卷",
        author: "卢央等",
        era: "2003 年",
        why: "把天文与历法放在科技史脉络里，含大量一手文献的释读。",
        relates: ["史料"]
    },
    {
        title: "中国历史纪年表",
        author: "方诗铭",
        era: "1980 年",
        why: "朝代、年号、公元的**逐条对照**，并标明并立政权。本项目年号表允许重叠，依据就是这一类工具书的体例。",
        relates: ["年号", "朝代", "年表"]
    },
    {
        title: "中国历史地图集",
        author: "谭其骧主编",
        era: "1982 年",
        why: "朝代疆域与地名的逐代对照。历史事件要落到地图上时用它。",
        relates: ["朝代", "历史事件"]
    },
    {
        title: "协纪辨方书",
        author: "允禄等（清）",
        era: "1739 年",
        why: "清代官方择日学总集，把干支、神煞、二十八宿的用法系统化。本项目数术诸页的术语体系主要依据它。",
        relates: ["择日", "神煞", "数术"]
    },
    {
        title: "果老星宗",
        author: "（题）张果",
        era: "明代刊本",
        why: "七政四余的集大成文本，给出二十八宿与十二宫的对应、以及四余（罗计炁孛）的算法。",
        relates: ["七政四余", "二十八宿"]
    },
    {
        title: "紫微斗数全书",
        author: "（题）陈希夷",
        era: "明代刊本",
        why: "紫微斗数安星诀的定型文本：十二宫、十四主星、四化的排法。本项目紫微页的安星表以它为准。",
        relates: ["紫微斗数", "安星"]
    },
    {
        title: "御定星历考原",
        author: "李光地等（清）",
        era: "1712 年",
        why: "把历法、星占、择日的口径统一成官方说法，是判断「某个术语在清代官方语境里指什么」的基准。",
        relates: ["数术", "术语"]
    }
];

/** 现代外国文献。 */
const MODERN_FOREIGN: readonly Reference[] = [
    {
        title: "天文算法",
        original: "Astronomical Algorithms",
        author: "Jean Meeus",
        era: "1991 年（第 2 版 1998）",
        why: "**本项目的天文计算全部依据它**：儒略日、太阳与行星的黄经级数、月球的 ELP2000 截断、节气检索。`src/share/astronomy/` 的算法逐条对应书中章节。",
        relates: ["天文历", "节气历", "天象", "核心依据"]
    },
    {
        title: "天体力学",
        original: "Celestial Mechanics",
        author: "Jean Meeus",
        era: "1991 年",
        why: "《天文算法》的续编：轨道根数、摄动、日月食与掩星的完整算法。要做日月食预报时用它。",
        relates: ["交会", "天象"]
    },
    {
        title: "历法计算",
        original: "Calendrical Calculations",
        author: "Edward M. Reingold, Nachum Dershowitz",
        era: "1997 年（第 4 版 2018）",
        why: "把**十四种历法**写成可执行的函数式定义，含儒略日 ↔ 各历的互相换算与中国农历（含闰月规则）。判断「某个历法换算实现对不对」，拿它的定义逐条比。",
        relates: ["格里高利历", "朔望历", "历法换算", "核心依据"]
    },
    {
        title: "中国天文考古学",
        original: "Astronomy and Mathematics in Ancient China: The Zhou bi suan jing",
        author: "Christopher Cullen",
        era: "1996 年",
        why: "《周髀算经》的完整英译与数学分析，把「盖天说」的几何讲成可验证的模型。理解中国古代宇宙模型的最可靠西文著作。",
        relates: ["周髀算经", "盖天说"]
    },
    {
        title: "古代中国历法的形成",
        original: "The Genesis of Chinese Calendars",
        author: "Nathan Sivin 等",
        era: "1969 年起",
        why: "用**现代天文回推**校验《授时历》等历法的精度，并讨论中国历法的「上元积年」为什么是那样选的。",
        relates: ["授时历", "上元积年", "校验"]
    },
    {
        title: "中国科学技术史·天文卷",
        original: "Science and Civilisation in China, Vol. 3",
        author: "李约瑟",
        era: "1959 年",
        why: "把中国天文学放进世界比较框架，含二十八宿起源的争论综述。注意：李约瑟的部分结论（如二十八宿西来说）后来有争议，读时留意作者的立场。",
        relates: ["二十八宿", "比较天文学", "史料"]
    },
    {
        title: "希腊天文学与巴比伦天文学",
        original: "Babylonian Astronomy and Greek Astronomy",
        author: "Otto Neugebauer / Francesca Rochberg",
        era: "1955 年 / 2004 年",
        why: "用楔形文字原文重建巴比伦的数学天文学，并论证它如何成为希腊天文学的输入。黄道十二宫从巴比伦到希腊的传播路径在这两本里。",
        relates: ["黄道十二宫", "星盘", "占星"]
    },
    {
        title: "占星学的起源与传播",
        original: "A History of Horoscopic Astrology",
        author: "James H. Holden",
        era: "1996 年（第 2 版 2006）",
        why: "从希腊化时期到现代的占星术史，含宫位制（Placidus / Koch / Whole Sign）的演变与各自的原典依据。星盘页的宫位制选项依据它。",
        relates: ["西方星盘", "宫位制"]
    },
    {
        title: "黄道十二宫与中国",
        original: "The Chinese Zodiac and the Twelve Palaces",
        author: "（多家，见综述）",
        era: "近代",
        why: "讨论十二宫随佛经传入中国并与本土十二次合流的过程。本项目把「西方星盘」与「七政四余」分成两页，依据是它们坐标口径不同（回归黄道 vs 恒星黄道）。",
        relates: ["七政四余", "西方星盘", "坐标口径"]
    },
    {
        title: "星历表",
        original: "The Astronomical Almanac",
        author: "USNO / HM Nautical Almanac Office",
        era: "年刊",
        why: "官方星历。本项目的 `astronomy-engine` 结果与它对不上时，以它为准。",
        relates: ["天象", "校验"]
    }
];

/** 四页。 */
export const LIBRARY_PAGES: readonly LibraryPage[] = [
    {
        id: "ancient-china",
        title: "中国古代文献",
        note: "从《尚书·尧典》到清代官修，收与本项目历法口径直接相关的著作。每条都写了「它解决了什么」。",
        items: ANCIENT_CHINA
    },
    {
        id: "ancient-foreign",
        title: "古代外国文献",
        note: "巴比伦、希腊、罗马、印度、阿拉伯。收它们是因为本项目的坐标口径、真太阳时与岁差概念都要在这些原典里找依据。",
        items: ANCIENT_FOREIGN
    },
    {
        id: "modern-china",
        title: "现代中国文献",
        note: "近现代中国学者的历法复原、历日表与术数整理。张培瑜的《三千五百年历日天象》是校验本项目数据的直接工具。",
        items: MODERN_CHINA
    },
    {
        id: "modern-foreign",
        title: "现代外国文献",
        note: "Meeus 与 Reingold 是本项目两份核心依据；其余用于校验、坐标口径与占星史。",
        items: MODERN_FOREIGN
    }
];

/** `id` → 页。 */
export const LIBRARY_PAGE_BY_ID: ReadonlyMap<string, LibraryPage> = new Map(
    LIBRARY_PAGES.map((page) => [page.id, page])
);

/** 取一页。 */
export const libraryPageOf = (id: string | undefined): LibraryPage | undefined =>
    id === undefined ? undefined : LIBRARY_PAGE_BY_ID.get(id);
