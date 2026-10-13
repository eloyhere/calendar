# UI 重构进度与交接

> 这份文件记录**截至当前的实测状态**，不是计划。每条都指向可核对的证据
> （截图、脚本、源码位置）。下一次接手时从「二、下一步」开始即可。

---

## 一、已完成并验证

### 1. 外壳与导航

```
┌──────┬───────────────┬──────────────────────────┐
│ [◈]  │ 历法           │                          │
│      │  轩辕历         │                          │
│ 工作台│  朔望历 ←      │        内容               │
│ 智能体│  格里高利历     │                          │
│ 历法  │  …             │                          │
└──────┴───────────────┴──────────────────────────┘
 外层 ElMenu      子层 ElMenu
```

- **最左列**：`ElMenu` 的 `collapse` 形态（只出图标）。**左上角方块**是品牌图标 + 展开/收起按钮（`Ctrl+B` 同键）。
- **第二列**：`ElMenu` 竖向，用 `ElMenuItemGroup` 对域内页面分组。
- 九个域、四十条路由，登记表在 `src/entity/domain.ts`，启动时 `verifyDomainRoutes()` 校验（**只报告不抛错**——见「三、踩过的坑」第 2 条）。

### 2. 八套历法页：各自显示自己的年月

这是**返工过一轮**的地方。最初八套历法被做成"同一个公历月历换标签"，
用户指出"很多都是显示一样的"，已改正：

| 页面 | 页头主位 | 格子主行 | 一年几个月 |
| ---- | -------- | -------- | ---------- |
| 轩辕历 | **第 4723 年 · 九月大** | 农历日名（初一、初二…）| 12 |
| 节气表 | **第 4718 年 · 寒露** | 第 2 日、第 3 日… | **24** |
| 干支历 | 第 4718 年 · 酉月 | 第 N 日 | 12 |
| 木星历 | 第 399 年 · 二月 | 第 N 日 | 12（每月约 361 天）|

- 年月取自各自的 `*_year` / `*_month` 表（`relative` = 本历年号、`name` = 本历月名），
  实现在 `src/state/use-system-calendar.ts`。
- **光标是一个绝对时刻**（`absolute`），所以"翻一个月"在八套历法里各自正确
  （节气表走 15 天、木星历走 361 天），不必为每套写一遍。
- 格子上画了本历的月界：左粗线 = 月首、右粗线 = 月末、月外日子压暗。

证据：`docs/shots/calendar-natural.png`、`docs/shots/calendar-climate.png`。

### 3. 星历底座（返工过一轮）

**这是最重要的一处修正。** 原先 `positionsOf(absolute)` 内部用儒略日把秒数换成
`Date`，而那个换算与库自己的日期标签**差 23 天**。于是每一个星历调用者都在算
"23 天前那一刻"的天象。

修法：入口拆成两个，让"用哪个"成为显式选择。

```ts
positionsOfDate(date)   // 推荐：日期从 gregory_month 读
positionsOf(absolute)   // 近似：注释写明它偏 23 天
```

新增 `src/share/astronomy/civil-date.ts`（`civilOfAbsolute` 查库、`dateOfCivil` 用
`setFullYear` 拼 `Date`——`new Date(y,m,d)` 会把 0–99 年当成 19xx）。

四个调用点已换：复平面、七政四余、西方星盘、大六壬。

**验证方式（可重复）**：复平面页的太阳黄经。
10 月 13 日应为天秤 20° 左右，实测 **天秤 20.06°**；土星/天王/海王均为逆行，
符合 10 月的实际天象。证据：`docs/shots/sky-plane.png`。

### 4. 三处响应式修正

- **`PageShell` 不再销毁内容**：内容始终挂载，加载中是 `v-loading` 遮罩。
  只有"从没加载成功过"才换骨架屏 / 空态 / 错误态。
  这样翻月时滚动位置、`ElTable` 列宽、勾选状态都不丢。
- **该用选择器的不用表格**：本历的月（12–24 项）与换历法（8 项）改成 `ElSelect`。
- **密度**：`PageShell` 内边距 16/20→10/12；`.xy-panel` 14/16→10/12；
  `.xy-panel-title` 下边距 12→6；四柱从竖排四张高卡改**横排一行**（字号 28→18）。

### 5. 修掉的白屏与路径 bug

| 症状 | 根因 |
| ---- | ---- |
| 智能体对话页整个白屏 | 路由直接挂 `ChatPage.vue` 而它需要 `channel` prop，没人传。加了包装页 `view/agent/ChatView.vue` |
| 应用启动即白屏（40 条菜单全报错）| `verifyDomainRoutes()` 按字符串比路径，而路由表注册的是 `/calendar/:system/:view?`。改成参数匹配 + 只警告不抛错 |
| "分库文件不存在：src/sqlite/synodic.sqlite" | `app.getAppPath()` 返回的是**主脚本**所在目录，跑散装脚本时是 `scripts/`。改成多候选探测 |
| "找不到命令层目录 `scripts\scripts\operation`" | 同上，在 `main/workflow.ts` |
| 七政四余整页空白 | `astronomy-engine` 的枚举是 `"Mercury"`，代码写 `body.id as Astronomy.Body`——类型断言骗过编译器。改成显式映射表 `engineBodyOf()` |
| 地表投影页空白 | 同上，同一处代码的第二份拷贝 |

---

## 二、下一步（按价值排序）

1. **23 天偏差的源头**。目前只是**绕开**（凡是要真实日期的地方一律查库）。
   根因是 `absolute` 轴 ↔ 公历日期的换算与 `docs/design.md` 的建元口径不一致：

   | 时刻 | `absolute` | 库里标为 |
   | ---- | ---------- | -------- |
   | 建元 | 86400 | -2696-03-11 |
   | 2026-10-01 | 149029632000 | 2026-10-01 |

   两者相差 1,724,879 天，按儒略日算是 1,724,902 天——**少 23 天**。
   真正的修法在数据管线（重建各历法的日期标注，或订正文档锚点），
   会让 `temporal.days` 与置闰规则一起动，是另一个量级的改动。

2. **天象两页、命理四页、数术六页仍未做密度返工**，风格与历法页不统一。

   已实测出**具体是哪些文件**（用自有卡片类，所以不受全局 `.xy-panel` 改动影响）：

   ```
   src/view/divination/{Qimen,Liuren,Taiyi,Meihua,Dayan,Liuyao}View.vue   ← 六页
   src/view/history/CycleView.vue
   src/view/astrology/BaziView.vue                ← 已改过一轮，可作参照
   src/view/system/{SystemDatasource,SystemPerformance,SystemPermission,SystemSetting}.vue
   src/view/data/DataBrowser.vue
   src/view/agent/FlowRunView.vue
   ```

   **不受影响**（用全局 `.xy-panel`，已随那一轮改动自动收紧）：
   `view/agent/Chat{Create,Research,Survey,Thought,Topic}View.vue`、
   `view/data/DataExport.vue`、`view/numerology/NumerologyPage.vue`。

   返工配方（`BaziView.vue` 是已改好的样板，照着抄）：
   - 卡片内边距 `12px 14px` → `8px 10px`，圆角 `lg` → `md`
   - 卡片间隙 `12px` → `8px`
   - 大字号块（如四柱）改**横排一行**，字号 ≤ `--xy-font-xl`
   - 一组短值用「标签 + 值」并排一行，不用 `dt`/`dd` 两行制
   - 清单类（12–24 项且只有一项当前）改 `ElSelect`，不用表格或按钮排

   现成的可复用件：`component/domain/ChartScaffold.vue`（页头 + 起课输入 + 四柱条 + 待办块）、
   `component/domain/MomentPicker.vue`、`component/domain/DomainTable.vue`。

3. **四页的排盘算法仍是待办清单**（页面上逐条写明了，不是藏起来的）：
   紫微斗数安星、太乙积年、六爻六亲与卦宫、奇门定元与九宫排布。
   这些各家取法分歧大，需要先定流派。

4. **年表三页**（`/chronology/timeline`、`epoch`、`/calendar/table/*`）未做密度返工。

5. 窄窗口（< 1280）下八套历法页的表现未验。

---

## 三、踩过的坑（下次别再踩）

1. **`app.getAppPath()` 不是项目根**，是主脚本所在目录。凡是拼 `src/sqlite`、
   `scripts/operation` 这类路径都要多候选探测。已在 `main/database.ts` 与
   `main/workflow.ts` 各有一份 `resolve*`。
2. **导航配置错了不要抛错**。抛错会让整个应用白屏——正确的反应是"这一项不出现"。
   构建期用 `scripts/verify-nav.mjs` 当错误，运行时只警告。

   ⚠️ **而且"结构匹配"这一层单独用是拦不住拼写错误的**。第一次写的校验
   报"全部通过"，实际是恒真：兜底路由 `/:pathMatch(.*)*` 匹配任何路径，
   而 `:system` 是**自由参数**——`/calendar/synodik`（拼错一个字母）
   在结构上完全合法，运行时才由 `systemOf()` 返回 `undefined` → "没有这套历法"。
   现在 `verify-nav.mjs` 排除了兜底路由，并对 `:system` / `:page`
   做**参数取值校验**（取值集合从 `entity/calendar.ts` 与 `entity/domain.ts` 解析）。
   已实测：注入 `/calendar/synodik` 时退出码 1，还原后 0。
   反向自检在 `scripts/verify-nav-selftest.mjs`。
3. **`astronomy-engine` 的 `Body` 枚举是首字母大写的字符串**。
   `body.id as Astronomy.Body` 能通过编译但运行时抛 `Unknown body`。用显式映射表。
4. **本环境 Electron 的 `capturePage()` 在显示窗口下不返回**（会挂死）。
   可用的截图路径：`scripts/capture-log.cjs`（离屏 + 写日志文件轮询进度）。
   另：Electron 子进程的 stdout 在本环境里**不实时回传**，所以进度要写文件。
5. **`ELECTRON_RUN_AS_NODE=1` 在这个 shell 里是设着的**，直接跑 `electron` 会变成 node。
   用 `node_modules\electron\dist\electron.exe` 并先 `Remove-Item Env:\ELECTRON_RUN_AS_NODE`。
6. **`temporal` 表是事件表不是日历**：2026 年 10 月只覆盖 18 天。
   要稠密的逐日数据用 `gregory_month`（月首 + `lengthOfDay`）。
7. **SFC 里不能 `export`**（`<script setup>`），也不能在模板插值里写 `{{...}}` 字面量
   （会提前收尾）——`view/agent/FlowEditorView.vue` 里有两处这样的历史修复。
8. **`src/share/structure/{list,map}.ts` 的 `TSC6133/TSC6205` 是故意留的**：
   它们是待实现位置的占位，注释里写明了。不要用 `@ts-ignore` 消掉。

---

## 四、可用工具

| 脚本 | 用途 |
| ---- | ---- |
| `npm run verify` | **先跑这个**。导航 + 图标 + 结构三类校验，失败非零退出 |
| `npm run build` | `verify` → `typecheck` → `electron-vite build`，端到端通过 |
| `scripts/verify-nav.mjs` | 领域登记表的每条路径能否解析到路由 + **参数取值**校验 |
| `scripts/verify-nav-selftest.mjs` | 上一条的反向自检（证明它不是空转）|
| `scripts/verify-structure.mjs` | `share/structure` 三个结构的行为断言，含变异测试常用的边界 |
| `scripts/verify-icons.mjs` | 图标白名单与 `@element-plus/icons-vue` 导出是否对得上 |
| `scripts/capture-log.cjs` | 逐页截图验收（离屏、写 `capture.log`、带超时）|
| `scripts/probe-temporal-days.mjs` | 复现"`temporal` 是事件表"这件事 |
| `scripts/database/*` | 数据管线（22 个分库、98 张表、84,934,083 行）|
| `scripts/generate_*.py` | 重新生成数据访问层 / 文档 |

**注意**：Node 24 能直接 `import` `.ts`（类型擦除），所以 `verify-structure.mjs`
不需要 esbuild 或 ts-node。但会打一条 `MODULE_TYPELESS_PACKAGE_JSON` 警告——
给 `package.json` 加 `"type": "module"` 能消掉它，**但那会改变整个项目的
模块解析规则**，在 Electron 项目里风险不小，所以留着警告。

`node_modules\electron\dist\electron.exe` 是 Electron 本体；
`npx vue-tsc --noEmit -p tsconfig.web.json --composite false` 是类型检查。
