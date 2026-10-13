# calendar 数据分层设计契约

本文件是 `UI -> entity -> store -> service -> repository -> sql -> sqlite` 各层的唯一约定来源。
新增/修改任何一层，必须先改本文件。

## 1. 数据来源

两路数据源，互不覆盖：

1. **`calendar.xlsx`**（37 MB，24 个工作表）——朔望月（朔望年 / synodic）历表。
   每个工作表覆盖 1000 个"纪年块"，每块 12 或 13 个朔望月。
2. **历史资料**——朝代、年号、人物、事件。取自 zh.wikipedia「中国朝代」条目的渲染
   表格（朝代起讫）与「中国年号列表」条目（年号起讫、君主），经
   `scripts/parse_history.py`、`scripts/parse_dynasty_html.py` 机械解析，再由
   `scripts/build_history_data.py` 清洗、繁简转换（zh-cn 变体）后落到
   `database/data/{dynasty,era,event}.csv`。神话部分用传统纪年（黄帝元年 = -2697，
   与项目建元 -2696-03-11 相衔接）。

### 1.1 calendar.xlsx 的工作表

| 工作表     | 覆盖范围                 | 行数             |
| ---------- | ------------------------ | ---------------- |
| 前10 … 前1 | -9999 … -0001            | 每表 12370/12371 |
| 第1 … 第13 | 0001 … 13000             | 每表 12370/12371 |
| 第14       | 13001 … 约 13500（截断） | 6186             |

实测（`scripts/validate_full.py`）：

- 数据行合计 **290,654** 个朔望月，无重复、无乱序、无缺列。
- 每行 4 个月相（朔月/上弦/望月/下弦）始终齐全。
- 列 B 非空即"新年块开始"；块内 `积月` = 1,2,3…（块内序号）。
- 月名 `(闰)?(正月…腊月)(大|小)`，`大`=30 天、`小`=29 天，源自单元格公式 `O3=IF(C3="大",30,29)`。
- 全部时间戳为**天文纪年 proleptic 格里高利历**，可出现 0 年与负数年。

### 1.2 历史分期

| kind | 范围                                  | 说明                                                                    |
| ---- | ------------------------------------- | ----------------------------------------------------------------------- |
| 上古 | 盘古（-9999 … -2853）                 | 伏羲以前                                                                |
| 神话 | 伏羲 … 舜（-2852 … -2071）            | 伏羲是神话朝代的第一个年号                                              |
| 历史 | 夏 … 清                               | 年号按历史典籍                                                          |
| 现代 | 中华民国（1912-1949）、当代（1949- ） | 中华民国的年号是「民国」；当代年号为「」（空字符），故 `era` 表无当代行 |

多个朝代、多个年号**允许重叠**（三国、十六国、五代十国、辽宋金夏并立），
主键一律取 `start`，按起始先后分先后；同年起始的再各错 1 秒保证唯一。

### 1.1 列映射

| 列  | 表头             | 落到哪张表                                        |
| --- | ---------------- | ------------------------------------------------- |
| A   | （全空，未使用） | —                                                 |
| B   | 纪年块标签       | `synodic_calendar_year.gregorian_year`            |
| C   | 月名             | `synodic_month.name/label/ordinal/leap/size`      |
| D   | 朔月             | `synodic_month.start` + `phase(name=朔月)`        |
| E   | 上弦             | `phase(name=上弦)`                                |
| F   | 望月             | `phase(name=望月)`                                |
| G   | 下弦             | `phase(name=下弦)`                                |
| H   | 主节气           | `phenology(kind=1)`                               |
| I   | （主节气时刻）   | `phenology.start`                                 |
| J   | 主中气           | `phenology(kind=2)`                               |
| K   | （主中气时刻）   | `phenology.start`                                 |
| L   | 副节中气         | `phenology(kind=3)`                               |
| M   | （副节中气时刻） | `phenology.start`                                 |
| N   | 积月             | `synodic_month.relative`                          |
| O   | 月末积日         | `synodic_month.end` 推导依据（不直接存储，见 §3） |

## 2. 时间坐标系

- 建元（epoch）：`-2696-03-11 01:45:49`，当天为第 **1** 日。
- `days` = `jdn(时刻) - jdn(建元) + 1`，前一天为 -1、后一天为 2。
- `seconds` = 当天 00:00:00 起算的秒数，第一个为 0。
- `absolute` = `days * 86400 + seconds`，**全表统一的时间主键**，唯一且严格递增。
- **所有实体表的 `identity` 都是 `absolute`。** 区间一律 `[start, end)`。

`start` / `end` 都是 `temporal.absolute` 的外键；`end` 表示"最后一个瞬间"，即
`end = 下一区间起点 - 1`，因此查询用 `absolute BETWEEN start AND end`。

## 3. 文件布局与实体对应

**一个实体一套文件，一个实体一个 `.sqlite`。** 目录即层次：

```
src/entity/<entity>.ts                实体定义
src/sqlite/<entity>.sqlite            该实体的数据库文件（一个实体一个文件，此目录只放 .sqlite）
database/sql/<entity>/table.sql       该实体的建表语句
database/sql/<entity>/data.sql        该实体的数据初始化语句
src/sql/<entity>.sql                  该实体的数据查询语句（12 条标准查询）
src/datasource/<entity>.sqlite.ts     数据访问层（镜像上面的查询语句 + 驱动接缝）
                                      一个实体有多张表时按表拆分：<entity>.<table>.sqlite.ts
                                      （如 astronomy.year.sqlite.ts、astronomy.month.sqlite.ts）
src/repository/<entity>.repository.ts
src/service/<entity>.service.ts
src/store/<entity>.store.ts
src/view/<Domain>View.vue              域出口：只写一个 <RouterView/>，把渲染委托给下级
                                       （CalendarView.vue、AgentView.vue …）
src/view/<domain>/<Page>View.vue       该实体真正要写内容的页面，一页一文件
                                       （calendar/astronomy/EntryView.vue、DataView.vue …）
database/<entity>.py                  该实体的建表 + 装数逻辑
scripts/database/<entity>.py          该实体的初始化脚本（调用上面的逻辑，建出 .sqlite）
                                      scripts/database/initialise.py 按依赖顺序调用全部实体脚本
```

**`src/sqlite/` 只放数据库文件**，不放任何文本；建表与初始化在 `database/sql/`，
查询在 `src/sql/`。三处文件名都与实体同名。

一个实体内若有多张紧密相关的表（例如朔望年与朔望月），它们同处一个 `.sqlite`。

| `database/<entity>.py` | `src/sqlite/<entity>.sqlite` | 实体（`src/entity/`）                           | 表                                       | 行数                |
| ---------------------- | ---------------------------- | ----------------------------------------------- | ---------------------------------------- | ------------------- |
| `temporal.py`          | `temporal.sqlite`            | `temporal.ts` `Temporal`                        | `temporal`                               | 10,734,114          |
| `phenology.py`         | `phenology.sqlite`           | `phenology.ts` `Phenology`                      | `phenology`                              | 564,000             |
| `phase.py`             | `phase.sqlite`               | `phase.ts` `Phase`                              | `phase`                                  | 1,162,616           |
| `part.py`              | `part.sqlite`                | `part.ts` `Part`                                | `part`                                   | 871,962             |
| `week.py`              | `week.sqlite`                | `week.ts` `Week`                                | `week`                                   | 1,453,271           |
| `synodic.py`           | `synodic.sqlite`             | `synodic.ts` `SynodicYear`/`SynodicMonth`       | `synodic_calendar_year`, `synodic_month` | 23,500 / 290,654    |
| `primary.py`           | `primary.sqlite`             | `primary.ts` `Primary`                          | `primary`                                | 2                   |
| `encounter.py`         | `encounter.sqlite`           | `encounter.ts` `Encounter`                      | `encounter`                              | 3                   |
| `perform.py`           | `perform.sqlite`             | `perform.ts` `Perform`                          | `perform`                                | 66                  |
| `epoch.py`             | `epoch.sqlite`               | `epoch.ts` `Epoch`                              | `epoch`                                  | 784                 |
| `dynasty.py`           | `dynasty.sqlite`             | `dynasty.ts` `Dynasty`                          | `dynasty`                                | 89                  |
| `era.py`               | `era.sqlite`                 | `era.ts` `Era`                                  | `era`                                    | 1,184               |
| `person.py`            | `person.sqlite`              | `event.ts` `Person`                             | `person`                                 | 425                 |
| `event.py`             | `event.sqlite`               | `event.ts` `Event`                              | `event`                                  | 2,379               |
| `astronomy.py`         | `astronomy.calendar.sqlite`  | `astronomy.ts` `AstronomyYear`/`AstronomyMonth` | `astronomy_year`, `astronomy_month`      | 23,500 / 290,654    |
| `climate.py`           | `climate.sqlite`             | `climate.ts` `Climate`/`ClimateYear`/`ClimateMonth` | `climate`, `climate_year`, `climate_month` | 1,743,926 / 23,449 / 564,000 |
| `gregory.py`           | `gregory.calendar.sqlite`    | `gregory.ts` `GregoryYear`/`GregoryMonth`       | `gregory_year`, `gregory_month`          | 23,501 / 281,998    |
| `jupiter.py`           | `jupiter.calendar.sqlite`    | `jupiter.ts` `JupiterYear`/`JupiterMonth`       | `jupiter_year`, `jupiter_month`          | 1,982 / 23,774      |
| `natural.py`           | `natural.calendar.sqlite`    | `natural.ts` `NaturalYear`/`NaturalMonth`       | `natural_year`, `natural_month`          | 23,500 / 290,654    |
| `tree.py`              | `tree.calendar.sqlite`       | `tree.ts` `TreeYear`/`TreeMonth`                | `tree_year`, `tree_month`                | 23,449 / 281,273    |
| `tropical.py`          | `tropical.calendar.sqlite`   | `tropical.ts` `TropicalYear`/`TropicalMonth`    | `tropical_year`, `tropical_month`        | 23,500 / 281,998    |
| `chronology.py`        | `chronology.sqlite`          | `chronology.ts` `Chronology`                    | `chronology`                             | 23,500              |

合计 22 个数据库、98 张表、84,934,083 行（其中实体表 19,029,707 行，
其余是 `src/entity/*.ts` 里复数属性对应的关联表）。

七部派生历法（`astronomy` / `climate` 的节气纪年 / `gregory` / `jupiter` / `natural` /
`tree` / `tropical`）的年、月由 **`database/calendars.py`** 换算得来，年界与月界的规则
逐条写在该模块的表里：`gregory` / `climate` / `tree` 完全由工作簿推出；`natural` 的年
就是朔望年的纪年块（建元当天恰为「轩辕 1 年 1 月 1 日」）；`tropical` / `astronomy` /
`jupiter` 没有星历表，用各自 `RULE` 给出的**平均**周期（365.2422 日、11.862 年）从建元起算。

**`chronology` 与八部历法的年表一一对应**（`src/entity/chronology.ts`）：一个朔望年一条，
八列年（`astronomy` / `climate` / `gregory` / `jupiter` / `natural` / `tree` / `tropical` /
`synodic`）各取「**纪年首所在**」的那一年 —— 一个朔望年约 354 天、可能跨历法年，
故以 `start` 定归属，与 `calendar.xlsx` 的纪年块标签取「块首所在年份」同一口径；
八列 `lengthOf<X>Month` 是那一年的月数，与各年表的 `lengthOfMonth` 同值。
因此 `chronology` 必须排在七部派生历法**之后**建库（`STORE_ORDER` 的最后一位）。

### 3.1 跨库关联

SQLite 不支持跨文件外键，因此各分库之间**不施加外键约束**，关联只在这些地方记录：

- 本文件的表格；
- 各 `src/sql/<entity>.sql` 的表头注释；
- 各 `database/sql/<entity>/table.sql` 的表头注释。

需要跨实体查询时，用 `database/combine.py` 把分库合并成全库
`src/sqlite/calendar.sqlite`（该文件是派生产物，可随时重建）。

**关联表在第二遍填**（`database/store.py` 的 `finish_associations()`）：实体属性名是复数的
字段落成 `<父表>_<复数>` 关联表，两端按时间区间相交算出来。关联表的另一端的模块**未必**
排在它前面 —— `primary_performs` 的父端 `primary` 先建、子端 `perform` 后建；
`synodic_month_weeks` 的子端 `week` 也排在 `synodic` 之后。因此建库分两遍：
先把 22 个模块的表结构与行数据写完，再统一填关联表，最后回写各库的 `_meta`。
单独建一个实体（`scripts/database/<entity>.py`）时，只补填本实体的关联表，
另一端的分库若不存在，该关联表记 0 行。

关联表两端列里存的是**父表 / 目标表真实的 `identity`**，因此 `database/association.py`
用 `batch_write` 直接落库，不走 `write_table()` 的业务键换算 —— `primary` / `encounter` /
`perform` / `epoch` 的业务键恰好是"全局序号"，与自增 identity 落在同一段小区间里，
二次换算会把它们整体错位。

### 3.2 每个分库都带 `_meta`

为了能逐个核对来源，除实体表外，每个 `.sqlite` 里都有一张 `_meta` 表，
记录 `module / source / source_sha256 / built_at / tables / rows / counts`。
它属于构建元数据，不对应实体，也不参与各层映射。

### 3.3 历史实体的时间精度

历史资料只精确到年，因此 `dynasty` / `era` / `person` / `event` 的
`start` 取该年 1 月 1 日 00:00:00、`end` 取该年 12 月 31 日 23:59:59；
尚未终结的朝代（当代）`end_year` 与 `end` 都记 0。
这些时间点同样收录在 `temporal` 里，所以 `start`/`end` 依然是 `temporal.identity` 的外键。

## 4. 元会运世层级

建元所在的**朔望年**为第 1 会 / 第 1 运 / 第 1 世。单位换算（以 `src/entity/*.ts` 为准，
四份实体都写的是**朔望年**）：

```
1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望年
1 会 = 30 运 = 360 世 = 10800 朔望年
1 运 = 12 世 = 360 朔望年
1 世 = 30 朔望年
```

切分单位是**朔望年**（源表的一个纪年块），不是朔望月：一个朔望年含 12 或 13 个朔望月，
长度不固定，因此同一层各组含的月数也不恒定（一个世含 360–390 个朔望月）。
组的 `start` / `end` 仍取首月月首与末月月末，所以照样落在 `temporal` 已有时间点上。

全局年号 = 源表列 B 的纪年块标签 `+ 2697`：建元 `-2696-03-11 01:45:49` 当天正是纪年块
`-2696` 的正月月首，于是「建元所在的朔望年」是第 1 年 —— 与 `natural.calendar`
（轩辕纪年 1 年）用的是同一个年号。

`epoch` 由 `synodic_calendar_year` 每 30 个朔望年一组推导，因此与 `calendar.xlsx` 严格一致，
不存在人为编造的历史数据。

## 5. 命名约定

- Python：`database/<entity>.py`，每个模块提供 `create(connection)` 与 `load(connection, workbook)`；
  表结构集中声明在 `database/schema.py`，`src/sqlite/*.sql` 由它生成，避免两处漂移。
- 数据库：`src/sqlite/<entity>.sqlite`，一个实体一个文件。
- SQL：`database/sql/<entity>/table.sql`（建表）、`database/sql/<entity>/data.sql`（数据初始化）、
  `src/sql/<entity>.sql`（12 条标准查询）。三处文件名都与实体同名。
- TypeScript：`src/<layer>/<entity>.<layer>.ts`，类名 `<Entity><Layer>`，
  例如 `SynodicRepository`、`PhenologyService`、`useSynodicMonthStore`。
  实体模块名用点或下划线（`astronomy.calendar`、`climate_year`），类名用大驼峰
  （`AstronomyYearRepository`）。
- 数据访问层：`src/datasource/<entity>.sqlite.ts` 镜像 `src/sql/<entity>.sql` 的 12 条语句。
  一个模块有多张表时按 `-- 表 <name>` 分节**一表一个文件**，文件名 `<entity>.<table>.sqlite.ts`
  （表名去掉实体前缀：`astronomy_year` -> `year`、`synodic_calendar_year` -> `calendar_year`）——
  12 条语句在每张表下同名，抄进同一个 TS 模块就是重名导出（TS2451）。
  类名按表命名（`AstronomyYearSqlite` / `AstronomyMonthSqlite`），但 `name` 与 `runnerOf`
  仍是实体模块名（`astronomy`），因为一个实体只有一个 `.sqlite` 文件。
  全部由 `scripts/generate_datasource.py` 生成。
- Vue：`src/view/`，一个域一个子目录（`view/calendar/<entity>/`、`view/numerology/` …），
  域本身是 `view/<Domain>View.vue` 的透传出口。路由表在 `src/plugin/router.ts`，
  菜单由路由表推导（`src/plugin/menu.ts`），页面壳是
  `src/component/PageShell.vue`。完整分层见 `src/plugin/README.md`。
  文件命名统一 `<名字>.vue` 的**大驼峰**形式（`EntryView.vue`、`AppHeader.vue`），
  与 `database/sql/` 下的小写文件名区分开：TS/Vue 侧一律大驼峰，Python/SQL 侧一律小写。

## 6. SQL 查询契约（每个实体一套）

`src/sql/<entity>.sql` 必须含以下命名语句，`repository` 一一对应：

| 语句名                | 方法                           |
| --------------------- | ------------------------------ |
| `count`               | `count()`                      |
| `countBy`             | `countBy(example)`             |
| `existsByIdentity`    | `existsByIdentity(id)`         |
| `existsBy`            | `existsBy(example)`            |
| `findAll`             | `findAll(query)`               |
| `findAllByIdentities` | `findAllByIdentities(ids)`     |
| `findByIdentity`      | `findByIdentity(id)`           |
| `findBy`              | `findBy(example)`              |
| `findFirstBy`         | `findFirstBy(example, sort?)`  |
| `findOne`             | `findOne(example)`             |
| `selectByIdentity`    | `selectByIdentity(id, fields)` |
| `selectBy`            | `selectBy(example, fields)`    |

条件一律写成"可选参数"形态，未给条件时绑 `NULL`、该条件自动失效：

```sql
WHERE 1 = 1
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:startStart IS NULL OR :startEnd IS NULL
         OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
```

`example` 支持三种条件，与 `src/repository/repository.ts` 一致：

- 等值：`:col`
- 区间：`:colStart` / `:colEnd`，半开区间 `[start, end)`
- 模糊：`:colLike`，仅文本列

排序与投影无法用绑定参数，改为在 SQL 内按列名白名单枚举。**必须用"搜索式 CASE"
（`CASE WHEN :sortColumn = 'col' THEN "col"`），不能用简单 CASE**
（`CASE :sortColumn WHEN :sortColumn = 'col' THEN`）——后者会被解析成
`:sortColumn = (:sortColumn = 'col')`，永远不成立，排序会全部落到 ELSE。
方向由两个互斥的 CASE 顶起，只有一个会命中：

```sql
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
```

**所有 SQL 里出现的表名与列名必须与 §3 完全一致**，不得自造字段。

## 7. 生成与校验入口

```bash
python database/build.py calendar.xlsx --out src/sqlite   # 逐实体建库（一次调用建全部）
python scripts/database/initialise.py                     # 同上，但一实体一脚本：scripts/database/<entity>.py
python database/sqlfiles.py --with-data                   # 建表 + 初始化 + 查询 SQL
python scripts/generate_datasource.py                     # 由 src/sql/*.sql 生成数据访问层
python database/verify.py                                 # 22 个分库自检 + 跨库关联核对
python database/combine.py                                # 合并成全库，供跨表分析
```

`scripts/database/` 是初始化的脚本层：一个实体一个文件（`<entity>.py`，写清实体名、中文名与依赖），
`initialise.py` 按 `database/store.py` 的 `STORE_ORDER` 依次调用它们 —— 顺序即依赖顺序，
`temporal` 提供全库时间点，`primary` → `encounter` → `perform` → `epoch` 逐级提供父级 identity。
每个脚本也能单独运行，只建自己那一个库：

```bash
python scripts/database/temporal.py --out src/sqlite      # 只建 temporal.sqlite
python scripts/database/initialise.py --list              # 列出实体与对应脚本（不建库）
python scripts/database/initialise.py --only primary encounter perform epoch
```
