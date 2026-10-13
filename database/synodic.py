"""database.synodic：`synodic_calendar_year` 与 `synodic_month` 两张表。

对应 `src/entity/synodic.ts` 的 `SynodicYear`（朔望年）与 `SynodicMonth`（朔望月）。

这是 `calendar.xlsx` 中唯一直接落库的历法实体：源表一"纪年块"就是一年，
一行就是一个月。`relative` 即源表列 N 的积月（块内序号），
`lengthOfDay` 即源表列 C 由公式 `IF(C3="大",30,29)` 决定的大小月天数。

年表的五个 `lengthOf*` 与 `leap` 按 `SynodicYear` 补齐：`lengthOfMonth` 记该年实际有多少个
朔望月（12 或 13，朔望月长短不一，只能数），其余四个是**固定长度单位**，按
`docs/table.md` 的口径取「本区间含多少个该单位，向 0 取整」= `区间秒数 // 单位秒数`
（候 5 天 / 周 7 天 / 旬 10 天 / 天 1 天），与七部派生历法的年表逐字同口径。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

SECONDS_PER_DAY = 86_400
#: 固定长度单位的秒数：候 5 天、周 7 天、旬 10 天
SECONDS_PER_PHENOLOGY = 5 * SECONDS_PER_DAY
SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY
SECONDS_PER_PART = 10 * SECONDS_PER_DAY

#: 本模块负责的表：年在前、月在后
TABLES: list[Table] = by_module("synodic")
YEAR_TABLE: Table = TABLES[0]
MONTH_TABLE: Table = TABLES[1]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def _grouped(workbook: Workbook) -> dict[int, list[int]]:
    """纪年块 -> 该块内各月的行位置，按时间升序。"""
    grouped: dict[int, list[int]] = {}
    for position, month in enumerate(workbook.months):
        grouped.setdefault(month.year_label, []).append(position)
    return grouped


def year_rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """`synodic_calendar_year` 的行。

    `identity` 是自增主键，这里放该纪年块首个朔月的起始瞬间作占位（写入时由
    `batch_write` 剔除）；`gregorian_year` 是纪年块标签（源表列 B），
    `start`/`end` 是该块的首尾瞬间。

    五个 `lengthOf*` 与 `leap` 按 `src/entity/synodic.ts` 的 `SynodicYear` 补齐：

    - `lengthOfMonth`：该年实际含多少个朔望月（12 或 13）—— 朔望月 29/30 天不等长，
      只能数，不能整除；
    - `lengthOfPhenology` / `lengthOfWeek` / `lengthOfPart` / `lengthOfDay`：
      候 / 周 / 旬 / 天都是**固定长度**单位，按 `docs/table.md` 的口径取
      「本区间含多少个该单位，向 0 取整」，即 `区间秒数 // 单位秒数`，
      与七部派生历法的年表同口径（不是关联表的行数 —— 关联表按区间相交算，
      `phenology` 表存的是节气时刻，一年约 24 条，与 5 天的候不是一回事）；
    - `leap`：含 13 个朔望月即为闰年。
    """
    grouped = _grouped(workbook)
    for order, label in enumerate(sorted(grouped), start=1):
        positions = grouped[label]
        start = workbook.months[positions[0]].absolute
        end = workbook.month_ends[positions[-1]]
        seconds = end - start + 1
        months = len(positions)
        yield (
            start,
            order,
            label,
            months,
            seconds // SECONDS_PER_PHENOLOGY,
            seconds // SECONDS_PER_WEEK,
            seconds // SECONDS_PER_PART,
            seconds // SECONDS_PER_DAY,
            months == 13,
            start,
            end,
        )


def month_rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """`synodic_month` 的行。"""
    identities = _year_identities(workbook)
    for position, month in enumerate(workbook.months):
        yield (
            month.absolute,
            month.month_count,
            workbook.month_index(position),
            identities[month.year_label],
            month.ordinal,
            month.leap,
            month.size,
            month.length,
            month.name,
            ("闰" if month.leap else "") + _ORDINAL_NAMES[month.ordinal],
            month.month_end_day,
            month.absolute,
            workbook.month_ends[position],
        )


_ORDINAL_NAMES: dict[int, str] = {
    1: "正月",
    2: "二月",
    3: "三月",
    4: "四月",
    5: "五月",
    6: "六月",
    7: "七月",
    8: "八月",
    9: "九月",
    10: "十月",
    11: "冬月",
    12: "腊月",
}

def _year_identities(workbook: Workbook) -> dict[int, int]:
    """纪年块标签 -> 该年纪年块（年表）的 identity，即该年首个朔月的起始瞬间。"""
    cached = _YEAR_IDENTITIES.get(id(workbook))
    if cached is not None:
        return cached
    identities: dict[int, int] = {}
    for month in workbook.months:
        identities.setdefault(month.year_label, month.absolute)
    _YEAR_IDENTITIES[id(workbook)] = identities
    return identities


def year_identities(workbook: Workbook) -> dict[int, int]:
    """供其它实体把"纪年块标签"换算成 `synodic_calendar_year.identity`。

    各实体之间不走数据库 JOIN，而是共用同一份换算，避免同一个纪年块在不同库里
    得到不同的 identity。
    """
    return _year_identities(workbook)


#: workbook 标识 -> 纪年块标签到年 identity 的映射
_YEAR_IDENTITIES: dict[int, dict[int, int]] = {}


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入两张表。返回月表行数。"""
    batch_write(connection, YEAR_TABLE, year_rows(workbook))
    return batch_write(connection, MONTH_TABLE, month_rows(workbook))


def export(workbook: Workbook) -> Iterator[tuple[Table, Iterator[tuple[int, ...]]]]:
    """生成 `src/sql/data/synodic.sql` 所需的两组行。"""
    return (
        (YEAR_TABLE, year_rows(workbook)),
        (MONTH_TABLE, month_rows(workbook)),
    )
