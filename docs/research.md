# 深度研究页面的设计依据

本文件记录 `src/view/agent/ChatResearchView.vue` 上每条设计的来源：**教育 / 学习科学**、
**心理学**、**UI / 交互设计**三个方面。与 `docs/design.md` 的分工是：那边管数据分层
（表、字段、换算），这边管这一页为什么长成这样。

`docs/design.md` 要求"先改文档再改代码"，本文件同样：改这一页的环节、判据、
证据字段之前，先改这里。

## 0. 取证说明

结论分两类，**不得混用**：

- **已核实**：条目给出链接，且该链接的正文被实际读过（下表里带链接的都是）；
- **未核实**：文献确实存在，但本机网络下抓不到正文（`en.wikipedia.org`、
  sciencedirect、wiley、tandfonline、psycnet、pubmed 摘要页均不可达，PDF 不能解析）。
  这类只写作者与年份，**不写具体数值**。

下游引用时请沿用这条分界：把未核实的文献写成"某研究显示 X%"是本文件最不希望
看到的用法。

## 1. 教育 / 学习科学

| #   | 依据                                                                                                                                                                           | 对本页的要求                                                          | 落点                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Kuhlthau 的信息检索过程（ISP）：六阶段，核心是**不确定性原则**——探索期不确定性**上升**，出现"信心低谷"                                                                         | 分阶段显示进度；并**显式告知"此刻的不确定是正常的"**                  | 「研究进度」的 `ElSteps`；未完成时的说明文字     |
| 2   | Big6：每个阶段可拆成两个可勾选子任务，"评价"要分成评产品与评流程                                                                                                               | 环节文案写清"产出什么"与"怎样算做完"，而不是只写环节名                | `ResearchStages` 的 `delivers` / `criterion`     |
| 3   | 引导式探究：干预区间仿照最近发展区，区间外的干预要么侵入、要么压垮                                                                                                             | 右栏只在"用户自己看不出来"的地方给信息（判据、边界、未决问题）        | 右栏各面板的取舍                                 |
| 4   | 脚手架与淡出：脚手架是临时支持，过早撤除有害，过程须渐进                                                                                                                       | 未开题时给选题与深度说明，开题后让位给证据                            | 「研究选题」面板的 `v-if="!opened"`              |
| 5   | 示例学习 → 补全 → 独立（Renkl & Atkinson，[Structural Learning](https://www.structural-learning.com/post/worked-examples)）                                                    | 自检题先给问题、依据收在折叠里，不直接摊开答案                        | 「读后自检」的展开交互                           |
| 6   | 专长逆转效应（Kalyuga 等，同上来源）：同一支持会从"有帮助"变成"冗余负担"                                                                                                       | 帮助不常驻；收起后不再重复出现                                        | 自检依据默认全部收起                             |
| 7   | 认知负荷理论（Sweller，[Structural Learning](https://www.structural-learning.com/post/cognitive-load-theory-a-teachers-guide)）：分裂注意、冗余、瞬态信息                      | 每条结论只在**一处**出现；同一出处不在同一屏重复三遍                  | 正文说结论、右栏说证据，两处不重复表述           |
| 8   | 元认知调节（计划—监控—评价，[Learning Scientists](https://www.learningscientists.org/blog/2021/6/10-1)）                                                                       | 三个动作都要有落点：提问前选深度、进行中看环节、结束后做自检          | 深度选择器 + 进度 + 自检                         |
| 9   | 元记忆：学习判断依赖**流畅性**因而系统性失准（[Bjork Lab](https://bjorklab.psych.ucla.edu/research/)）                                                                         | 不能让"读起来顺"当成"我懂了"，必须有客观自测                          | 「读后自检」的四道题                             |
| 10  | 屏幕阅读的过度自信更强（Clinton，[Learning Scientists](https://www.learningscientists.org/blog/2019/9/12-1)）                                                                  | 屏幕上更要打断流畅错觉                                                | 同上，且计数（已答 / 共几题）显示在标题上        |
| 11  | Bloom 修订版与 Webb 的 DOK（[UARK TIPS](https://tips.uark.edu/using-blooms-taxonomy/)、[WebbAlign](https://www.webbalign.org/about/dok-explained)）                            | 提问深度先选、并列给出"这一档在问什么 / 要什么材料"；**不按动词定级** | `ResearchDepths` 与「提问深度」面板              |
| 12  | 测试效应（Roediger & Karpicke，[Bjork Lab](https://bjorklab.psych.ucla.edu/research/)）                                                                                        | 报告末尾必须有自测题，而不是只有摘要                                  | 「读后自检」                                     |
| 13  | 合意困难（Bjork）：生成、预测、前置测验有效，但**困难的组合可能次可加**                                                                                                        | 只加一层难度（先答后看），不同时叠加限时、计分等                      | 自检交互只做"先答后展开"                         |
| 14  | Toulmin 论证模型（[Purdue OWL](https://owl.purdue.edu/owl/general_writing/academic_writing/historical_perspectives_on_argumentation/toulmin_argument.html)）：限定与反驳不可省 | 每条结论都要有**限定**（置信度）与**反驳**（反证、否证条件）          | 证据的 `stance` / `confidence`；「什么会推翻它」 |
| 15  | CRAAP 与横向阅读（[CCCS](https://cccs.libguides.com/cccs-eval/craaptest)、[Civic Online Reasoning](https://cor.inquirygroup.org/)）：离开本页去别处核对                        | 证据卡要能回答"谁在背后 / 证据是什么 / 别处怎么说"                    | 出处清单：标题 + 立场 + 置信度 + 位置            |
| 16  | 有效失败（[Manu Kapur](https://www.manukapur.com/productive-failure/)）与生成效应                                                                                              | 关键分歧点上先让用户形成判断，再给整合后的结论                        | 「什么会推翻它」把判断条件先摆出来               |
| 17  | 分块与阅读行为（[NN/g](https://www.nngroup.com/articles/chunking/)）：用户实际只读完约两成                                                                                     | 段落要短、小节要有信息量、标题要能扫                                  | 右栏一律"一段一个意思"，列表化                   |
| 18  | 渐进披露（[NN/g](https://www.nngroup.com/articles/progressive-disclosure/)）：**超过两层通常不可用**                                                                           | 右栏只做一层披露，二级信息用提示气泡或就地展开                        | 出处清单不再嵌套；自检依据就地展开               |
| 19  | Mayer 的空间接近与一致性原则（[Dartmouth](https://services.dartmouth.edu/TDClient/1806/Portal/KB/PrintArticle?ID=171655)）                                                     | 图与说明同区；删装饰                                                  | 证据条目把标题、标签、位置放在同一块             |
| 20  | W3C COGA 简洁文本（[W3C WAI](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p05-succinct-text/)）                                                                        | 段首即要点、超长段落拆开                                              | 各面板 `xy-note` 的写法                          |

## 2. 心理学

| #   | 依据                                                                                                                                                                                                                               | 对本页的要求                                                   | 落点                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| 1   | 信任应当**校准**而非最大化：自动化偏差（Skitka 1999）、可靠性波动改变错误检出（Parasuraman 1993）、约 70% 可靠性的交叉点（Wickens & Dixon 2007），见 [PMC4221095](https://pmc.ncbi.nlm.nih.gov/articles/PMC4221095/)               | 不营造"全部核对无误"的观感；材料只找到一处时就说"单源"         | 证据标题上的「单源 / 已交叉验证」标签      |
| 2   | Microsoft HAX 准则 G2 / G10 / G11（[HAX](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)）：说清能力边界、存疑时收缩、说明原因                                                                                          | 明确写出**覆盖了什么、没覆盖什么**                             | 「资料边界」面板                           |
| 3   | IPCC 的校准语言：置信度与可能性是两套说法（[IPCC SROCC](https://www.ipcc.ch/srocc/chapter/chapter-1-framing-and-context-of-the-report/1-3time-scales-thresholds-and-detection-of-ocean-and-cryosphere-change/ipcc-srocc-ch_1_4/)） | 置信度给三档语言并**解释依据**，不给假精确的百分比             | `ConfidenceLabels`；出处清单的提示气泡     |
| 4   | 确认偏误与"考虑反面"（Noba JDM，[Noba](https://nobaproject.com/modules/judgment-and-decision-making)）                                                                                                                             | **反证与支持一样显眼**；并给出"什么会推翻它"                   | 证据计数里的「反证」；「什么会推翻它」面板 |
| 5   | 区间与不确定性的过度自信（Noba JDM，同上）                                                                                                                                                                                         | 写清"卡在哪里、影响什么"，不写"大致如此"                       | 「未决问题」面板                           |
| 6   | 知识错觉（illusion of explanatory depth）：以为自己懂了，其实只能复述标题                                                                                                                                                          | 自检题问的是机制（"为什么参与判定"），不是事实复述             | 四道自检题的措辞                           |
| 7   | 自我决定理论：自主、胜任、归属（[SDT](https://selfdeterminationtheory.org/theory/)）；认知评价理论：控制性外部奖励削弱内在动机                                                                                                     | 交还控制权（可选深度、可展开依据），**不做积分 / 连击 / 排名** | 深度选择器；无任何游戏化元素               |
| 8   | 进度指示：时长不可预知时**不要用百分比**，改显示已完成工作量（[NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)）                                                                                        | 进度按环节数与份数表述，不折算百分数                           | 「N / 4 步」与自检计数                     |
| 9   | 注意力与打断：工作记忆容量有限、切换有代价（[Noba 注意](https://nobaproject.com/modules/attention)）                                                                                                                               | 等待时**就地自更新**：不弹窗、不抢焦点、不响铃                 | 进度面板里的 `aria-live` 状态行            |
| 10  | 恢复状态（HAX G12，同 2）                                                                                                                                                                                                          | 回来立刻看得出"走到哪一步、还差什么"                           | 每个环节逐个标注判据                       |
| 11  | 说服的信任三角：权威外观 + 讨喜人格会让人**绕过论据核查**（[Noba 说服](https://nobaproject.com/modules/persuasion)）                                                                                                               | 权威性由可核查的位置承担，不由助手人格承担                     | 出处一律带 `来源位置`（`docs/…`、`src/…`） |
| 12  | LLM 谄媚：助手系统性迎合用户（[Sharma 等 2023](https://arxiv.org/abs/2310.13548)）                                                                                                                                                 | 结论允许与用户的预判相反；反证照列                             | 反证单列一栏，且默认可见                   |
| 13  | 记忆与认知卸载：卸载到外部载体是合理的，但"已保存"不等于"已理解"（[Noba 记忆](https://nobaproject.com/modules/memory-encoding-storage-retrieval)）                                                                                 | 报告可以查，但仍给"值得记住的三件事"，不强制复习               | 「值得记住的三件事」                       |
| 14  | 提取练习：先合上材料回想、再核对（[retrievalpractice.org](https://www.retrievalpractice.org/why-it-works)）                                                                                                                        | 依据默认收起，"先答后看"                                       | 「读后自检」的 `aria-expanded` 交互        |

未核实（不附数值）：Lee & See 2004、Parasuraman & Riley 1997、Dietvorst 2015、
Lord/Lepper/Preston 1984、Wason 2-4-6、Rozenblit & Keil 2002、Klein 1993、
Melnikoff & Bargh 2018、Risko & Gilbert 2016、Sparrow 等 2011、Nass & Moon 2000。

## 3. UI / 交互设计

| #   | 依据                                                                                                                                                 | 对本页的要求                                           | 落点                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| 1   | 渐进披露（[NN/g](https://www.nngroup.com/articles/progressive-disclosure/)）与 Shneiderman 的"总览优先"                                              | 结论在中间栏（宽度足够）、证据在右栏、原始片段点开才看 | 三栏分工；右栏不嵌二级面板                 |
| 2   | 右栏只允许**一层**披露（同上）                                                                                                                       | 出处清单扁平；置信度说明走 `ElTooltip` 而不是再套一层  | 出处清单结构                               |
| 3   | AI 可解释性：用户几乎不点引用、"思维链"多为事后合理化（[NN/g](https://www.nngroup.com/articles/explainable-ai/)）                                    | 不做"思考过程"面板，只给**可核对的位置**与局限         | 「研究进度」按环节，不按"想法"             |
| 4   | 引用要带"来源名 + 支撑摘要 + 位置"，禁止只写"来源"（同上）                                                                                           | 证据卡三件齐备                                         | `ChatCitation` 的 `title`/`note`/`source`  |
| 5   | 响应时间 0.1 / 1 / 10 秒（[NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)）                                              | 1 秒以上给状态；10 秒以上给可打断的出口                | 「正在核对材料」状态行 + 输入区的停止      |
| 6   | 进度条的非线性会改变"感觉快慢"（[Harrison 等 UIST 2007](https://www.chrisharrison.net/index.php/Research/ProgressBars)）                             | 不用会回退或跳动的百分比                               | 只报环节数与份数                           |
| 7   | 空态三准则与"错误的状态文案"（[NN/g](https://www.nngroup.com/articles/empty-state-interface-design/)）                                               | "还没有核对过的材料"与"出错"必须分开                   | 证据面板用 `ElEmpty`，不用红色告警         |
| 8   | 错误文案：发生了什么 + 为什么 + 下一步（[GOV.UK](https://design-system.service.gov.uk/patterns/problem-with-the-service-pages/)）                    | 本项目"零行表"写口径，不写成错误                       | 「未决问题」里零行表的写法                 |
| 9   | WCAG 1.4.1：不能只靠颜色（[W3C](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)）                                                     | 立场用"颜色 + 文字"双通道（`ElTag` 文案）              | 支持 / 反证 / 口径三档                     |
| 10  | WCAG 4.1.3 状态消息（[W3C](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)）                                                       | 等待状态用 `aria-live="polite"`                        | 状态行与自检依据                           |
| 11  | WCAG 2.4.13 焦点外观（[W3C](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)）                                                     | 自绘按钮要有可见焦点环                                 | `.research-checks__question:focus-visible` |
| 12  | `ElSteps` 不输出任何 ARIA（本地 `element-plus@2.14.7` 源码核验）                                                                                     | 环节文字必须**可见**，不能只靠图标与位置               | 每步都有标题 + 说明                        |
| 13  | 窄栏可视化：横向条 + 直接标数值（[Wilke](https://clauswilke.com/dataviz/visualizing-amounts.html)）                                                  | 计数用数字直排，不画图                                 | 证据计数三行                               |
| 14  | 只消费 `--el-*` 语义变量（`src/assets/main.css` 现有做法）                                                                                           | 不新增硬编码色值                                       | 全部样式                                   |
| 15  | 平实语言（[GOV.UK 内容设计](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/plan-manage-content/understand-content-design/)） | 动作即标签、状态即事实、不甩锅                         | 面板文案                                   |

未核实：Google PAIR People + AI Guidebook（两次抓取失败）、Material 3 / Apple HIG /
Atlassian 正文、Carbon 空态与加载页、Baymard 行宽正文、Cleveland & McGill 原始论文。

## 4. 需求 → 界面 → 代码

右栏自上而下的顺序**固定**为「研究进度 → 提问深度 → 证据 → 什么会推翻它 →
资料边界 → 未决问题 → 读后自检 → 值得记住的三件事 → 可用资料」，理由见
`ChatResearchView.vue` 的组件注释。

| 需求（简写）                 | 出处              | 落点                                    | 判据                             |
| ---------------------------- | ----------------- | --------------------------------------- | -------------------------------- |
| 分环节显示进度、探索期有说明 | 教育 1、2、8      | `.research-steps`                       | 每步有产出说明；未完成时给出判据 |
| 进度不用假百分比             | 心理 8、UI 5、6   | 标题上的「N / 4 步」                    | 界面无 `ElProgress` 百分条       |
| 先选提问深度                 | 教育 11           | `chat.depth` + `.research-depths`       | 四档各写"在问什么 / 要什么材料"  |
| 支持 / 反证分列              | 心理 4、12        | `.research-tally` + `.research-origins` | 反证与支持同层级、同显眼度       |
| 置信度三档并解释依据         | 心理 3            | `ConfidenceLabels` + `ElTooltip`        | 缺省按"中"计，不显示百分比       |
| 反证默认可见（不是折叠项）   | 心理 4            | `.research-origins`                     | 反证条目与其他条目同时渲染       |
| 结论带否证条件               | 教育 14、16       | 「什么会推翻它」的 `Disconfirming`      | 每条都有"若成立则结论改为什么"   |
| 明确能力边界                 | 心理 2、UI 8      | 「资料边界」的 `Boundaries`             | 已覆盖 / 未覆盖两栏都在          |
| 未决问题单独成栏             | 教育 8、心理 5    | 「未决问题」的 `OpenQuestions`          | 每条写"卡在哪 / 影响什么"        |
| 自检先答后看                 | 教育 5、9、12、13 | `revealed` + `.research-checks`         | 初始全部收起；有已答计数         |
| 值得记住的三件事             | 心理 13           | 「值得记住的三件事」                    | 三条，且每条能独立站住           |
| 非打断式等待                 | 心理 9、UI 5      | 状态行 `aria-live="polite"`             | 不弹窗、不抢焦点                 |
| 状态不只靠颜色               | UI 9              | `ElTag` 文案 + 图标                     | 三档立场各有文字                 |
| 只用语义变量                 | UI 14             | 全部样式                                | 无硬编码色值                     |

## 5. 接后端时改什么、不改什么

页面里现算的部分与写死的部分要分清：

- **现算**（`src/entity/research.ts`）：环节完成情况 `stageOf()`、进度 `progressOf()`、
  证据概览 `evidenceOf()`。判据只看消息流里已出现的东西——引用条目数、**按 `source`
  去重后的出处数**、反证条数、低置信度条数。接上检索任务后，把这三个函数换成读
  任务状态即可，页面与消息结构不用动；
- **写死**（`ChatResearchView.vue` 的 `Disconfirming` / `Boundaries` / `OpenQuestions` /
  `SelfChecks` / `Takeaways`）：它们是"这一页将来长什么样"的说明书，同时也是
  本项目主题下真实成立的内容。接上任务后应换成任务产出的字段。

`docs/design.md` 的链路仍然成立：这几组内容最终要落到某一层（`entity` 定义形状、
`store` 持有状态），页面只做渲染。本文件与 `ChatResearchView.vue` 的注释是这条
迁移路径的说明，迁移时不要连同判据一起抄进页面。
