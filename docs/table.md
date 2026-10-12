# calendar 表结构清单

`src/sqlite/` 下每个分库一张不落地列在这里：22 个库、98 张表、32,736,171 行。

本文件由 `scripts/generate_table_doc.py` 遍历项目生成，**不要手改**；结构或行数变了就重跑一次：

```bash
python scripts/generate_table_doc.py
```

数据来源按优先级：

1. 结构、索引与行数只认数据库本身——`PRAGMA table_info` / `index_list` / `index_info` 与 `COUNT(*)`；
2. 中文说明与引用关系取自 `database/schema.py`（`Table.comment`、`Table.note`、`Column.note`、`Column.references`）；
3. 两边不一致时以库为准，差异全部记在文末「§6 差异」。

表分两类：**实体表**（一张表对应一个 entity 接口）与**关联表**（entity 里复数命名的属性，见 §3）。

生成时间：2026-10-13 06:18。

## 1. 列的含义

| 列 | 取值 | 含义 |
| --- | --- | --- |
| name | 列名 | 与 `database/schema.py`、`src/sql/*.sql` 里的列名逐字一致 |
| type | integer / text | SQLite 亲和类型；`bigint` 与 `boolean` 落库都是 integer（64 位整数 / 0-1） |
| primary key | yes / no | 是否主键。98 张实体表的主键一律叫 `identity`，只有 `_meta` 是 `key` |
| auto increment | yes / no | 是否 `INTEGER PRIMARY KEY AUTOINCREMENT`：插入时不绑定该列，由数据库生成，删号不复用 |
| key | yes / no / NA | 该列是否出现在某个显式索引里（不限位置）；主键行记 NA——主键自带的唯一索引不重复计 |
| index | yes / no / NA | 是否存在以该列为**首列**的显式索引（可直接用于前缀查找）；主键行同上记 NA |
| comment | 中文说明 / — | 列说明，取自 `database/schema.py` 的 `Column.note`；schema.py 里没有的列记 — |

### `lengthOf*` 的口径

`lengthOfX` 一律是**本区间内含有多少个 X 单位，向 0 取整**——不是秒，也不是「X 单位本身的长度」：

| 列 | X | 例 |
| --- | --- | --- |
| `lengthOfDay` | 天 | 朔望月 29.53 天 → 29；一周 → 7 |
| `lengthOfWeek` | 周（7 天） | 5 天的相 / 气候 → 0；29.53 天的月 → 4 |
| `lengthOfPart` | 旬（10 天） | 5 天的相 → 0；29.53 天的月 → 2 |
| `lengthOfPhenology` | 候（5 天） | 一个候 → 1；29.53 天的月 → 5 |
| `lengthOfMonth` | 月 | 一年 365.2422 天 → 12 |

### 模块名里的点

一个模块一个 `.sqlite`。七部派生历法的年 / 月表放在 `<历法>.calendar` 模块里，用点与同名表区分（例如 `astronomy.calendar` 的年月表不与别的表撞名）。`climate` 是唯一的例外——气候表 `climate` 与节气纪年的 `climate_year` / `climate_month` 同属模块 `climate`，共用一个 `climate.sqlite`。

不进清单的表：`sqlite_sequence`（有 AUTOINCREMENT 就有）、`sqlite_stat1`（ANALYZE 产物）——两者都是 SQLite 引擎自带；`_meta` 是构建元数据，见 §5。

## 2. 总览

| 数据库 | 模块 | 实体表 | 关联表 | 行数 | 建库时间 |
| --- | --- | --- | --- | --- | --- |
| astronomy.calendar.sqlite | `astronomy.calendar` | `astronomy_year`、`astronomy_month` | `astronomy_month_parts`、`astronomy_month_phenologies`、`astronomy_month_weeks`、`astronomy_year_months`、`astronomy_year_parts`、`astronomy_year_phenologies`、`astronomy_year_weeks` | 0 | 2026-10-13 03:48:51 |
| chronology.sqlite | `chronology` | `chronology` | — | 0 | 2026-10-13 03:48:45 |
| climate.sqlite | `climate` | `climate`、`climate_year`、`climate_month` | `climate_month_parts`、`climate_month_phenologies`、`climate_month_weeks`、`climate_parts`、`climate_weeks`、`climate_year_months`、`climate_year_parts`、`climate_year_phenologies`、`climate_year_weeks` | 6,394,394 | 2026-10-13 03:47:47 |
| dynasty.sqlite | `dynasty` | `dynasty` | `dynasty_chronologies`、`dynasty_eras` | 10,719 | 2026-10-13 04:09:11 |
| encounter.sqlite | `encounter` | `encounter` | `encounter_performs` | 836 | 2026-10-13 04:09:10 |
| epoch.sqlite | `epoch` | `epoch` | `epoch_chronologies` | 9,689 | 2026-10-13 04:09:10 |
| era.sqlite | `era` | `era` | `era_chronologies` | 1,184 | 2026-10-13 03:48:45 |
| event.sqlite | `event` | `event` | — | 2,379 | 2026-10-13 03:48:45 |
| gregory.calendar.sqlite | `gregory.calendar` | `gregory_year`、`gregory_month` | `gregory_month_parts`、`gregory_month_phenologies`、`gregory_month_weeks`、`gregory_year_months`、`gregory_year_parts`、`gregory_year_phenologies`、`gregory_year_weeks` | 0 | 2026-10-13 03:48:57 |
| jupiter.calendar.sqlite | `jupiter.calendar` | `jupiter_year`、`jupiter_month` | `jupiter_month_parts`、`jupiter_month_phenologies`、`jupiter_month_weeks`、`jupiter_year_months`、`jupiter_year_parts`、`jupiter_year_phenologies`、`jupiter_year_weeks` | 0 | 2026-10-13 03:49:03 |
| natural.calendar.sqlite | `natural.calendar` | `natural_year`、`natural_month` | `natural_month_parts`、`natural_month_phenologies`、`natural_month_weeks`、`natural_year_months`、`natural_year_parts`、`natural_year_phenologies`、`natural_year_weeks` | 0 | 2026-10-13 03:49:09 |
| part.sqlite | `part` | `part` | — | 871,962 | 2026-10-13 03:48:38 |
| perform.sqlite | `perform` | `perform` | `perform_epoches` | 10,497 | 2026-10-13 04:09:10 |
| person.sqlite | `person` | `person` | — | 425 | 2026-10-13 03:48:45 |
| phase.sqlite | `phase` | `phase` | `phase_parts`、`phase_weeks` | 7,203,280 | 2026-10-13 03:48:31 |
| phenology.sqlite | `phenology` | `phenology` | — | 564,000 | 2026-10-13 03:46:59 |
| primary.sqlite | `primary` | `primary` | `primary_performs` | 811 | 2026-10-13 04:09:10 |
| synodic.sqlite | `synodic` | `synodic_calendar_year`、`synodic_month` | `synodic_calendar_year_months`、`synodic_calendar_year_parts`、`synodic_calendar_year_phenologies`、`synodic_calendar_year_weeks`、`synodic_month_parts`、`synodic_month_phenologies`、`synodic_month_weeks` | 6,652,001 | 2026-10-13 04:09:08 |
| temporal.sqlite | `temporal` | `temporal` | — | 9,560,723 | 2026-10-13 03:45:59 |
| tree.calendar.sqlite | `tree.calendar` | `tree_year`、`tree_month` | `tree_month_parts`、`tree_month_phenologies`、`tree_month_weeks`、`tree_year_months`、`tree_year_parts`、`tree_year_phenologies`、`tree_year_weeks` | 0 | 2026-10-13 03:49:16 |
| tropical.calendar.sqlite | `tropical.calendar` | `tropical_year`、`tropical_month` | `tropical_month_parts`、`tropical_month_phenologies`、`tropical_month_weeks`、`tropical_year_months`、`tropical_year_parts`、`tropical_year_phenologies`、`tropical_year_weeks` | 0 | 2026-10-13 03:49:23 |
| week.sqlite | `week` | `week` | — | 1,453,271 | 2026-10-13 03:48:44 |
| **合计** | 22 个库 | 31 张 | 67 张 | 32,736,171 | — |

## 3. 关系表（entity 的复数属性 → ManyToMany）

规则：`src/entity/*.ts` 里**属性名是复数的**（`months` / `phenologies` / `weeks` / `parts` / `eras` / `chronologies` / `performs` / `epoches`）表示集合，**不是父表的列**，而是一张独立的关联表 `<父表>_<属性名>`：`identity` 自增主键 + 父端列 + 子端列，两列各建索引，与父表同库。两端常常跨库，SQLite 不施加外键约束。

| 关联表 | 库（模块） | 父端 | 子端 | entity 属性 |
| --- | --- | --- | --- | --- |
| `astronomy_month_parts` | `astronomy.calendar` | `month` → `astronomy_month.identity` | `part` → `part.identity` | `parts` |
| `astronomy_month_phenologies` | `astronomy.calendar` | `month` → `astronomy_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `astronomy_month_weeks` | `astronomy.calendar` | `month` → `astronomy_month.identity` | `week` → `week.identity` | `weeks` |
| `astronomy_year_months` | `astronomy.calendar` | `year` → `astronomy_year.identity` | `month` → `astronomy_month.identity` | `months` |
| `astronomy_year_parts` | `astronomy.calendar` | `year` → `astronomy_year.identity` | `part` → `part.identity` | `parts` |
| `astronomy_year_phenologies` | `astronomy.calendar` | `year` → `astronomy_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `astronomy_year_weeks` | `astronomy.calendar` | `year` → `astronomy_year.identity` | `week` → `week.identity` | `weeks` |
| `climate_month_parts` | `climate` | `month` → `climate_month.identity` | `part` → `part.identity` | `parts` |
| `climate_month_phenologies` | `climate` | `month` → `climate_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `climate_month_weeks` | `climate` | `month` → `climate_month.identity` | `week` → `week.identity` | `weeks` |
| `climate_parts` | `climate` | `climate` → `climate.identity` | `part` → `part.identity` | `parts` |
| `climate_weeks` | `climate` | `climate` → `climate.identity` | `week` → `week.identity` | `weeks` |
| `climate_year_months` | `climate` | `year` → `climate_year.identity` | `month` → `climate_month.identity` | `months` |
| `climate_year_parts` | `climate` | `year` → `climate_year.identity` | `part` → `part.identity` | `parts` |
| `climate_year_phenologies` | `climate` | `year` → `climate_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `climate_year_weeks` | `climate` | `year` → `climate_year.identity` | `week` → `week.identity` | `weeks` |
| `dynasty_chronologies` | `dynasty` | `dynasty` → `dynasty.identity` | `chronology` → `chronology.identity` | `chronologies` |
| `dynasty_eras` | `dynasty` | `dynasty` → `dynasty.identity` | `era` → `era.identity` | `eras` |
| `encounter_performs` | `encounter` | `encounter` → `encounter.identity` | `perform` → `perform.identity` | `performs` |
| `epoch_chronologies` | `epoch` | `epoch` → `epoch.identity` | `chronology` → `chronology.identity` | `chronologies` |
| `era_chronologies` | `era` | `era` → `era.identity` | `chronology` → `chronology.identity` | `chronologies` |
| `gregory_month_parts` | `gregory.calendar` | `month` → `gregory_month.identity` | `part` → `part.identity` | `parts` |
| `gregory_month_phenologies` | `gregory.calendar` | `month` → `gregory_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `gregory_month_weeks` | `gregory.calendar` | `month` → `gregory_month.identity` | `week` → `week.identity` | `weeks` |
| `gregory_year_months` | `gregory.calendar` | `year` → `gregory_year.identity` | `month` → `gregory_month.identity` | `months` |
| `gregory_year_parts` | `gregory.calendar` | `year` → `gregory_year.identity` | `part` → `part.identity` | `parts` |
| `gregory_year_phenologies` | `gregory.calendar` | `year` → `gregory_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `gregory_year_weeks` | `gregory.calendar` | `year` → `gregory_year.identity` | `week` → `week.identity` | `weeks` |
| `jupiter_month_parts` | `jupiter.calendar` | `month` → `jupiter_month.identity` | `part` → `part.identity` | `parts` |
| `jupiter_month_phenologies` | `jupiter.calendar` | `month` → `jupiter_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `jupiter_month_weeks` | `jupiter.calendar` | `month` → `jupiter_month.identity` | `week` → `week.identity` | `weeks` |
| `jupiter_year_months` | `jupiter.calendar` | `year` → `jupiter_year.identity` | `month` → `jupiter_month.identity` | `months` |
| `jupiter_year_parts` | `jupiter.calendar` | `year` → `jupiter_year.identity` | `part` → `part.identity` | `parts` |
| `jupiter_year_phenologies` | `jupiter.calendar` | `year` → `jupiter_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `jupiter_year_weeks` | `jupiter.calendar` | `year` → `jupiter_year.identity` | `week` → `week.identity` | `weeks` |
| `natural_month_parts` | `natural.calendar` | `month` → `natural_month.identity` | `part` → `part.identity` | `parts` |
| `natural_month_phenologies` | `natural.calendar` | `month` → `natural_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `natural_month_weeks` | `natural.calendar` | `month` → `natural_month.identity` | `week` → `week.identity` | `weeks` |
| `natural_year_months` | `natural.calendar` | `year` → `natural_year.identity` | `month` → `natural_month.identity` | `months` |
| `natural_year_parts` | `natural.calendar` | `year` → `natural_year.identity` | `part` → `part.identity` | `parts` |
| `natural_year_phenologies` | `natural.calendar` | `year` → `natural_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `natural_year_weeks` | `natural.calendar` | `year` → `natural_year.identity` | `week` → `week.identity` | `weeks` |
| `perform_epoches` | `perform` | `perform` → `perform.identity` | `epoch` → `epoch.identity` | `epoches` |
| `phase_parts` | `phase` | `phase` → `phase.identity` | `part` → `part.identity` | `parts` |
| `phase_weeks` | `phase` | `phase` → `phase.identity` | `week` → `week.identity` | `weeks` |
| `primary_performs` | `primary` | `primary` → `primary.identity` | `perform` → `perform.identity` | `performs` |
| `synodic_calendar_year_months` | `synodic` | `year` → `synodic_calendar_year.identity` | `month` → `synodic_month.identity` | `months` |
| `synodic_calendar_year_parts` | `synodic` | `year` → `synodic_calendar_year.identity` | `part` → `part.identity` | `parts` |
| `synodic_calendar_year_phenologies` | `synodic` | `year` → `synodic_calendar_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `synodic_calendar_year_weeks` | `synodic` | `year` → `synodic_calendar_year.identity` | `week` → `week.identity` | `weeks` |
| `synodic_month_parts` | `synodic` | `month` → `synodic_month.identity` | `part` → `part.identity` | `parts` |
| `synodic_month_phenologies` | `synodic` | `month` → `synodic_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `synodic_month_weeks` | `synodic` | `month` → `synodic_month.identity` | `week` → `week.identity` | `weeks` |
| `tree_month_parts` | `tree.calendar` | `month` → `tree_month.identity` | `part` → `part.identity` | `parts` |
| `tree_month_phenologies` | `tree.calendar` | `month` → `tree_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `tree_month_weeks` | `tree.calendar` | `month` → `tree_month.identity` | `week` → `week.identity` | `weeks` |
| `tree_year_months` | `tree.calendar` | `year` → `tree_year.identity` | `month` → `tree_month.identity` | `months` |
| `tree_year_parts` | `tree.calendar` | `year` → `tree_year.identity` | `part` → `part.identity` | `parts` |
| `tree_year_phenologies` | `tree.calendar` | `year` → `tree_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `tree_year_weeks` | `tree.calendar` | `year` → `tree_year.identity` | `week` → `week.identity` | `weeks` |
| `tropical_month_parts` | `tropical.calendar` | `month` → `tropical_month.identity` | `part` → `part.identity` | `parts` |
| `tropical_month_phenologies` | `tropical.calendar` | `month` → `tropical_month.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `tropical_month_weeks` | `tropical.calendar` | `month` → `tropical_month.identity` | `week` → `week.identity` | `weeks` |
| `tropical_year_months` | `tropical.calendar` | `year` → `tropical_year.identity` | `month` → `tropical_month.identity` | `months` |
| `tropical_year_parts` | `tropical.calendar` | `year` → `tropical_year.identity` | `part` → `part.identity` | `parts` |
| `tropical_year_phenologies` | `tropical.calendar` | `year` → `tropical_year.identity` | `phenology` → `phenology.identity` | `phenologies` |
| `tropical_year_weeks` | `tropical.calendar` | `year` → `tropical_year.identity` | `week` → `week.identity` | `weeks` |

## 4. 逐表列清单

每张表先给 `- 表名`，再给逐列清单。`key` / `index` 两列只统计 `CREATE INDEX` 建出来的显式索引，主键自带的唯一索引在「索引」行里单独说明。

### astronomy.calendar.sqlite

模块 `astronomy.calendar` · 建库 2026-10-13 03:48:51 · 9 张表 · 0 行

表：`astronomy_year`、`astronomy_month`、`astronomy_year_months`、`astronomy_year_phenologies`、`astronomy_year_weeks`、`astronomy_year_parts`、`astronomy_month_phenologies`、`astronomy_month_weeks`、`astronomy_month_parts`

- astronomy_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：天文纪年的年。按月相规则定建元。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- astronomy_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：天文纪年的月。按月相规则定建元。
索引：`idx_astronomy_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `astronomy_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- astronomy_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 astronomy_year.identity|
|month|integer|no|no|yes|yes|子端 astronomy_month.identity|

表说明：astronomy_year × astronomy_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_astronomy_year_months_month`(month)、`idx_astronomy_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `astronomy_year.identity`；`month` → `astronomy_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 astronomy_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：astronomy_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_astronomy_year_phenologies_phenology`(phenology)、`idx_astronomy_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `astronomy_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 astronomy_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：astronomy_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_astronomy_year_weeks_week`(week)、`idx_astronomy_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `astronomy_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 astronomy_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：astronomy_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_astronomy_year_parts_part`(part)、`idx_astronomy_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `astronomy_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 astronomy_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：astronomy_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_astronomy_month_phenologies_phenology`(phenology)、`idx_astronomy_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `astronomy_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 astronomy_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：astronomy_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_astronomy_month_weeks_week`(week)、`idx_astronomy_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `astronomy_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- astronomy_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 astronomy_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：astronomy_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_astronomy_month_parts_part`(part)、`idx_astronomy_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `astronomy_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### chronology.sqlite

模块 `chronology` · 建库 2026-10-13 03:48:45 · 1 张表 · 0 行

表：`chronology`

- chronology

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|纪年在年号内的序号|
|absolute|integer|no|no|no|no|全局纪年序号|
|epoch|integer|no|no|no|no|所属世|
|synodic|integer|no|no|no|no|对应朔望年|
|lengthOfSynodicMonth|integer|no|no|no|no|该纪年朔望月的月数|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：纪年。实体已定义，但 calendar.xlsx 不含纪年数据。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`epoch` → `epoch.identity`；`synodic` → `synodic_calendar_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：数据源缺失，仅建表留空；层次上与 epoch 对接。

### climate.sqlite

模块 `climate` · 建库 2026-10-13 03:47:47 · 12 张表 · 6,394,394 行

表：`climate`、`climate_year`、`climate_month`、`climate_year_months`、`climate_year_phenologies`、`climate_year_weeks`、`climate_year_parts`、`climate_month_phenologies`、`climate_month_weeks`、`climate_month_parts`、`climate_weeks`、`climate_parts`

- climate

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|absolute|integer|no|no|yes|yes|全局气候序号，按时间升序|
|relative|integer|no|no|no|no|该气候在所属朔望月内的序号|
|name|text|no|no|yes|yes|气候名|
|lengthOfDay|integer|no|no|no|no|气候长，天数，5|
|lengthOfWeek|integer|no|no|no|no|气候含多少个周，⌊5/7⌋ = 0|
|lengthOfPart|integer|no|no|no|no|气候含多少个旬，⌊5/10⌋ = 0|
|leap|integer|no|no|no|no|是否闰|
|month|integer|no|no|yes|yes|所属朔望月|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：气候：长度为 5 天的气候单位，节气纪年的年/月表都由它推导而来。
索引：`idx_climate_absolute`(absolute)、`idx_climate_name`(name)、`idx_climate_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：每个朔望月内自月首起每 5 天一个气候，末段按月末截断。

- climate_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：节气纪年的年。一年 24 个月，与 phenology 一一对应。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- climate_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：节气纪年的月。一年 24 个月，与 phenology 一一对应。
索引：`idx_climate_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `climate_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- climate_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 climate_year.identity|
|month|integer|no|no|yes|yes|子端 climate_month.identity|

表说明：climate_year × climate_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_climate_year_months_month`(month)、`idx_climate_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `climate_year.identity`；`month` → `climate_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 climate_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：climate_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_climate_year_phenologies_phenology`(phenology)、`idx_climate_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `climate_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 climate_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：climate_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_climate_year_weeks_week`(week)、`idx_climate_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `climate_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 climate_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：climate_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_climate_year_parts_part`(part)、`idx_climate_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `climate_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 climate_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：climate_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_climate_month_phenologies_phenology`(phenology)、`idx_climate_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `climate_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 climate_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：climate_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_climate_month_weeks_week`(week)、`idx_climate_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `climate_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 climate_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：climate_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_climate_month_parts_part`(part)、`idx_climate_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `climate_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|climate|integer|no|no|yes|yes|父端 climate.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：climate × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_climate_weeks_week`(week)、`idx_climate_weeks_climate`(climate)
引用（SQLite 不施加外键约束，仅记录指向）：`climate` → `climate.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- climate_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|climate|integer|no|no|yes|yes|父端 climate.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：climate × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_climate_parts_part`(part)、`idx_climate_parts_climate`(climate)
引用（SQLite 不施加外键约束，仅记录指向）：`climate` → `climate.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### dynasty.sqlite

模块 `dynasty` · 建库 2026-10-13 04:09:11 · 3 张表 · 10,719 行

表：`dynasty`、`dynasty_eras`、`dynasty_chronologies`

- dynasty

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|朝内序号|
|absolute|integer|no|no|no|no|全局朝代序号，按起始年升序|
|name|text|no|no|yes|yes|朝代名，如 夏朝 / 中华民国 / 当代|
|kind|text|no|no|yes|yes|分期：上古 / 神话 / 历史 / 现代|
|gregorian_year|integer|no|no|yes|yes|起始年，天文纪年 proleptic 格里高利历，可为负|
|end_year|integer|no|no|no|no|结束年；未终结的朝代写 0，并以 end 为 0 表示|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：朝代。分期：上古（盘古以前）、神话（伏羲起）、历史（夏起）、现代（中华民国起）。
索引：`idx_dynasty_gregorian_year`(gregorian_year)、`idx_dynasty_kind`(kind)、`idx_dynasty_name`(name)
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：起讫年取自 zh.wikipedia「中国朝代」，以简繁转换后的规范名入库。

- dynasty_eras

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|dynasty|integer|no|no|yes|yes|父端 dynasty.identity|
|era|integer|no|no|yes|yes|子端 era.identity|

表说明：dynasty × era 的多对多关联表：对应 entity 的 `eras`。
索引：`idx_dynasty_eras_era`(era)、`idx_dynasty_eras_dynasty`(dynasty)
引用（SQLite 不施加外键约束，仅记录指向）：`dynasty` → `dynasty.identity`；`era` → `era.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- dynasty_chronologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|dynasty|integer|no|no|yes|yes|父端 dynasty.identity|
|chronology|integer|no|no|yes|yes|子端 chronology.identity|

表说明：dynasty × chronology 的多对多关联表：对应 entity 的 `chronologies`。
索引：`idx_dynasty_chronologies_chronology`(chronology)、`idx_dynasty_chronologies_dynasty`(dynasty)
引用（SQLite 不施加外键约束，仅记录指向）：`dynasty` → `dynasty.identity`；`chronology` → `chronology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### encounter.sqlite

模块 `encounter` · 建库 2026-10-13 04:09:10 · 2 张表 · 836 行

表：`encounter`、`encounter_performs`

- encounter

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|本会在所属元内的序号 1-12|
|absolute|integer|no|no|no|no|全局会序号，建元当月所在会为 1，可为负|
|primary|integer|no|no|yes|yes|所属元|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：会：30 运 = 360 世 = 10800 朔望月。建元当天为第 1 会。
索引：`idx_encounter_primary`(primary)
引用（SQLite 不施加外键约束，仅记录指向）：`primary` → `primary.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`

- encounter_performs

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|encounter|integer|no|no|yes|yes|父端 encounter.identity|
|perform|integer|no|no|yes|yes|子端 perform.identity|

表说明：encounter × perform 的多对多关联表：对应 entity 的 `performs`。
索引：`idx_encounter_performs_perform`(perform)、`idx_encounter_performs_encounter`(encounter)
引用（SQLite 不施加外键约束，仅记录指向）：`encounter` → `encounter.identity`；`perform` → `perform.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### epoch.sqlite

模块 `epoch` · 建库 2026-10-13 04:09:10 · 2 张表 · 9,689 行

表：`epoch`、`epoch_chronologies`

- epoch

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|本世在所属运内的序号 1-12|
|absolute|integer|no|no|no|no|全局世序号，建元当月所在世为 1，可为负|
|perform|integer|no|no|yes|yes|所属运|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：世：30 朔望月。建元当天为第 1 世。
索引：`idx_epoch_perform`(perform)
引用（SQLite 不施加外键约束，仅记录指向）：`perform` → `perform.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：由 synodic_month 每 30 个一组推导，首尾都对齐工作簿。

- epoch_chronologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|epoch|integer|no|no|yes|yes|父端 epoch.identity|
|chronology|integer|no|no|yes|yes|子端 chronology.identity|

表说明：epoch × chronology 的多对多关联表：对应 entity 的 `chronologies`。
索引：`idx_epoch_chronologies_chronology`(chronology)、`idx_epoch_chronologies_epoch`(epoch)
引用（SQLite 不施加外键约束，仅记录指向）：`epoch` → `epoch.identity`；`chronology` → `chronology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### era.sqlite

模块 `era` · 建库 2026-10-13 03:48:45 · 2 张表 · 1,184 行

表：`era`、`era_chronologies`

- era

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|本朝内的年号序号|
|absolute|integer|no|no|no|no|全局年号序号，按起始年升序|
|name|text|no|no|yes|yes|年号名，如 建元 / 民国 / 伏羲|
|kind|text|no|no|yes|yes|分期：神话 / 历史 / 现代|
|regime|text|no|no|no|no|政权名，源表原样记录，如 西汉 / 中华民国|
|ruler|text|no|no|no|no|君主，如 汉武帝刘彻|
|dynasty|text|no|no|yes|yes|所属朝代名，按政权名归并；归并不了的写空|
|gregorian_year|integer|no|no|no|no|起始年|
|end_year|integer|no|no|no|no|结束年|
|years|text|no|no|no|no|沿用年数，源表原样记录|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：年号。神话朝代自伏羲始，其后按历史典籍；当代年号为「」（空字符），故本表无当代记录。
索引：`idx_era_dynasty`(dynasty)、`idx_era_kind`(kind)、`idx_era_name`(name)
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：一个年号可能跨年；起讫年为公元纪年，年份精度到年。

- era_chronologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|era|integer|no|no|yes|yes|父端 era.identity|
|chronology|integer|no|no|yes|yes|子端 chronology.identity|

表说明：era × chronology 的多对多关联表：对应 entity 的 `chronologies`。
索引：`idx_era_chronologies_chronology`(chronology)、`idx_era_chronologies_era`(era)
引用（SQLite 不施加外键约束，仅记录指向）：`era` → `era.identity`；`chronology` → `chronology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### event.sqlite

模块 `event` · 建库 2026-10-13 03:48:45 · 1 张表 · 2,379 行

表：`event`

- event

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|年内序号|
|absolute|integer|no|no|no|no|全局事件序号，按时间升序|
|name|text|no|no|no|no|事件名，如 夏朝建立 / 改元建元|
|kind|text|no|no|yes|yes|dynasty_begin / dynasty_end / era_begin / era_end|
|subject|text|no|no|no|no|主要人：该年号的君主姓名；朝代事件写空|
|colony|text|no|no|no|no|群体：该年号的政权名；朝代事件写朝代名|
|cause|text|no|no|no|no|原因；本实体只记两类事件，无来源，写空|
|incident|text|no|no|no|no|事件过程和描述|
|result|text|no|no|no|no|结果；本实体只记两类事件，无来源，写空|
|gregorian_year|integer|no|no|yes|yes|事件发生年，天文纪年 proleptic 格里高利历，可为负|
|dynasty|integer|no|no|yes|yes|涉及朝代|
|era|integer|no|no|yes|yes|涉及年号|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：历史事件。只记两件事：年号起止、朝代更迭。其余史事不论。
索引：`idx_event_era`(era)、`idx_event_dynasty`(dynasty)、`idx_event_gregorian_year`(gregorian_year)、`idx_event_kind`(kind)
引用（SQLite 不施加外键约束，仅记录指向）：`dynasty` → `dynasty.identity`；`era` → `era.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：年内只精确到年，故 start/end 取该年的第一天与最后一天。

### gregory.calendar.sqlite

模块 `gregory.calendar` · 建库 2026-10-13 03:48:57 · 9 张表 · 0 行

表：`gregory_year`、`gregory_month`、`gregory_year_months`、`gregory_year_phenologies`、`gregory_year_weeks`、`gregory_year_parts`、`gregory_month_phenologies`、`gregory_month_weeks`、`gregory_month_parts`

- gregory_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：格里高利历的年。proleptic，可直接由 temporal 展开。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- gregory_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：格里高利历的月。proleptic，可直接由 temporal 展开。
索引：`idx_gregory_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `gregory_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- gregory_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 gregory_year.identity|
|month|integer|no|no|yes|yes|子端 gregory_month.identity|

表说明：gregory_year × gregory_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_gregory_year_months_month`(month)、`idx_gregory_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `gregory_year.identity`；`month` → `gregory_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 gregory_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：gregory_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_gregory_year_phenologies_phenology`(phenology)、`idx_gregory_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `gregory_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 gregory_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：gregory_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_gregory_year_weeks_week`(week)、`idx_gregory_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `gregory_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 gregory_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：gregory_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_gregory_year_parts_part`(part)、`idx_gregory_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `gregory_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 gregory_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：gregory_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_gregory_month_phenologies_phenology`(phenology)、`idx_gregory_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `gregory_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 gregory_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：gregory_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_gregory_month_weeks_week`(week)、`idx_gregory_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `gregory_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- gregory_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 gregory_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：gregory_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_gregory_month_parts_part`(part)、`idx_gregory_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `gregory_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### jupiter.calendar.sqlite

模块 `jupiter.calendar` · 建库 2026-10-13 03:49:03 · 9 张表 · 0 行

表：`jupiter_year`、`jupiter_month`、`jupiter_year_months`、`jupiter_year_phenologies`、`jupiter_year_weeks`、`jupiter_year_parts`、`jupiter_month_phenologies`、`jupiter_month_weeks`、`jupiter_month_parts`

- jupiter_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：木星历法的年。以木星岁星纪年。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- jupiter_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：木星历法的月。以木星岁星纪年。
索引：`idx_jupiter_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `jupiter_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- jupiter_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 jupiter_year.identity|
|month|integer|no|no|yes|yes|子端 jupiter_month.identity|

表说明：jupiter_year × jupiter_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_jupiter_year_months_month`(month)、`idx_jupiter_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `jupiter_year.identity`；`month` → `jupiter_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 jupiter_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：jupiter_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_jupiter_year_phenologies_phenology`(phenology)、`idx_jupiter_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `jupiter_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 jupiter_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：jupiter_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_jupiter_year_weeks_week`(week)、`idx_jupiter_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `jupiter_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 jupiter_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：jupiter_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_jupiter_year_parts_part`(part)、`idx_jupiter_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `jupiter_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 jupiter_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：jupiter_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_jupiter_month_phenologies_phenology`(phenology)、`idx_jupiter_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `jupiter_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 jupiter_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：jupiter_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_jupiter_month_weeks_week`(week)、`idx_jupiter_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `jupiter_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- jupiter_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 jupiter_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：jupiter_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_jupiter_month_parts_part`(part)、`idx_jupiter_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `jupiter_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### natural.calendar.sqlite

模块 `natural.calendar` · 建库 2026-10-13 03:49:09 · 9 张表 · 0 行

表：`natural_year`、`natural_month`、`natural_year_months`、`natural_year_phenologies`、`natural_year_weeks`、`natural_year_parts`、`natural_month_phenologies`、`natural_month_weeks`、`natural_month_parts`

- natural_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：轩辕纪年/黄帝纪年的年。以建元 -2696-03-11 01:45:49 起算。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- natural_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：轩辕纪年/黄帝纪年的月。以建元 -2696-03-11 01:45:49 起算。
索引：`idx_natural_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `natural_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- natural_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 natural_year.identity|
|month|integer|no|no|yes|yes|子端 natural_month.identity|

表说明：natural_year × natural_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_natural_year_months_month`(month)、`idx_natural_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `natural_year.identity`；`month` → `natural_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 natural_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：natural_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_natural_year_phenologies_phenology`(phenology)、`idx_natural_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `natural_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 natural_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：natural_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_natural_year_weeks_week`(week)、`idx_natural_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `natural_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 natural_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：natural_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_natural_year_parts_part`(part)、`idx_natural_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `natural_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 natural_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：natural_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_natural_month_phenologies_phenology`(phenology)、`idx_natural_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `natural_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 natural_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：natural_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_natural_month_weeks_week`(week)、`idx_natural_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `natural_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- natural_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 natural_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：natural_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_natural_month_parts_part`(part)、`idx_natural_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `natural_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### part.sqlite

模块 `part` · 建库 2026-10-13 03:48:38 · 1 张表 · 871,962 行

表：`part`

- part

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|absolute|integer|no|no|no|no|该旬在月内的序号 1-3|
|month|integer|no|no|yes|yes|所属朔望月|
|day|integer|no|no|no|no|旬首在本月内的第几天，1/11/21|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：旬：10 天。每个朔望月分上旬/中旬/下旬。
索引：`idx_part_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`

### perform.sqlite

模块 `perform` · 建库 2026-10-13 04:09:10 · 2 张表 · 10,497 行

表：`perform`、`perform_epoches`

- perform

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|本运在所属会内的序号 1-30|
|absolute|integer|no|no|no|no|全局运序号，建元当月所在运为 1，可为负|
|encounter|integer|no|no|yes|yes|所属会|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：运：12 世 = 360 朔望月。建元当天为第 1 运。
索引：`idx_perform_encounter`(encounter)
引用（SQLite 不施加外键约束，仅记录指向）：`encounter` → `encounter.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`

- perform_epoches

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|perform|integer|no|no|yes|yes|父端 perform.identity|
|epoch|integer|no|no|yes|yes|子端 epoch.identity|

表说明：perform × epoch 的多对多关联表：对应 entity 的 `epoches`。
索引：`idx_perform_epoches_epoch`(epoch)、`idx_perform_epoches_perform`(perform)
引用（SQLite 不施加外键约束，仅记录指向）：`perform` → `perform.identity`；`epoch` → `epoch.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### person.sqlite

模块 `person` · 建库 2026-10-13 03:48:45 · 1 张表 · 425 行

表：`person`

- person

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|全局序号|
|absolute|integer|no|no|no|no|全局序号|
|name|text|no|no|yes|yes|姓名|
|gender|text|no|no|no|no|性别；历史资料未提供，写空|
|biography|text|no|no|no|no|生平；历史资料未提供，写空|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：人物。是 Event.subject 的目标类型；历史资料只提供姓名，其余字段留空。
索引：`idx_person_name`(name)
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：行数据来自年号表出现过的君主姓名，去重后入库；gender/biography 无来源，保持空。

### phase.sqlite

模块 `phase` · 建库 2026-10-13 03:48:31 · 3 张表 · 7,203,280 行

表：`phase`、`phase_weeks`、`phase_parts`

- phase

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|absolute|integer|no|no|yes|yes|全局相序号，自建元当月第一个相起算，从 1 递增|
|relative|integer|no|no|no|no|该相在所属朔望月内的序号 1-4|
|name|text|no|no|yes|yes|相名：朔月 / 上弦 / 望月 / 下弦|
|lengthOfDay|integer|no|no|no|no|相长，天数，5|
|lengthOfWeek|integer|no|no|no|no|相含多少个周，⌊5/7⌋ = 0|
|lengthOfPart|integer|no|no|no|no|相含多少个旬，⌊5/10⌋ = 0|
|leap|integer|no|no|no|no|是否闰相；相按朔望月等分，恒为 0|
|month|integer|no|no|yes|yes|所属朔望月|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：相：朔月 / 上弦 / 望月 / 下弦。源表 D~G 列，每个朔望月四条，始终齐全。
索引：`idx_phase_absolute`(absolute)、`idx_phase_name`(name)、`idx_phase_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：相是 5 天的单位，与候同长；end = 下一个相起点 - 1。

- phase_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|phase|integer|no|no|yes|yes|父端 phase.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：phase × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_phase_weeks_week`(week)、`idx_phase_weeks_phase`(phase)
引用（SQLite 不施加外键约束，仅记录指向）：`phase` → `phase.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- phase_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|phase|integer|no|no|yes|yes|父端 phase.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：phase × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_phase_parts_part`(part)、`idx_phase_parts_phase`(phase)
引用（SQLite 不施加外键约束，仅记录指向）：`phase` → `phase.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### phenology.sqlite

模块 `phenology` · 建库 2026-10-13 03:46:59 · 1 张表 · 564,000 行

表：`phenology`

- phenology

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|absolute|integer|no|no|no|no|该候在年内的序号（按时间排序，从 1 起）|
|name|text|no|no|yes|yes|候名，如 立春 / 雨水（源表给的名字，源自二十四节气）|
|kind|integer|no|no|yes|yes|1=主节气 2=主中气 3=副节中气|
|lengthOfDay|integer|no|no|no|no|候长，天数，5|
|year|integer|no|no|yes|yes|所属纪年块|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：候：长度为 5 天的物候单位。源表 H~M 列给出候名与起始时刻。
索引：`idx_phenology_year`(year)、`idx_phenology_kind`(kind)、`idx_phenology_name`(name)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：候是 5 天的单位；end = 下一条候起点 - 1，故长度即 end - start + 1。源表的名字借用了二十四节气名，两者不要混为一谈。

### primary.sqlite

模块 `primary` · 建库 2026-10-13 04:09:10 · 2 张表 · 811 行

表：`primary`、`primary_performs`

- primary

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|元序号，建元所在元为 1|
|absolute|integer|no|no|no|no|全局元序号，建元当月所在元为 1|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：元：12 会 = 360 运 = 4320 世 = 129600 朔望月。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：朔望月总数 290654 < 129600 × 3，故本库只有第 1 元；建表与推导逻辑保持通用。

- primary_performs

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|primary|integer|no|no|yes|yes|父端 primary.identity|
|perform|integer|no|no|yes|yes|子端 perform.identity|

表说明：primary × perform 的多对多关联表：对应 entity 的 `performs`。
索引：`idx_primary_performs_perform`(perform)、`idx_primary_performs_primary`(primary)
引用（SQLite 不施加外键约束，仅记录指向）：`primary` → `primary.identity`；`perform` → `perform.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### synodic.sqlite

模块 `synodic` · 建库 2026-10-13 04:09:08 · 9 张表 · 6,652,001 行

表：`synodic_calendar_year`、`synodic_month`、`synodic_calendar_year_months`、`synodic_calendar_year_phenologies`、`synodic_calendar_year_weeks`、`synodic_calendar_year_parts`、`synodic_month_phenologies`、`synodic_month_weeks`、`synodic_month_parts`

- synodic_calendar_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成|
|relative|integer|no|no|no|no|年内月数：12 或 13|
|gregorian_year|integer|no|no|yes|yes|纪年块标签，即纪年，可与 proleptic 格里高利历年不同|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：朔望年。源表列 B 的纪年块，一年 12 或 13 个朔望月。
索引：`idx_synodic_calendar_year_gregorian_year`(gregorian_year)
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`

- synodic_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|积月，源表列 N：本纪年块内的第几个月，1 起|
|absolute|integer|no|no|yes|yes|全局朔望月序号，建元当月为 1，可为负|
|year|integer|no|no|yes|yes|所属纪年块|
|ordinal|integer|no|no|yes|yes|月序 1=正月 … 12=腊月|
|leap|integer|no|no|yes|yes|是否闰月|
|size|text|no|no|no|no|月大小：大=30 天，小=29 天，来自源表公式 IF(C3="大",30,29)|
|lengthOfDay|integer|no|no|no|no|本月天数 29 或 30|
|name|text|no|no|no|no|月名，如 正月小 / 闰四月大|
|label|text|no|no|no|no|不含大小的月名，如 正月 / 闰四月|
|month_end_day|integer|no|no|no|no|源表列 O 月末积日，源表在纪年块边界存在 ±1 天异常，仅作参考|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：朔望月。源表一行一个月，是最细的、可直接落库的历法单位。
索引：`idx_synodic_month_absolute`(absolute)、`idx_synodic_month_leap`(leap)、`idx_synodic_month_ordinal`(ordinal)、`idx_synodic_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：end = 下一月朔月 - 1 秒，故月末即下月月首的前一秒。

- synodic_calendar_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 synodic_calendar_year.identity|
|month|integer|no|no|yes|yes|子端 synodic_month.identity|

表说明：synodic_calendar_year × synodic_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_synodic_calendar_year_months_month`(month)、`idx_synodic_calendar_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`month` → `synodic_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_calendar_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 synodic_calendar_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：synodic_calendar_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_synodic_calendar_year_phenologies_phenology`(phenology)、`idx_synodic_calendar_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_calendar_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 synodic_calendar_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：synodic_calendar_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_synodic_calendar_year_weeks_week`(week)、`idx_synodic_calendar_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_calendar_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 synodic_calendar_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：synodic_calendar_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_synodic_calendar_year_parts_part`(part)、`idx_synodic_calendar_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `synodic_calendar_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 synodic_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：synodic_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_synodic_month_phenologies_phenology`(phenology)、`idx_synodic_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 synodic_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：synodic_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_synodic_month_weeks_week`(week)、`idx_synodic_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- synodic_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 synodic_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：synodic_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_synodic_month_parts_part`(part)、`idx_synodic_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### temporal.sqlite

模块 `temporal` · 建库 2026-10-13 03:45:59 · 1 张表 · 9,560,723 行

表：`temporal`

- temporal

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成|
|absolute|integer|no|no|no|no|同 identity，显式列出便于 JOIN|
|days|integer|no|no|yes|yes|自建元起的日序，建元当天为 1，前一天为 -1|
|seconds|integer|no|no|no|no|当天 00:00:00 起算的秒数|
|year|integer|no|no|yes|yes|天文纪年 proleptic 格里高利历年份，可为 0 与负数|
|month|integer|no|no|yes|no|月 1-12|
|day|integer|no|no|yes|no|日 1-31|
|hour|integer|no|no|no|no|时 0-23|
|minute|integer|no|no|no|no|分 0-59|
|second|integer|no|no|no|no|秒 0-59|

表说明：绝对时间。全表统一的时间坐标系，其它表的时间列都是它的外键。
索引：`idx_temporal_ymd`(year, month, day)、`idx_temporal_days`(days)
备注：由工作簿中全部时间戳去重物化。

### tree.calendar.sqlite

模块 `tree.calendar` · 建库 2026-10-13 03:49:16 · 9 张表 · 0 行

表：`tree_year`、`tree_month`、`tree_year_months`、`tree_year_phenologies`、`tree_year_weeks`、`tree_year_parts`、`tree_month_phenologies`、`tree_month_weeks`、`tree_month_parts`

- tree_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：干支年的年。以立春为分界。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- tree_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：干支年的月。以立春为分界。
索引：`idx_tree_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tree_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- tree_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tree_year.identity|
|month|integer|no|no|yes|yes|子端 tree_month.identity|

表说明：tree_year × tree_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_tree_year_months_month`(month)、`idx_tree_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tree_year.identity`；`month` → `tree_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tree_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：tree_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_tree_year_phenologies_phenology`(phenology)、`idx_tree_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tree_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tree_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：tree_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_tree_year_weeks_week`(week)、`idx_tree_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tree_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tree_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：tree_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_tree_year_parts_part`(part)、`idx_tree_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tree_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tree_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：tree_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_tree_month_phenologies_phenology`(phenology)、`idx_tree_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tree_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tree_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：tree_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_tree_month_weeks_week`(week)、`idx_tree_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tree_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tree_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tree_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：tree_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_tree_month_parts_part`(part)、`idx_tree_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tree_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### tropical.calendar.sqlite

模块 `tropical.calendar` · 建库 2026-10-13 03:49:23 · 9 张表 · 0 行

表：`tropical_year`、`tropical_month`、`tropical_year_months`、`tropical_year_phenologies`、`tropical_year_weeks`、`tropical_year_parts`、`tropical_month_phenologies`、`tropical_month_weeks`、`tropical_month_parts`

- tropical_year

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法年在父级内的序号|
|absolute|integer|no|no|no|no|全局年序号|
|lengthOfMonth|integer|no|no|no|no|长度，月（向 0 取整）|
|lengthOfPhenology|integer|no|no|no|no|长度，候（向 0 取整）|
|lengthOfWeek|integer|no|no|no|no|长度，周（向 0 取整）|
|lengthOfPart|integer|no|no|no|no|长度，旬（向 0 取整）|
|lengthOfDay|integer|no|no|no|no|长度，天（向 0 取整）|
|leap|integer|no|no|no|no|是否闰年|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：回归年的年。以回归年为年长。
索引：无
引用（SQLite 不施加外键约束，仅记录指向）：`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。

- tropical_month

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|relative|integer|no|no|no|no|该类历法月在年内的序号|
|absolute|integer|no|no|no|no|全局月序号|
|year|integer|no|no|yes|yes|所属年|
|ordinal|integer|no|no|no|no|月序|
|leap|integer|no|no|no|no|是否闰月|
|lengthOfDay|integer|no|no|no|no|本月天数|
|name|text|no|no|no|no|月名|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：回归年的月。以回归年为年长。
索引：`idx_tropical_month_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tropical_year.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`
备注：建表与实体完整对应；行数据待生成。

- tropical_year_months

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tropical_year.identity|
|month|integer|no|no|yes|yes|子端 tropical_month.identity|

表说明：tropical_year × tropical_month 的多对多关联表：对应 entity 的 `months`。
索引：`idx_tropical_year_months_month`(month)、`idx_tropical_year_months_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tropical_year.identity`；`month` → `tropical_month.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_year_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tropical_year.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：tropical_year × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_tropical_year_phenologies_phenology`(phenology)、`idx_tropical_year_phenologies_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tropical_year.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_year_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tropical_year.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：tropical_year × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_tropical_year_weeks_week`(week)、`idx_tropical_year_weeks_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tropical_year.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_year_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|year|integer|no|no|yes|yes|父端 tropical_year.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：tropical_year × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_tropical_year_parts_part`(part)、`idx_tropical_year_parts_year`(year)
引用（SQLite 不施加外键约束，仅记录指向）：`year` → `tropical_year.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_month_phenologies

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tropical_month.identity|
|phenology|integer|no|no|yes|yes|子端 phenology.identity|

表说明：tropical_month × phenology 的多对多关联表：对应 entity 的 `phenologies`。
索引：`idx_tropical_month_phenologies_phenology`(phenology)、`idx_tropical_month_phenologies_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tropical_month.identity`；`phenology` → `phenology.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_month_weeks

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tropical_month.identity|
|week|integer|no|no|yes|yes|子端 week.identity|

表说明：tropical_month × week 的多对多关联表：对应 entity 的 `weeks`。
索引：`idx_tropical_month_weeks_week`(week)、`idx_tropical_month_weeks_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tropical_month.identity`；`week` → `week.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

- tropical_month_parts

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|month|integer|no|no|yes|yes|父端 tropical_month.identity|
|part|integer|no|no|yes|yes|子端 part.identity|

表说明：tropical_month × part 的多对多关联表：对应 entity 的 `parts`。
索引：`idx_tropical_month_parts_part`(part)、`idx_tropical_month_parts_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `tropical_month.identity`；`part` → `part.identity`
备注：关联表只存两端 identity；两端常常跨库，不施加外键约束。

### week.sqlite

模块 `week` · 建库 2026-10-13 03:48:44 · 1 张表 · 1,453,271 行

表：`week`

- week

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|identity|integer|yes|yes|NA|NA|自增主键，由数据库生成，与业务时间无关|
|absolute|integer|no|no|no|no|该周在月内的序号，从 1 起|
|month|integer|no|no|yes|yes|所属朔望月|
|lengthOfDay|integer|no|no|no|no|本周天数，7|
|start|integer|no|no|no|no|区间起点，闭区间|
|end|integer|no|no|no|no|区间终点，闭区间，等于下一区间起点 - 1|

表说明：星期：7 天。以建元当天所在周为第 1 周。
索引：`idx_week_month`(month)
引用（SQLite 不施加外键约束，仅记录指向）：`month` → `synodic_month.identity`；`start` → `temporal.identity`；`end` → `temporal.identity`

## 5. `_meta`（每个分库都有）

构建元数据，由 `database/build.py` 写在每个库里，不属于任何实体，也不参与各层映射。`database/verify.py` 会拿它的 `counts` 与实际行数对账。

- _meta

|name|type|primary key|auto increment|key|index|comment|
|---|---|---|---|---|---|---|
|key|text|yes|no|NA|NA|元数据键：module / source / source_sha256 / built_at / tables / rows / counts|
|value|text|no|no|NA|NA|元数据值，整数与列表都以文本存放|

索引：无显式索引；主键自带 `sqlite_autoindex__meta_1`；每个库 7 行。

注意：`source` 一律写 `calendar.xlsx`，因为 `database/build.py` 把工作簿名无条件传给 `write_meta()`；而 `database/datafiles.py` 的 `HISTORY_MODULES`（dynasty / era / person / event）实际取自 `database/data/*.csv`。要判断某个库的真实来源，看这四个模块名，不要看 `source`。

## 6. 差异

库与 `database/schema.py` 完全一致：表名、列名与顺序、列类型、显式索引、行数归属都对得上，没有单边多出来的表或列。

entity 与表结构一致：`src/entity/*.ts` 里每个复数属性都有对应的关联表，也没有复数命名的标量列。
