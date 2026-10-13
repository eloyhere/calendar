"""database.schema：全部表的唯一声明。

`src/sql/*.sql` 的建表语句、`docs/design.md` 的列清单、以及各层的字段名
都以本模块为准；任何一层要改字段，先改这里。

约定：

- 主键统一叫 `identity`，取自 `Temporal.identity`（bigint 的绝对时间）。
- `identity`/`absolute` 都是 64 位整数；`bigint` 落库为 INTEGER，
  在 SQLite 中即 8 字节整数，不经过 JS number。
- `start`/`end` 都是闭区间端点：`end = 下一区间起点 - 1`。
- 空表（数据源缺失）在 `NOTE` 中说明原因。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

__all__ = ["Column", "Table", "TABLES", "by_module", "emit_sqlite", "emit_sql"]


@dataclass(frozen=True)
class Column:
    """一列。`kind` 同时决定 SQLite 亲和类型与 SQL 类型。"""

    name: str
    kind: str                      # bigint | text | boolean
    note: str = ""
    nullable: bool = False
    references: str | None = None  # "表.列"
    default: Any = None

    @property
    def identity(self) -> bool:
        """是否主键列。主键固定叫 `identity`。"""
        return self.name == "identity"

    @property
    def auto(self) -> bool:
        """是否由数据库自增生成（仅主键），INSERT 时不绑定该列。"""
        return self.identity

    @property
    def primary(self) -> bool:
        return self.identity

    def sqlite_type(self) -> str:
        return {"bigint": "INTEGER", "text": "TEXT", "boolean": "INTEGER"}[self.kind]

    def sql_type(self) -> str:
        return {"bigint": "BIGINT", "text": "TEXT", "boolean": "TINYINT"}[self.kind]

    def literal(self, value: Any) -> str:
        """把 Python 值渲染成 SQL 字面量。"""
        if value is None:
            return "NULL"
        if self.kind == "text":
            return "'" + str(value).replace("'", "''") + "'"
        if self.kind == "boolean":
            return "1" if value else "0"
        return str(int(value))


@dataclass
class Table:
    """一张表。"""

    name: str
    module: str                    # 对应的 database/<module>.py 与 src/entity/<module>.ts
    comment: str
    columns: list[Column] = field(default_factory=list)
    indexes: list[tuple[str, list[str]]] = field(default_factory=list)
    note: str = ""
    #: ManyToMany 关联表的两端：(父表, 父列, 子表, 子列)；普通表为 None
    relation: tuple[str, str, str, str] | None = None

    def column(self, name: str) -> Column:
        for column in self.columns:
            if column.name == name:
                return column
        raise KeyError(f"{self.name} 没有列 {name}")

    @property
    def column_names(self) -> list[str]:
        return [column.name for column in self.columns]


def _identity(note: str = "自增主键，由数据库生成，与业务时间无关") -> Column:
    return Column("identity", "bigint", note)


def _absolute(note: str) -> Column:
    return Column("absolute", "bigint", note)


def _relative(note: str) -> Column:
    return Column("relative", "bigint", note)


def _span() -> list[Column]:
    return [
        Column("start", "bigint", "区间起点，闭区间", references="temporal.identity"),
        Column("end", "bigint", "区间终点，闭区间，等于下一区间起点 - 1", references="temporal.identity"),
    ]


# --------------------------------------------------------------------------- #
# 表定义
# --------------------------------------------------------------------------- #

TABLES: list[Table] = [
    Table(
        name="temporal",
        module="temporal",
        comment="绝对时间。全表统一的时间坐标系，其它表的时间列都是它的外键。",
        columns=[
            Column("identity", "bigint", "自增主键，由数据库生成"),
            Column("absolute", "bigint", "同 identity，显式列出便于 JOIN"),
            Column("days", "bigint", "自建元起的日序，建元当天为 1，前一天为 -1"),
            Column("seconds", "bigint", "当天 00:00:00 起算的秒数"),
            Column("year", "bigint", "天文纪年 proleptic 格里高利历年份，可为 0 与负数"),
            Column("month", "bigint", "月 1-12"),
            Column("day", "bigint", "日 1-31"),
            Column("hour", "bigint", "时 0-23"),
            Column("minute", "bigint", "分 0-59"),
            Column("second", "bigint", "秒 0-59"),
        ],
        indexes=[("days", ["days"]), ("ymd", ["year", "month", "day"])],
        note="由工作簿中全部时间戳去重物化。",
    ),
    Table(
        name="phenology",
        module="phenology",
        comment="候：长度为 5 天的物候单位。源表 H~M 列给出候名与起始时刻。",
        columns=[
            _identity(),
            _absolute("该候在年内的序号（按时间排序，从 1 起）"),
            Column("name", "text", "候名，如 立春 / 雨水（源表给的名字，源自二十四节气）"),
            Column("kind", "bigint", "1=主节气 2=主中气 3=副节中气"),
            Column("lengthOfDay", "bigint", "候长，天数，5"),
            Column("year", "bigint", "所属纪年块", references="synodic_calendar_year.identity"),
            *_span(),
        ],
        indexes=[("name", ["name"]), ("kind", ["kind"]), ("year", ["year"])],
        note="候是 5 天的单位；end = 下一条候起点 - 1，故长度即 end - start + 1。"
             "源表的名字借用了二十四节气名，两者不要混为一谈。",
    ),
    Table(
        name="phase",
        module="phase",
        comment="相：朔月 / 上弦 / 望月 / 下弦。源表 D~G 列，每个朔望月四条，始终齐全。",
        columns=[
            _identity(),
            _absolute("全局相序号，自建元当月第一个相起算，从 1 递增"),
            _relative("该相在所属朔望月内的序号 1-4"),
            Column("name", "text", "相名：朔月 / 上弦 / 望月 / 下弦"),
            Column("lengthOfDay", "bigint", "相长，天数，5"),
            Column("lengthOfWeek", "bigint", "相含多少个周，⌊5/7⌋ = 0"),
            Column("lengthOfPart", "bigint", "相含多少个旬，⌊5/10⌋ = 0"),
            Column("leap", "boolean", "是否闰相；相按朔望月等分，恒为 0"),
            Column("month", "bigint", "所属朔望月", references="synodic_month.identity"),
            *_span(),
        ],
        indexes=[("month", ["month"]), ("name", ["name"]), ("absolute", ["absolute"])],
        note="相是 5 天的单位，与候同长；end = 下一个相起点 - 1。",
    ),
    Table(
        name="climate",
        module="climate",
        comment="气候：长度为 5 天的气候单位，节气纪年的年/月表都由它推导而来。",
        columns=[
            _identity(),
            _absolute("全局气候序号，按时间升序"),
            _relative("该气候在所属朔望月内的序号"),
            Column("name", "text", "气候名"),
            Column("lengthOfDay", "bigint", "气候长，天数，5"),
            Column("lengthOfWeek", "bigint", "气候含多少个周，⌊5/7⌋ = 0"),
            Column("lengthOfPart", "bigint", "气候含多少个旬，⌊5/10⌋ = 0"),
            Column("leap", "boolean", "是否闰"),
            Column("month", "bigint", "所属朔望月", references="synodic_month.identity"),
            *_span(),
        ],
        indexes=[("month", ["month"]), ("name", ["name"]), ("absolute", ["absolute"])],
        note="每个朔望月内自月首起每 5 天一个气候，末段按月末截断。",
    ),
    Table(
        name="part",
        module="part",
        comment="旬：10 天。每个朔望月分上旬/中旬/下旬。",
        columns=[
            _identity(),
            _absolute("该旬在月内的序号 1-3"),
            Column("month", "bigint", "所属朔望月", references="synodic_month.identity"),
            Column("day", "bigint", "旬首在本月内的第几天，1/11/21"),
            *_span(),
        ],
        indexes=[("month", ["month"])],
    ),
    Table(
        name="week",
        module="week",
        comment="星期：7 天。以建元当天所在周为第 1 周。",
        columns=[
            _identity(),
            _absolute("该周在月内的序号，从 1 起"),
            Column("month", "bigint", "所属朔望月", references="synodic_month.identity"),
            Column("lengthOfDay", "bigint", "本周天数，7"),
            *_span(),
        ],
        indexes=[("month", ["month"])],
    ),
    Table(
        name="synodic_calendar_year",
        module="synodic",
        comment="朔望年。源表列 B 的纪年块，一年 12 或 13 个朔望月。",
        columns=[
            Column("identity", "bigint", "自增主键，由数据库生成"),
            _relative("本朔望年在本库里的序号，按时间升序从 1 起（首个纪年块为 1）"),
            Column("gregorian_year", "bigint", "纪年块标签，即纪年，可与 proleptic 格里高利历年不同"),
            Column("lengthOfMonth", "bigint", "长度，月（向 0 取整）：12 或 13"),
            Column("lengthOfPhenology", "bigint", "长度，候（向 0 取整）"),
            Column("lengthOfWeek", "bigint", "长度，周（向 0 取整）"),
            Column("lengthOfPart", "bigint", "长度，旬（向 0 取整）"),
            Column("lengthOfDay", "bigint", "长度，天（向 0 取整）"),
            Column("leap", "boolean", "是否闰年：含 13 个朔望月即为闰年"),
            *_span(),
        ],
        indexes=[("gregorian_year", ["gregorian_year"])],
        note="一年 12 或 13 个朔望月。lengthOfMonth 记该年实际有多少个朔望月（朔望月 29/30 天"
             "不等长，只能数）；lengthOfPhenology / lengthOfWeek / lengthOfPart / lengthOfDay "
             "是候（5 天）/ 周（7 天）/ 旬（10 天）/ 天这四个**固定长度**单位，按"
             "「本区间含多少个该单位，向 0 取整」= 区间秒数 // 单位秒数，"
             "与七部派生历法的年表逐字同口径。`chronology.lengthOfSynodicMonth` "
             "与该行的 lengthOfMonth 同值。",
    ),
    Table(
        name="synodic_month",
        module="synodic",
        comment="朔望月。源表一行一个月，是最细的、可直接落库的历法单位。",
        columns=[
            _identity(),
            _relative("积月，源表列 N：本纪年块内的第几个月，1 起"),
            _absolute("全局朔望月序号，建元当月为 1，可为负"),
            Column("year", "bigint", "所属纪年块", references="synodic_calendar_year.identity"),
            Column("ordinal", "bigint", "月序 1=正月 … 12=腊月"),
            Column("leap", "boolean", "是否闰月"),
            Column("size", "text", "月大小：大=30 天，小=29 天，来自源表公式 IF(C3=\"大\",30,29)"),
            Column("lengthOfDay", "bigint", "本月天数 29 或 30"),
            Column("name", "text", "月名，如 正月小 / 闰四月大"),
            Column("label", "text", "不含大小的月名，如 正月 / 闰四月"),
            Column("month_end_day", "bigint", "源表列 O 月末积日，源表在纪年块边界存在 ±1 天异常，仅作参考"),
            *_span(),
        ],
        indexes=[
            ("year", ["year"]),
            ("ordinal", ["ordinal"]),
            ("leap", ["leap"]),
            ("absolute", ["absolute"]),
        ],
        note="end = 下一月朔月 - 1 秒，故月末即下月月首的前一秒。",
    ),
    Table(
        name="epoch",
        module="epoch",
        comment="世：30 朔望年。建元所在的朔望年为第 1 世。",
        columns=[
            _identity(),
            _relative("本世在所属运内的序号 1-12"),
            _absolute("全局世序号，建元所在世为 1，可为负"),
            Column("perform", "bigint", "所属运", references="perform.identity"),
            *_span(),
        ],
        indexes=[("perform", ["perform"])],
        note="由 synodic_calendar_year 每 30 个朔望年一组推导，首尾都对齐工作簿。"
             "一个朔望年含 12 或 13 个朔望月，故一个世含 360-390 个朔望月。",
    ),
    Table(
        name="perform",
        module="perform",
        comment="运：12 世 = 360 朔望年。建元所在的朔望年为第 1 运。",
        columns=[
            _identity(),
            _relative("本运在所属会内的序号 1-30"),
            _absolute("全局运序号，建元所在运为 1，可为负"),
            Column("encounter", "bigint", "所属会", references="encounter.identity"),
            *_span(),
        ],
        indexes=[("encounter", ["encounter"])],
    ),
    Table(
        name="encounter",
        module="encounter",
        comment="会：30 运 = 360 世 = 10800 朔望年。建元所在的朔望年为第 1 会。",
        columns=[
            _identity(),
            _relative("本会在所属元内的序号 1-12"),
            _absolute("全局会序号，建元所在会为 1，可为负"),
            Column("primary", "bigint", "所属元", references="primary.identity"),
            *_span(),
        ],
        indexes=[("primary", ["primary"])],
    ),
    Table(
        name="primary",
        module="primary",
        comment="元：12 会 = 360 运 = 4320 世 = 129600 朔望年。",
        columns=[
            _identity(),
            _relative("元序号，建元所在元为 1"),
            _absolute("全局元序号，建元所在元为 1"),
            *_span(),
        ],
        note="朔望年总数 23,500 < 129600，故本库只有建元前后的第 0、1 元；"
             "建表与推导逻辑保持通用。",
    ),
    Table(
        name="dynasty",
        module="dynasty",
        comment="朝代。分期：上古（盘古以前）、神话（伏羲起）、历史（夏起）、现代（中华民国起）。",
        columns=[
            _identity(),
            _relative("朝内序号"),
            _absolute("全局朝代序号，按起始年升序"),
            Column("name", "text", "朝代名，如 夏朝 / 中华民国 / 当代"),
            Column("kind", "text", "分期：上古 / 神话 / 历史 / 现代"),
            Column("gregorian_year", "bigint", "起始年，天文纪年 proleptic 格里高利历，可为负"),
            Column("end_year", "bigint", "结束年；未终结的朝代写 0，并以 end 为 0 表示"),
            *_span(),
        ],
        indexes=[("name", ["name"]), ("kind", ["kind"]), ("gregorian_year", ["gregorian_year"])],
        note="起讫年取自 zh.wikipedia「中国朝代」，以简繁转换后的规范名入库。",
    ),
    Table(
        name="era",
        module="era",
        comment="年号。神话朝代自伏羲始，其后按历史典籍；当代年号为「」（空字符），故本表无当代记录。",
        columns=[
            _identity(),
            _relative("本朝内的年号序号"),
            _absolute("全局年号序号，按起始年升序"),
            Column("name", "text", "年号名，如 建元 / 民国 / 伏羲"),
            Column("kind", "text", "分期：神话 / 历史 / 现代"),
            Column("regime", "text", "政权名，源表原样记录，如 西汉 / 中华民国"),
            Column("ruler", "text", "君主，如 汉武帝刘彻"),
            Column("dynasty", "text", "所属朝代名，按政权名归并；归并不了的写空"),
            Column("gregorian_year", "bigint", "起始年"),
            Column("end_year", "bigint", "结束年"),
            Column("years", "text", "沿用年数，源表原样记录"),
            *_span(),
        ],
        indexes=[("name", ["name"]), ("kind", ["kind"]), ("dynasty", ["dynasty"])],
        note="一个年号可能跨年；起讫年为公元纪年，年份精度到年。",
    ),
    Table(
        name="person",
        module="person",
        comment="人物。是 Event.subject 的目标类型；历史资料只提供姓名，其余字段留空。",
        columns=[
            _identity(),
            _relative("全局序号"),
            _absolute("全局序号"),
            Column("name", "text", "姓名"),
            Column("gender", "text", "性别；历史资料未提供，写空"),
            Column("biography", "text", "生平；历史资料未提供，写空"),
            *_span(),
        ],
        indexes=[("name", ["name"])],
        note="行数据来自年号表出现过的君主姓名，去重后入库；gender/biography 无来源，保持空。",
    ),
    Table(
        name="event",
        module="event",
        comment="历史事件。只记两件事：年号起止、朝代更迭。其余史事不论。",
        columns=[
            _identity(),
            _relative("年内序号"),
            _absolute("全局事件序号，按时间升序"),
            Column("name", "text", "事件名，如 夏朝建立 / 改元建元"),
            Column("kind", "text", "dynasty_begin / dynasty_end / era_begin / era_end"),
            Column("subject", "text", "主要人：该年号的君主姓名；朝代事件写空"),
            Column("colony", "text", "群体：该年号的政权名；朝代事件写朝代名"),
            Column("cause", "text", "原因；本实体只记两类事件，无来源，写空"),
            Column("incident", "text", "事件过程和描述"),
            Column("result", "text", "结果；本实体只记两类事件，无来源，写空"),
            Column("gregorian_year", "bigint", "事件发生年，天文纪年 proleptic 格里高利历，可为负"),
            Column("dynasty", "bigint", "涉及朝代", references="dynasty.identity"),
            Column("era", "bigint", "涉及年号", references="era.identity"),
            *_span(),
        ],
        indexes=[
            ("kind", ["kind"]),
            ("gregorian_year", ["gregorian_year"]),
            ("dynasty", ["dynasty"]),
            ("era", ["era"]),
        ],
        note="年内只精确到年，故 start/end 取该年的第一天与最后一天。",
    ),
    Table(
        name="chronology",
        module="chronology",
        comment="纪年。一个朔望年一条，与八部历法的年表一一对应。",
        columns=[
            _identity(),
            _relative("本纪年在所属世内的序号 1-30"),
            _absolute("全局纪年序号，按时间升序"),
            Column("epoch", "bigint", "所属世", references="epoch.identity"),
            # 八部历法各一列年 + 一列月数，顺序与 src/entity/chronology.ts 一致
            Column("astronomy", "bigint", "天文纪年的年", references="astronomy_year.identity"),
            Column("lengthOfAstronomyMonth", "bigint", "天文纪年该年的月数"),
            Column("climate", "bigint", "节气纪年的年", references="climate_year.identity"),
            Column("lengthOfClimateMonth", "bigint", "节气纪年该年的月数，24"),
            Column("gregory", "bigint", "格里高利历的年", references="gregory_year.identity"),
            Column("lengthOfGregoryMonth", "bigint", "格里高利历该年的月数，12"),
            Column("jupiter", "bigint", "木星历法的年", references="jupiter_year.identity"),
            Column("lengthOfJupiterMonth", "bigint", "木星历法该年的月数，12"),
            Column("natural", "bigint", "轩辕纪年的年", references="natural_year.identity"),
            Column("lengthOfNaturalMonth", "bigint", "轩辕纪年该年的月数"),
            Column("tree", "bigint", "干支年的年", references="tree_year.identity"),
            Column("lengthOfTreeMonth", "bigint", "干支年该年的月数，12"),
            Column("tropical", "bigint", "回归年的年", references="tropical_year.identity"),
            Column("lengthOfTropicalMonth", "bigint", "回归年该年的月数，12"),
            Column("synodic", "bigint", "对应朔望年", references="synodic_calendar_year.identity"),
            Column("lengthOfSynodicMonth", "bigint", "该纪年朔望月的月数，12 或 13"),
            *_span(),
        ],
        indexes=[
            ("epoch", ["epoch"]),
            ("astronomy", ["astronomy"]),
            ("gregory", ["gregory"]),
            ("natural", ["natural"]),
            ("synodic", ["synodic"]),
        ],
        note="八部历法的年各取「**纪年首所在**」的那一年 —— 一个朔望年约 354 天，"
             "可能跨历法年（例如跨格里高利历的元旦），故以纪年的 start 定归属，"
             "与 `calendar.xlsx` 的纪年块标签取「块首所在年份」同一口径。"
             "`lengthOf<X>Month` 是那一年的月数，与各年表的 `lengthOfMonth` 同值。",
    ),
]

# --------------------------------------------------------------------------- #
# 由朔望月推导的其它历法：建表语句保持完整，行数据待生成
# --------------------------------------------------------------------------- #

_DERIVED_CALENDARS: list[tuple[str, str, str]] = [
    ("astronomy", "天文纪年", "按月相规则定建元"),
    ("climate", "节气纪年", "一年 24 个月，与 phenology 一一对应"),
    ("gregory", "格里高利历", "proleptic，可直接由 temporal 展开"),
    ("jupiter", "木星历法", "以木星岁星纪年"),
    ("natural", "轩辕纪年/黄帝纪年", "以建元 -2696-03-11 01:45:49 起算"),
    ("tree", "干支年", "以立春为分界"),
    ("tropical", "回归年", "以回归年为年长"),
]


def _calendar_module(module: str) -> str:
    """历法年 / 月表所属的模块名。

    默认 `<历法>.calendar`，避免与同名表撞名；`climate` 是唯一例外——气候表 `climate`
    与节气纪年的 `climate_year` / `climate_month` 同属模块 `climate`，
    由 `src/entity/climate.ts` 一个文件声明，也只建一个 `climate.sqlite`。
    """
    return module if module == "climate" else f"{module}.calendar"


for _module, _title, _comment in _DERIVED_CALENDARS:
    # 模块名默认加 `.calendar` 后缀，与同名表区分（表 `climate` 一类的同名历法）。
    # `climate` 是例外：气候表 `climate` 与节气纪年的 `climate_year` / `climate_month`
    # 同属模块 `climate`，见 `_calendar_module()`。
    _table_module = _calendar_module(_module)
    TABLES.append(
        Table(
            name=f"{_module}_year",
            module=_table_module,
            comment=f"{_title}的年。{_comment}。",
            columns=[
                _identity(),
                _relative("该类历法年在父级内的序号"),
                _absolute("全局年序号"),
                Column("lengthOfMonth", "bigint", "长度，月（向 0 取整）"),
                Column("lengthOfPhenology", "bigint", "长度，候（向 0 取整）"),
                Column("lengthOfWeek", "bigint", "长度，周（向 0 取整）"),
                Column("lengthOfPart", "bigint", "长度，旬（向 0 取整）"),
                Column("lengthOfDay", "bigint", "长度，天（向 0 取整）"),
                Column("leap", "boolean", "是否闰年"),
                *_span(),
            ],
            note="换算法则见 database/calendars.py：年界按各历法自己的规则定，"
                 "首尾按 calendar.xlsx 的覆盖区间截断，故年与年首尾相接。"
                 "tropical / jupiter / astronomy 没有星历表，年长取 RULE 给出的平均周期。",
        )
    )
    TABLES.append(
        Table(
            name=f"{_module}_month",
            module=_table_module,
            comment=f"{_title}的月。{_comment}。",
            columns=[
                _identity(),
                _relative("该类历法月在年内的序号"),
                _absolute("全局月序号"),
                Column("year", "bigint", "所属年", references=f"{_module}_year.identity"),
                Column("ordinal", "bigint", "月序"),
                Column("leap", "boolean", "是否闰月"),
                Column("lengthOfDay", "bigint", "本月天数"),
                Column("name", "text", "月名"),
                *_span(),
            ],
            indexes=[("year", ["year"])],
            note="换算法则见 database/calendars.py：月界按各历法自己的规则定，"
                 "首尾按所属年与覆盖区间截断，故月与月首尾相接、无缝无叠。",
        )
    )


# --------------------------------------------------------------------------- #
# 复数命名的属性 = ManyToMany 关联表
# --------------------------------------------------------------------------- #
#
# `src/entity/*.ts` 是实体的事实来源：接口里**属性名是复数**的（`months` /
# `phenologies` / `weeks` / `parts` / `eras` / `chronologies` / `performs` /
# `epoches`）表示一个集合，它**不是父表的一列**，而是一张独立的关联表：
#
#     表名   `<父表>_<复数属性>`，例如 astronomy_year_weeks
#     列     identity（自增主键）+ 父端列 + 子端列，两列各建索引
#     位置   与父表同库（一个实体一个 .sqlite）
#
# 两端常常跨库（如 astronomy_year 与 week），按 §3.1 只记录指向、不施加外键约束。
# 父端列取父表名去掉模块前缀后的末段（`synodic_calendar_year` -> `year`、`phase` ->
# `phase`），与各子表现有的外键列同名。
#
# 注意：与属性同名的标量列（例如老的 `astronomy_year.weeks` 记"本年周数"）是**错的**，
# 复数属性只以关联表表达；长度、数量一类标量另有 `lengthOfX` 列。


def _relation(
    parent: str,
    module: str,
    parent_column: str,
    property_name: str,
    child: str,
    child_column: str,
) -> Table:
    """由「父表 + 复数属性」生成一张 ManyToMany 关联表。"""
    return Table(
        name=f"{parent}_{property_name}",
        module=module,
        comment=f"{parent} × {child} 的多对多关联表：对应 entity 的 `{property_name}`。",
        columns=[
            _identity(),
            Column(
                parent_column,
                "bigint",
                f"父端 {parent}.identity",
                references=f"{parent}.identity",
            ),
            Column(
                child_column,
                "bigint",
                f"子端 {child}.identity",
                references=f"{child}.identity",
            ),
        ],
        indexes=[(parent_column, [parent_column]), (child_column, [child_column])],
        note="关联表只存两端 identity；两端常常跨库，不施加外键约束。",
        relation=(parent, parent_column, child, child_column),
    )


#: 历法的「年」表：(父表, 模块, 父列, 本历法的月表)
_CALENDAR_YEARS: list[tuple[str, str, str, str]] = [
    (f"{_module}_year", _calendar_module(_module), "year", f"{_module}_month")
    for _module, _title, _comment in _DERIVED_CALENDARS
] + [("synodic_calendar_year", "synodic", "year", "synodic_month")]

#: 历法的「月」表：(父表, 模块, 父列)。月没有 `months` —— 月没有子月。
_CALENDAR_MONTHS: list[tuple[str, str, str]] = [
    (f"{_module}_month", _calendar_module(_module), "month")
    for _module, _title, _comment in _DERIVED_CALENDARS
] + [("synodic_month", "synodic", "month")]

#: 年与月都有的复数属性：(属性名, 子表, 子列)
_CALENDAR_PROPERTIES: list[tuple[str, str, str]] = [
    ("phenologies", "phenology", "phenology"),
    ("weeks", "week", "week"),
    ("parts", "part", "part"),
]

#: 其余父表的关联表：(父表, 模块, 父列, 复数属性, 子表, 子列)
_OTHER_RELATIONS: list[tuple[str, str, str, str, str, str]] = [
    ("climate", "climate", "climate", "weeks", "week", "week"),
    ("climate", "climate", "climate", "parts", "part", "part"),
    ("phase", "phase", "phase", "weeks", "week", "week"),
    ("phase", "phase", "phase", "parts", "part", "part"),
    ("dynasty", "dynasty", "dynasty", "eras", "era", "era"),
    ("dynasty", "dynasty", "dynasty", "chronologies", "chronology", "chronology"),
    ("era", "era", "era", "chronologies", "chronology", "chronology"),
    ("epoch", "epoch", "epoch", "chronologies", "chronology", "chronology"),
    ("encounter", "encounter", "encounter", "performs", "perform", "perform"),
    ("perform", "perform", "perform", "epoches", "epoch", "epoch"),
    ("primary", "primary", "primary", "performs", "perform", "perform"),
]

for _parent, _module, _parent_column, _month_table in _CALENDAR_YEARS:
    TABLES.append(_relation(_parent, _module, _parent_column, "months", _month_table, "month"))
    for _property, _child, _child_column in _CALENDAR_PROPERTIES:
        TABLES.append(_relation(_parent, _module, _parent_column, _property, _child, _child_column))

for _parent, _module, _parent_column in _CALENDAR_MONTHS:
    for _property, _child, _child_column in _CALENDAR_PROPERTIES:
        TABLES.append(_relation(_parent, _module, _parent_column, _property, _child, _child_column))

for _parent, _module, _parent_column, _property, _child, _child_column in _OTHER_RELATIONS:
    TABLES.append(_relation(_parent, _module, _parent_column, _property, _child, _child_column))


def by_module(module: str) -> list[Table]:
    """某个实体模块负责的表。

    必须用精确相等：模块名里带点（如 `astronomy.calendar`）时，
    子串匹配会把 `astronomy` 的表也算进来。
    """
    return [table for table in TABLES if table.module == module]


def table_of(name: str) -> Table:
    """按表名取表定义。"""
    for table in TABLES:
        if table.name == name:
            return table
    raise KeyError(f"没有表 {name}")


def foreign_columns(table: Table) -> list[Column]:
    """本表里指向别的表的列（跨库外键，SQLite 不施加约束，由构建脚本填值）。"""
    return [column for column in table.columns if column.references]


# --------------------------------------------------------------------------- #
# DDL 生成
# --------------------------------------------------------------------------- #

def _quote(name: str) -> str:
    return f'"{name}"'


def emit_sqlite(table: Table) -> str:
    """生成 SQLite 建表语句（一份可直接执行的 SQL 文本）。

    主键 `identity` 一律渲染成 `INTEGER PRIMARY KEY AUTOINCREMENT`：
    自增、单调、不复用已删除的号。业务上的绝对时间等语义放在 `absolute` 等列里，
    不再拿主键承载。
    """
    lines = [f"-- {table.comment}"]
    if table.note:
        lines.append(f"-- {table.note}")
    lines.append(f"CREATE TABLE IF NOT EXISTS {_quote(table.name)} (")
    definitions = []
    for column in table.columns:
        if column.auto:
            definitions.append(f"    {_quote(column.name)} INTEGER PRIMARY KEY AUTOINCREMENT")
            continue
        part = f"    {_quote(column.name)} {column.sqlite_type()}"
        if not column.nullable:
            part += " NOT NULL"
        if column.default is not None:
            part += f" DEFAULT {column.default}"
        definitions.append(part)
    lines.append(",\n".join(definitions))
    lines.append(");")
    for index_name, columns in table.indexes:
        joined = ", ".join(_quote(name) for name in columns)
        lines.append(
            f"CREATE INDEX IF NOT EXISTS {_quote(f'idx_{table.name}_{index_name}')} "
            f"ON {_quote(table.name)} ({joined});"
        )
    return "\n".join(lines) + "\n"


def emit_sql(table: Table) -> str:
    """生成通用 SQL 建表语句，附带外键约束。

    自增主键用 SQL 标准的 `GENERATED BY DEFAULT AS IDENTITY`，
    PostgreSQL / H2 / DB2 / Oracle 12c+ 均可直接执行。
    """
    lines = [f"-- {table.comment}"]
    if table.note:
        lines.append(f"-- {table.note}")
    lines.append(f"CREATE TABLE {_quote(table.name)} (")
    definitions = []
    for column in table.columns:
        if column.auto:
            definitions.append(
                f"    {_quote(column.name)} BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
            )
            continue
        part = f"    {_quote(column.name)} {column.sql_type()}"
        if not column.nullable:
            part += " NOT NULL"
        definitions.append(part)
    for column in table.columns:
        if column.references:
            target_table, target_column = column.references.split(".")
            definitions.append(
                f"    FOREIGN KEY ({_quote(column.name)}) "
                f"REFERENCES {_quote(target_table)} ({_quote(target_column)})"
            )
    lines.append(",\n".join(definitions))
    lines.append(");")
    for index_name, columns in table.indexes:
        joined = ", ".join(_quote(name) for name in columns)
        lines.append(f"CREATE INDEX {_quote(f'idx_{table.name}_{index_name}')} ON {_quote(table.name)} ({joined});")
    return "\n".join(lines) + "\n"
