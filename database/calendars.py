"""database.calendars：七部派生历法的换算法则（年界与月界）。

七部历法（`astronomy` / `climate` / `gregory` / `jupiter` / `natural` / `tree` /
`tropical`）的实体形状与 `synodic` 一致（一张年表 + 一张月表，见
`database/schema.py` 的 `_DERIVED_CALENDARS`），差别只在**年界与月界怎么定**。
本模块把这七套规则集中实现一次：

- `database/derived.py` 与 `database/climate.py` 从这里取年 / 月区间去写行；
- `database/temporal.py` 也用它把派生历法的全部边界时刻收进 `temporal` ——
  这些表的 `start` / `end` 是 `temporal.identity` 的外键，不先收进来就会指向不存在的行。

各部的规则（与 `database/<module>.py` 的 `RULE` 常量逐字对应）：

| 模块               | 年界                                    | 月界                       |
| ------------------ | --------------------------------------- | -------------------------- |
| `gregory.calendar` | proleptic 格里高利历的 1 月 1 日         | 历月 1 日                  |
| `climate`          | 立春（主节气）                           | 24 个节气 / 中气，逐个起算 |
| `tree.calendar`    | 立春                                     | 12 个「节」                |
| `tropical.calendar`| 建元 + n × 365.2422 日                   | 回归年 12 等分             |
| `astronomy.calendar`| 建元 + n × 365.2422 日之后的第一个朔月   | 朔望月                     |
| `jupiter.calendar` | 建元 + n × 11.862 年（岁星周期）          | 木星年 12 等分             |
| `natural.calendar` | 建元所在的纪年块（轩辕 1 年 1 月 1 日）   | 朔望月                     |

口径说明：

- **建元**（`ANCHOR`）一律取 `-2696-03-11 01:45:49` 的绝对时间；源工作簿里它恰好是
  一个朔月的月首（`正月小`，纪年块 -2696），因此 `natural` 的 1 年 1 月 1 日与
  `astronomy` 的年首天然对齐。
- `tropical` / `jupiter` / `astronomy` 没有星历表，年长取各自 `RULE` 给出的**平均**
  周期（回归年 365.2422 日、岁星 11.862 年），不是逐年的真值。这是本项目明确接受的
  近似口径；将来有星历表，只需替换本模块里对应的 `_uniform_*` / `_astronomy_*`。
- 七部历法一律**平铺整个工作簿覆盖区间**：首尾按覆盖区间截断，保证年与年、月与月之间
  `[start, end]` 闭区间首尾相接、无缝隙、不重叠，也保证端点都落在 `temporal` 里。
- `relative` 依 `Proleptic` 的约定（"在父表依赖层级当中的相对唯一序列数"）：
  年表没有父表，取它所属**元**（1 元 = 129600 朔望月）内的序号；月表取年内的序号。
"""

from __future__ import annotations

import bisect
from dataclasses import dataclass

from .core import EPOCH, absolute_of, decompose
from .source import Workbook

__all__ = [
    "ANCHOR",
    "JUPITER_YEARS",
    "MODULES",
    "SECONDS_PER_DAY",
    "TROPICAL_YEAR_DAYS",
    "Unit",
    "coverage",
    "months",
    "stamps",
    "years",
]

SECONDS_PER_DAY = 86_400

#: 建元：-2696-03-11 01:45:49，源工作簿里恰好是一个朔月的月首
ANCHOR = absolute_of(
    (EPOCH.year, EPOCH.month, EPOCH.day, EPOCH.hour, EPOCH.minute, EPOCH.second)
)

#: 回归年长，日（`database/tropical.py` 的 RULE）
TROPICAL_YEAR_DAYS = 365.2422
#: 岁星（木星）周期，回归年（`database/jupiter.py` 的 RULE）
JUPITER_YEARS = 11.862
#: 1 元 = 129600 朔望月（`database/primary.py`）
MONTHS_PER_PRIMARY = 129_600

#: 一个回归年的秒数 31,556,926.08 = 365.2422 × 86400，用整数比表示以免浮点累积漂移
_YEAR_NUM = 3_155_692_608
_YEAR_DEN = 100
#: 一个木星年的秒数 = 11.862 × 回归年
_JUPITER_NUM = 11_862 * _YEAR_NUM
_JUPITER_DEN = 1_000 * _YEAR_DEN

#: 本模块实现的历法模块名（与 `database/schema.py` 的 `_DERIVED_CALENDARS` 一致）
MODULES: tuple[str, ...] = (
    "astronomy.calendar",
    "climate",
    "gregory.calendar",
    "jupiter.calendar",
    "natural.calendar",
    "tree.calendar",
    "tropical.calendar",
)

#: 主节气（「节」）在源表里的 kind
KIND_TERM = 1
#: 节气年 / 干支年的年界
YEAR_TERM_NAME = "立春"
#: 干支月的月界：十二「节」，元组顺序即月序
TREE_MONTH_TERMS: tuple[str, ...] = (
    "立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
    "立秋", "白露", "寒露", "立冬", "大雪", "小寒",
)
#: 干支月的月名（地支月）：立春起寅月
TREE_MONTH_NAMES: tuple[str, ...] = (
    "寅月", "卯月", "辰月", "巳月", "午月", "未月",
    "申月", "酉月", "戌月", "亥月", "子月", "丑月",
)
#: 十二个月的月名（朔望月的叫法）
_ORDINAL_NAMES: tuple[str, ...] = (
    "正月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "冬月", "腊月",
)
#: 轩辕纪年：建元所在纪年块标签 -2696 即轩辕 1 年
NATURAL_YEAR_OFFSET = 2697


@dataclass(slots=True)
class Unit:
    """一个年或一个月的区间，以及写行需要的派生量。"""

    start: int
    end: int
    #: 该单位在本历法里的全局序号 / 年号
    absolute: int
    #: 在父级内的序号（月 -> 年内的序号；年 -> 所属元内的序号，由 `years()` 填）
    relative: int = 0
    #: 名字（月名 / 节气名；年为 ""）
    name: str = ""
    #: 序数（月的月序 1-12 / 1-24；年为 0）
    ordinal: int = 0
    #: 是否闰（闰月 / 闰年 / 格里高利历的闰年）
    leap: bool = False

    @property
    def seconds(self) -> int:
        """区间长度，秒（闭区间）。"""
        return self.end - self.start + 1

    @property
    def days(self) -> int:
        """区间含多少个整天，向 0 取整。"""
        return self.seconds // SECONDS_PER_DAY


# --------------------------------------------------------------------------- #
# 覆盖区间与元序号
# --------------------------------------------------------------------------- #

def coverage(workbook: Workbook) -> tuple[int, int]:
    """工作簿覆盖的时间区间：首个朔月的月首 … 末个朔月的月末。"""
    return workbook.months[0].absolute, workbook.month_ends[-1]


class MonthAxis:
    """绝对时间 -> 全局朔望月序号 / 元序号。"""

    __slots__ = ("starts", "first_index")

    def __init__(self, workbook: Workbook) -> None:
        self.starts = [month.absolute for month in workbook.months]
        self.first_index = workbook.first_month_index

    def index_of(self, absolute: int) -> int:
        """包含该瞬间的朔望月的全局序号（建元当月为 1，可为负）。"""
        position = bisect.bisect_right(self.starts, absolute) - 1
        position = max(0, min(position, len(self.starts) - 1))
        return self.first_index + position

    def primary_of(self, absolute: int) -> int:
        """包含该瞬间的元的序号（建元所在元为 1）。"""
        return (self.index_of(absolute) - 1) // MONTHS_PER_PRIMARY + 1


def _fill_primary_relative(axis: MonthAxis, units: list[Unit]) -> None:
    """把年表的 `relative` 填成"所属元内的序号"。

    元按朔望月切分（`database/primary.py`）；一个历法年可能跨元，按年首归属。
    """
    counters: dict[int, int] = {}
    for unit in units:
        order = axis.primary_of(unit.start)
        counters[order] = counters.get(order, 0) + 1
        unit.relative = counters[order]


# --------------------------------------------------------------------------- #
# 整数运算
# --------------------------------------------------------------------------- #

def _round_div(numerator: int, denominator: int) -> int:
    """四舍五入的整数除法（负数也按 floor 语义正确）。"""
    return (2 * numerator + denominator) // (2 * denominator)


def _scaled(anchor: int, index: int, num: int, den: int) -> int:
    """`anchor + round(index × num / den)`。"""
    return anchor + _round_div(index * num, den)


def _is_gregorian_leap(year: int) -> bool:
    """proleptic 格里高利历的闰年（天文纪年，0 年与负数年同样适用）。"""
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def _next_month_start(year: int, month: int) -> int:
    """下一个月首：12 月接次年 1 月，避免给 `day_number` 传 13 月。"""
    if month == 12:
        return absolute_of((year + 1, 1, 1, 0, 0, 0))
    return absolute_of((year, month + 1, 1, 0, 0, 0))


# --------------------------------------------------------------------------- #
# 源工作簿里的节气
# --------------------------------------------------------------------------- #

def _terms(workbook: Workbook) -> list[tuple[int, str, int]]:
    """全部节气，按时间升序：`(绝对时间, 名字, kind)`。"""
    rows = [
        (term.absolute, term.name, term.kind)
        for month in workbook.months
        for term in month.terms
    ]
    rows.sort()
    return rows


def _term_year_bounds(
    workbook: Workbook,
) -> list[tuple[int, int, list[tuple[int, str, int]]]]:
    """按立春切出的节气年：`[(年首, 年尾, 年内节气)]`，铺满整个覆盖区间。

    源工作簿的首条节气（立春）比首个朔月晚约 2 天、末条节气（大寒）比末个月末早约 6 天，
    因此**首年向前延伸到覆盖区间起点**，末年则由下一条立春（或覆盖区间终点）收尾，
    这样年与年之间仍然首尾相接。
    """
    low, high = coverage(workbook)
    terms = _terms(workbook)
    starts = [
        index
        for index, (_, name, kind) in enumerate(terms)
        if kind == KIND_TERM and name == YEAR_TERM_NAME
    ]
    if not starts:
        raise ValueError("工作簿里没有立春，无法切分节气年 / 干支年")
    bounds: list[tuple[int, int, list[tuple[int, str, int]]]] = []
    for order, index in enumerate(starts):
        following = starts[order + 1] if order + 1 < len(starts) else len(terms)
        start = low if order == 0 else terms[index][0]
        end = terms[following][0] - 1 if order + 1 < len(starts) else high
        bounds.append((start, end, terms[index:following]))
    return bounds


# --------------------------------------------------------------------------- #
# 各历法的年 / 月区间
# --------------------------------------------------------------------------- #

def _gregory(workbook: Workbook, *, year_level: bool) -> list[Unit]:
    """proleptic 格里高利历：年界 1 月 1 日、月界各月 1 日。"""
    low, high = coverage(workbook)
    first = decompose(low)[2]
    last = decompose(high)[2]
    units: list[Unit] = []
    month_ordinal = 0
    for year in range(first, last + 1):
        year_start = max(absolute_of((year, 1, 1, 0, 0, 0)), low)
        year_end = min(absolute_of((year, 12, 31, 23, 59, 59)), high)
        if year_start > year_end:
            continue
        if year_level:
            units.append(
                Unit(year_start, year_end, year, leap=_is_gregorian_leap(year))
            )
            continue
        for month in range(1, 13):
            start = max(absolute_of((year, month, 1, 0, 0, 0)), year_start)
            end = min(_next_month_start(year, month) - 1, year_end)
            if start > end:
                continue
            month_ordinal += 1
            units.append(
                Unit(start, end, month_ordinal, month, _ORDINAL_NAMES[month - 1], month)
            )
    return units


def _term_years(workbook: Workbook) -> list[Unit]:
    """节气纪年的年：立春到下一个立春前 1 秒。"""
    return [
        Unit(start, end, order)
        for order, (start, end, _) in enumerate(_term_year_bounds(workbook), start=1)
    ]


def _term_months(workbook: Workbook) -> list[Unit]:
    """节气纪年的月：一年 24 个月，每月以主节气或主中气起算。

    月界取年内各节气的时刻；**首个节气所属的那个月向前延伸到年首**，
    因此首年（从前一个立春之前开始）的第一个月仍然与年首对齐。
    """
    units: list[Unit] = []
    absolute = 0
    for year_start, year_end, terms in _term_year_bounds(workbook):
        edges = [year_start] + [start for start, _, _ in terms[1:]]
        for order, start in enumerate(edges, start=1):
            end = edges[order] - 1 if order < len(edges) else year_end
            absolute += 1
            units.append(Unit(start, end, absolute, order, terms[order - 1][1], order))
    return units


def _tree_years(workbook: Workbook) -> list[Unit]:
    """干支年：以立春为年界，年号取立春所在的 proleptic 格里高利历年。"""
    return [
        Unit(start, end, decompose(start)[2])
        for start, end, _ in _term_year_bounds(workbook)
    ]


def _tree_months(workbook: Workbook) -> list[Unit]:
    """干支月：一年 12 个月，以十二「节」为月界（立春起寅月）。

    与节气纪年同理：首个「节」所属的那个月向前延伸到年首。
    """
    units: list[Unit] = []
    absolute = 0
    for year_start, year_end, terms in _term_year_bounds(workbook):
        edges = [
            (start, name)
            for start, name, kind in terms
            if kind == KIND_TERM and name in TREE_MONTH_TERMS
        ]
        if not edges:
            continue
        starts = [year_start] + [start for start, _ in edges[1:]]
        for order, start in enumerate(starts, start=1):
            end = starts[order] - 1 if order < len(starts) else year_end
            absolute += 1
            name = TREE_MONTH_NAMES[TREE_MONTH_TERMS.index(edges[order - 1][1])]
            units.append(Unit(start, end, absolute, order, name, order))
    return units


def _uniform_span(workbook: Workbook, num: int, den: int) -> tuple[int, int]:
    """等长周期的首末序号：取到能铺满覆盖区间为止（两端各外扩 1）。"""
    low, high = coverage(workbook)
    return (low - ANCHOR) * den // num - 1, (high - ANCHOR) * den // num + 2


def _uniform_years(workbook: Workbook, num: int, den: int) -> list[Unit]:
    """等长年：年首 = 建元 + n × (num/den) 秒。"""
    low, high = coverage(workbook)
    first, last = _uniform_span(workbook, num, den)
    units: list[Unit] = []
    for index in range(first, last + 1):
        start = max(_scaled(ANCHOR, index, num, den), low)
        end = min(_scaled(ANCHOR, index + 1, num, den) - 1, high)
        if start > end:
            continue
        units.append(Unit(start, end, index + 1))
    return units


def _uniform_months(workbook: Workbook, num: int, den: int, count: int) -> list[Unit]:
    """等长年再等分成 `count` 个月；月首 = 建元 + round(k × num/(den×count))。"""
    low, high = coverage(workbook)
    first, last = _uniform_span(workbook, num, den)
    units: list[Unit] = []
    absolute = 0
    for index in range(first, last + 1):
        year_start = _scaled(ANCHOR, index, num, den)
        if year_start + _round_div(num, den) <= low:
            continue
        if year_start > high:
            break
        for order in range(1, count + 1):
            start = max(_scaled(ANCHOR, index * count + order - 1, num, den * count), low)
            end = min(_scaled(ANCHOR, index * count + order, num, den * count) - 1, high)
            if start > end:
                continue
            absolute += 1
            units.append(
                Unit(start, end, absolute, order,
                     _ORDINAL_NAMES[(order - 1) % 12], order)
            )
    return units


def _astronomy_years(workbook: Workbook) -> list[Unit]:
    """天文纪年：年由合朔时刻与回归年长定界 —— 取回归年界之后的第一个朔月。"""
    low, high = coverage(workbook)
    starts = [month.absolute for month in workbook.months]
    index = _uniform_span(workbook, _YEAR_NUM, _YEAR_DEN)[0]
    # 从"回归年界不早于覆盖区间起点"的第一个 n 开始，否则远处那些 n 会全部塌到同一个朔月
    while _scaled(ANCHOR, index, _YEAR_NUM, _YEAR_DEN) < low:
        index += 1
    edges: list[int] = []
    while True:
        target = _scaled(ANCHOR, index, _YEAR_NUM, _YEAR_DEN)
        if target > high:
            break
        position = bisect.bisect_left(starts, target)
        if position >= len(starts):
            break
        edge = starts[position]
        if not edges or edge > edges[-1]:
            edges.append(edge)
        index += 1
    if edges and edges[0] > low:
        edges.insert(0, low)
    units: list[Unit] = []
    for order, start in enumerate(edges, start=1):
        end = edges[order] - 1 if order < len(edges) else high
        units.append(Unit(start, end, order))
    return units


def _astronomy_months(workbook: Workbook) -> list[Unit]:
    """天文纪年的月即朔望月：按年界切分，首尾两个月按年界截断。"""
    units: list[Unit] = []
    absolute = 0
    position = 0
    months = workbook.months
    for year in _astronomy_years(workbook):
        while position < len(months) and months[position].absolute < year.start:
            position += 1
        relative = 0
        while position < len(months) and months[position].absolute <= year.end:
            month = months[position]
            start = max(month.absolute, year.start)
            end = min(workbook.month_ends[position], year.end)
            position += 1
            if start > end:
                continue
            relative += 1
            absolute += 1
            units.append(
                Unit(start, end, absolute, relative, month.name, month.ordinal, month.leap)
            )
    return units


def _natural_grouped(workbook: Workbook) -> list[tuple[int, list[int]]]:
    """轩辕纪年沿用朔望年的纪年块切分：`[(纪年块标签, 月位置)]`，按时间升序。"""
    grouped: dict[int, list[int]] = {}
    for position, month in enumerate(workbook.months):
        grouped.setdefault(month.year_label, []).append(position)
    return sorted(grouped.items())


def _natural_years(workbook: Workbook) -> list[Unit]:
    """轩辕纪年：建元当天为 1 年 1 月 1 日；年 = 纪年块，年号 = 标签 + 2697。"""
    units: list[Unit] = []
    for label, positions in _natural_grouped(workbook):
        units.append(
            Unit(
                workbook.months[positions[0]].absolute,
                workbook.month_ends[positions[-1]],
                label + NATURAL_YEAR_OFFSET,
                leap=len(positions) == 13,
            )
        )
    return units


def _natural_months(workbook: Workbook) -> list[Unit]:
    """轩辕纪年的月即朔望月，`absolute` 与 `synodic_month.absolute` 同值。"""
    units: list[Unit] = []
    for _, positions in _natural_grouped(workbook):
        for order, position in enumerate(positions, start=1):
            month = workbook.months[position]
            units.append(
                Unit(
                    month.absolute,
                    workbook.month_ends[position],
                    workbook.month_index(position),
                    order,
                    month.name,
                    month.ordinal,
                    month.leap,
                )
            )
    return units


_YEAR_RULES = {
    "gregory.calendar": lambda workbook: _gregory(workbook, year_level=True),
    "climate": _term_years,
    "tree.calendar": _tree_years,
    "tropical.calendar": lambda workbook: _uniform_years(workbook, _YEAR_NUM, _YEAR_DEN),
    "jupiter.calendar": lambda workbook: _uniform_years(workbook, _JUPITER_NUM, _JUPITER_DEN),
    "astronomy.calendar": _astronomy_years,
    "natural.calendar": _natural_years,
}

_MONTH_RULES = {
    "gregory.calendar": lambda workbook: _gregory(workbook, year_level=False),
    "climate": _term_months,
    "tree.calendar": _tree_months,
    "tropical.calendar": lambda workbook: _uniform_months(workbook, _YEAR_NUM, _YEAR_DEN, 12),
    "jupiter.calendar": lambda workbook: _uniform_months(workbook, _JUPITER_NUM, _JUPITER_DEN, 12),
    "astronomy.calendar": _astronomy_months,
    "natural.calendar": _natural_months,
}


# --------------------------------------------------------------------------- #
# 对外入口
# --------------------------------------------------------------------------- #

def years(workbook: Workbook, module: str) -> list[Unit]:
    """某部历法的全部年，按时间升序，铺满整个工作簿区间。

    `relative` 已填成"所属元内的序号"（`Proleptic` 的父级约定）。
    """
    rule = _YEAR_RULES.get(module)
    if rule is None:
        raise KeyError(f"没有派生历法 {module}")
    units = rule(workbook)
    _fill_primary_relative(MonthAxis(workbook), units)
    return units


def months(workbook: Workbook, module: str) -> list[Unit]:
    """某部历法的全部月，按时间升序，`relative` 是年内的序号。"""
    rule = _MONTH_RULES.get(module)
    if rule is None:
        raise KeyError(f"没有派生历法 {module}")
    return rule(workbook)


def stamps(workbook: Workbook) -> set[int]:
    """七部派生历法用到的全部边界时刻。

    `temporal` 必须收录它们，否则这些表的 `start` / `end` 会指向不存在的行
    （`database/verify.py` 的区间端点核对就是这么查的）。
    """
    found: set[int] = set()
    for module in MODULES:
        for unit in years(workbook, module):
            found.add(unit.start)
            found.add(unit.end)
        for unit in months(workbook, module):
            found.add(unit.start)
            found.add(unit.end)
    return found
