"""database.source：calendar.xlsx 的唯一解析入口。

整本工作簿只解析一次，得到 `Workbook`；各实体模块只从它取自己需要的字段，
因此 `database/*.py` 之间不会互相读取源文件，也不会重复解析 24 个工作表。

源表结构（见 docs/design.md §1）：

    列 B 纪年块标签 | C 月名 | D 朔月 | E 上弦 | F 望月 | G 下弦
    H 主节气 | I 主节气时刻 | J 主中气 | K 主中气时刻 | L 副节中气 | M 副节中气时刻
    N 积月 | O 月末积日
"""

from __future__ import annotations

import bisect
import re
from dataclasses import dataclass, field
from typing import Any, Iterator, Sequence

from .core import absolute_of, day_number, parse_timestamp, sheet_span, worksheet_order

__all__ = [
    "Group",
    "Month",
    "Term",
    "Workbook",
    "YEAR_INDEX_OFFSET",
    "group_months",
    "group_years",
    "read_workbook",
]

MONTH_NAME = re.compile(r"^(闰)?(正月|二月|三月|四月|五月|六月|七月|八月|九月|十月|冬月|腊月)(大|小)$")

#: 朔望年的全局年号相对源表纪年块标签的偏移：
#: 建元 -2696-03-11 01:45:49 当天正是纪年块 -2696 的正月月首，故 `-2696 + 2697 = 1`，
#: 也就是说「建元所在的朔望年」是第 1 年。元/会/运/世四层都按这个年号切分。
YEAR_INDEX_OFFSET = 2697

#: 月名中的序数：正月=1 … 腊月=12
ORDINALS: dict[str, int] = {
    "正月": 1,
    "二月": 2,
    "三月": 3,
    "四月": 4,
    "五月": 5,
    "六月": 6,
    "七月": 7,
    "八月": 8,
    "九月": 9,
    "十月": 10,
    "冬月": 11,
    "腊月": 12,
}

#: 月大小 -> 天数，等价于源表公式 `=IF(C3="大",30,29)`
SIZES: dict[str, int] = {"大": 30, "小": 29}

#: 列下标
COL_YEAR_LABEL = 1
COL_MONTH_NAME = 2
COL_NEW_MOON = 3
COL_FIRST_QUARTER = 4
COL_FULL_MOON = 5
COL_LAST_QUARTER = 6
COL_TERM_NAME = 7
COL_TERM_TIME = 8
COL_QI_NAME = 9
COL_QI_TIME = 10
COL_AUX_NAME = 11
COL_AUX_TIME = 12
COL_MONTH_COUNT = 13
COL_MONTH_END_DAY = 14

#: 节气类别
KIND_TERM = 1      # 主节气
KIND_QI = 2        # 主中气
KIND_AUX = 3       # 副节中气


@dataclass(slots=True)
class Term:
    """源表 H~M 列的一行节气记录（主节气 / 主中气 / 副节中气）。"""

    kind: int
    name: str
    absolute: int


@dataclass(slots=True)
class Month:
    """一个朔望月，即源表的一行。"""

    sheet: str
    row: int
    absolute: int                 # 朔月（月首）绝对时间
    year_label: int               # 所属纪年块标签（列 B）
    month_count: int              # 积月（块内序号，列 N）
    name: str                     # 月名（列 C），例如 "闰正月小"
    leap: bool
    ordinal: int                  # 1=正月 … 12=腊月
    size: str                     # "大" | "小"
    length: int                   # 该月天数 29 | 30
    month_end_day: int | None     # 月末积日（列 O），源表存在边界异常，仅作参考
    new_moon: int                 # 朔月   absolute
    first_quarter: int            # 上弦   absolute
    full_moon: int                # 望月   absolute
    last_quarter: int             # 下弦   absolute
    terms: list[Term] = field(default_factory=list)


@dataclass(slots=True)
class Workbook:
    """整本工作簿的解析结果。"""

    months: list[Month]
    sheets: list[str]
    first_absolute: int
    last_absolute: int
    #: `months[0]` 的全局朔望月序号（建元当月 = 1，故首行通常为负）
    first_month_index: int
    #: 每个月的结束瞬间（闭区间末端），由相邻月首推导
    month_ends: list[int] = field(default_factory=list)
    #: 派生时间点缓存，见 derived_stamps()
    _derived: set[int] | None = field(default=None, repr=False, compare=False)

    def month_index(self, position: int) -> int:
        """行位置 -> 全局朔望月序号（建元当月 = 1，可为负）。"""
        return self.first_month_index + position

    def derived_stamps(self) -> set[int]:
        """全库派生时间点：月末、旬首、周首/周末、月相末端。

        `temporal` 表必须覆盖以上全部时间点，否则外键会指向不存在的行。
        """
        cached = self._derived
        if cached is not None:
            return cached
        stamps: set[int] = set()
        for position, month in enumerate(self.months):
            end = self.month_ends[position]
            stamps.add(end)
            # 旬：上旬 1-10、中旬 11-20、下旬 21-月末
            # part.rows 的 start 是 月首 / 月首+10天 / 月首+20天，end 是各段末秒
            stamps.add(month.absolute + 10 * 86_400)
            stamps.add(month.absolute + 20 * 86_400)
            stamps.add(month.absolute + 10 * 86_400 - 1)
            stamps.add(month.absolute + 20 * 86_400 - 1)
            # 气候：自月首起每 5 天一段，末段按月末截断
            # climate.rows 的 start 是每个 5 天段的起点，end 是各段末秒
            step = month.absolute + 5 * 86_400
            while step <= end:
                stamps.add(step)
                stamps.add(step - 1)
                stamps.add(step + 5 * 86_400 - 1)
                step += 5 * 86_400
            # 周：自本月初起每 7 天一段，切到月底
            week_start = month.absolute
            while week_start <= end:
                stamps.add(week_start)
                stamps.add(min(week_start + 7 * 86_400 - 1, end))
                week_start += 7 * 86_400
            # 月相区间末端 = 下一个月相起点 - 1，末相再顺延一个朔望月
            stamps.add(month.first_quarter - 1)
            stamps.add(month.full_moon - 1)
            stamps.add(month.last_quarter - 1)
            stamps.add(month.last_quarter + 29 * 86_400 - 1)
            # 候区间末端 = 下一条候起点 - 1，年末最后一条取纪年块的结束瞬间
            stamps.add(end - 1)
        for month in self.months:
            for term in month.terms:
                stamps.add(term.absolute - 1)
        self._derived = stamps
        return stamps

    def finish(self) -> None:
        """补齐 `month_ends`：end = 下一月首 - 1 秒；最后一个月按下一个月长推导。"""
        self.month_ends = []
        for position in range(len(self.months)):
            if position + 1 < len(self.months):
                following = self.months[position + 1].absolute
            else:
                following = self.months[position].absolute + self.months[position].length * 86_400
            self.month_ends.append(following - 1)


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _parse_term(row: Sequence[Any], name_column: int, time_column: int, kind: int) -> Term | None:
    name = _clean(row[name_column])
    raw_time = _clean(row[time_column])
    if not name or not raw_time:
        return None
    return Term(kind=kind, name=name, absolute=absolute_of(parse_timestamp(raw_time)))


def read_workbook(path: str, *, epoch_day: int | None = None) -> Workbook:
    """解析 calendar.xlsx。整个项目只应调用一次。"""
    from openpyxl import load_workbook  # 延迟导入：只有构建阶段需要

    source = load_workbook(path, read_only=True, data_only=True)
    try:
        sheets = worksheet_order(source.sheetnames)
        months: list[Month] = []
        for sheet in sheets:
            worksheet = source[sheet]
            year_label = 0
            for row_index, row in enumerate(worksheet.iter_rows(min_row=3, values_only=True), start=3):
                name = _clean(row[COL_MONTH_NAME])
                if not name:
                    continue
                label = _clean(row[COL_YEAR_LABEL])
                if label:
                    year_label = int(label)
                matched = MONTH_NAME.match(name)
                if matched is None:
                    raise ValueError(f"{sheet}!C{row_index} 月名无法解析：{name!r}")
                leap, ordinal_name, size = matched.groups()
                new_moon = absolute_of(parse_timestamp(_clean(row[COL_NEW_MOON])))
                terms = [
                    term
                    for term in (
                        _parse_term(row, COL_TERM_NAME, COL_TERM_TIME, KIND_TERM),
                        _parse_term(row, COL_QI_NAME, COL_QI_TIME, KIND_QI),
                        _parse_term(row, COL_AUX_NAME, COL_AUX_TIME, KIND_AUX),
                    )
                    if term is not None
                ]
                month_count = row[COL_MONTH_COUNT]
                month_end_day = row[COL_MONTH_END_DAY]
                months.append(
                    Month(
                        sheet=sheet,
                        row=row_index,
                        absolute=new_moon,
                        year_label=year_label,
                        month_count=int(month_count) if isinstance(month_count, int) else 0,
                        name=name,
                        leap=bool(leap),
                        ordinal=ORDINALS[ordinal_name],
                        size=size,
                        length=SIZES[size],
                        month_end_day=int(month_end_day) if isinstance(month_end_day, int) else None,
                        new_moon=new_moon,
                        first_quarter=absolute_of(parse_timestamp(_clean(row[COL_FIRST_QUARTER]))),
                        full_moon=absolute_of(parse_timestamp(_clean(row[COL_FULL_MOON]))),
                        last_quarter=absolute_of(parse_timestamp(_clean(row[COL_LAST_QUARTER]))),
                        terms=terms,
                    )
                )
    finally:
        source.close()

    if not months:
        raise ValueError(f"{path} 中没有解析到任何朔望月")

    # 建元当月不在工作簿中：定位紧随其后的那一行，则建元当月序号为 1、首行序号为 2 - 位置。
    boundary = _first_non_negative(months)
    workbook = Workbook(
        months=months,
        sheets=sheets,
        first_absolute=months[0].absolute,
        last_absolute=months[-1].absolute,
        first_month_index=2 - boundary,
    )
    workbook.finish()
    return workbook


def _first_non_negative(months: list[Month]) -> int:
    """二分找到 absolute >= 0 的第一个月的位置（该月是建元当月的下一个月）。"""
    low, high = 0, len(months) - 1
    while low < high:
        middle = (low + high) // 2
        if months[middle].absolute < 0:
            low = middle + 1
        else:
            high = middle
    return low


@dataclass(slots=True)
class Group:
    """元/会/运/世层级的一个分组。

    切分的单位由调用方决定：`group_months()` 按朔望月切，`group_years()` 按朔望年切。
    无论按哪个单位，`first` / `last` 都记**全局月序**，因为各表的 `start` / `end`
    最终要落到月首 / 月末这两个时间点上。
    """

    order: int          # 全局序号，从 1 起（按时间先后）
    identity: int       # 分组的起始瞬间（首个月首的绝对时间）
    first: int          # 首个朔望月的全局月序
    last: int           # 末个朔望月的全局月序
    months: int         # 含有的朔望月数
    parent: int         # 父分组序号
    relative: int       # 在父级内的序号，从 1 起


def group_months(workbook: Workbook, size: int, parent_size: int | None = None) -> Iterator[Group]:
    """按 `size` 个朔望月一组切分全部朔望月，得到层级实体。

    `order`    = `floor((全局月序 - 1) / size) + 1`，全局一致（建元当月所在组为 1）
    `parent`   = `floor((order - 1) / parent_size) + 1`（`parent_size` 为 None 时等于 `order`）
    `relative` = 在父级内的序号，从 1 起
    """
    buckets: dict[int, list[int]] = {}
    for position in range(len(workbook.months)):
        order = (workbook.month_index(position) - 1) // size + 1
        buckets.setdefault(order, []).append(position)
    for order in sorted(buckets):
        positions = buckets[order]
        parent = order if parent_size is None else (order - 1) // parent_size + 1
        relative = order if parent_size is None else (order - 1) % parent_size + 1
        yield Group(
            order=order,
            identity=workbook.months[positions[0]].absolute,
            first=workbook.month_index(positions[0]),
            last=workbook.month_index(positions[-1]),
            months=len(positions),
            parent=parent,
            relative=relative,
        )


def group_years(workbook: Workbook, size: int, parent_size: int | None = None) -> Iterator[Group]:
    """按 `size` 个**朔望年**（源表的一个纪年块）一组切分，得到层级实体。

    这是 `src/entity/*.ts` 的口径：`1 世 = 30 朔望年`、`1 运 = 12 世 = 360 朔望年`、
    `1 会 = 30 运 = 10800 朔望年`、`1 元 = 12 会 = 129600 朔望年`。

    与 `group_months()` 的区别只在切分单位：朔望年含 12 或 13 个朔望月，长度不固定，
    因此组的月数不恒定；`first` / `last` 仍记全局月序，`start` / `end` 才能落在月首 / 月末。

    `order` = `floor((全局年号 - 1) / size) + 1`，全局年号见 `YEAR_INDEX_OFFSET`，
    故建元所在的组恒为 1。
    """
    blocks: dict[int, list[int]] = {}
    for position, month in enumerate(workbook.months):
        blocks.setdefault(month.year_label, []).append(position)

    buckets: dict[int, list[int]] = {}
    for label in sorted(blocks):
        order = (label + YEAR_INDEX_OFFSET - 1) // size + 1
        buckets.setdefault(order, []).extend(blocks[label])

    for order in sorted(buckets):
        positions = buckets[order]
        parent = order if parent_size is None else (order - 1) // parent_size + 1
        relative = order if parent_size is None else (order - 1) % parent_size + 1
        yield Group(
            order=order,
            identity=workbook.months[positions[0]].absolute,
            first=workbook.month_index(positions[0]),
            last=workbook.month_index(positions[-1]),
            months=len(positions),
            parent=parent,
            relative=relative,
        )


def year_index(workbook: Workbook, year_label: int) -> int:
    """纪年块标签 -> 全局朔望年号（建元所在的朔望年为 1）。"""
    return year_label + YEAR_INDEX_OFFSET


def year_index_of(workbook: Workbook, absolute: int) -> int:
    """瞬间 -> 包含它的朔望年的全局年号。"""
    starts, labels = _year_axis(workbook)
    position = bisect.bisect_right(starts, absolute) - 1
    position = max(0, min(position, len(labels) - 1))
    return labels[position] + YEAR_INDEX_OFFSET


#: workbook 标识 -> (每个纪年块的首个月首, 纪年块标签)，均按时间升序
_YEAR_AXIS: dict[int, tuple[list[int], list[int]]] = {}


def _year_axis(workbook: Workbook) -> tuple[list[int], list[int]]:
    cached = _YEAR_AXIS.get(id(workbook))
    if cached is not None:
        return cached
    first: dict[int, int] = {}
    for position, month in enumerate(workbook.months):
        first.setdefault(month.year_label, position)
    labels = sorted(first)
    cached = ([workbook.months[first[label]].absolute for label in labels], labels)
    _YEAR_AXIS[id(workbook)] = cached
    return cached
