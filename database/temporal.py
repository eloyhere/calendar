"""database.temporal：`temporal` 表。

对应 `src/entity/temporal.ts` 的 `Temporal`。全库的时间坐标系，
其它表的时间列都是它的外键（见 docs/design.md §2）。
"""

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING, Iterator, Sequence

from .core import batch_write, decompose, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

if TYPE_CHECKING:
    from .history import History

#: 本模块负责的表
TABLES: list[Table] = by_module("temporal")
TABLE: Table = TABLES[0]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def collect(workbook: Workbook, history: "History | None" = None) -> list[int]:
    """汇总全库出现过的所有绝对时间，去重并升序排列。

    三部分：

    1. 工作簿自身的每个时间戳，加上由月末、旬、周、月相推导出的时间点；
    2. 历史表（朝代/年号/人物/事件）用到的年份边界与同年错位时间点；
    3. 七部派生历法（天文纪年 / 节气纪年 / 格里高利历 / 木星历法 / 轩辕纪年 /
       干支年 / 回归年）的年界与月界 —— 见 `database/calendars.py`。

    这些都是 `temporal.identity` 的外键，必须一起收进来，否则子表的
    `start` / `end` 会指向不存在的行。
    """
    stamps: set[int] = {month.absolute for month in workbook.months}
    for month in workbook.months:
        stamps.add(month.first_quarter)
        stamps.add(month.full_moon)
        stamps.add(month.last_quarter)
        for term in month.terms:
            stamps.add(term.absolute)
    stamps.update(workbook.month_ends)
    stamps.update(workbook.derived_stamps())

    from .calendars import stamps as calendar_stamps

    stamps.update(calendar_stamps(workbook))

    from .history import history_stamps, load_history

    stamps.update(history_stamps(history if history is not None else load_history()))
    return sorted(stamps)


def rows(stamps: Sequence[int] | Iterator[int]) -> Iterator[tuple[int, ...]]:
    """绝对时间 -> `temporal` 行。

    `temporal` 是唯一把主键写成"业务值"的表：其它实体靠自增号，而时间的
    identity 就是它自身（`absolute` 秒），于是各表的 `start` / `end`
    可以直接指向 `temporal.identity`，不必再做一次换算。
    因为值唯一且单调递增，`AUTOINCREMENT` 的序列仍能继续往上走。
    """
    for absolute in stamps:
        days, seconds, year, month, day, hour, minute, second = decompose(absolute)
        yield (absolute, absolute, days, seconds, year, month, day, hour, minute, second)


def load(connection: sqlite3.Connection, workbook: Workbook, history: "History | None" = None) -> int:
    """写入 `temporal`。显式写入主键，故不走 `batch_write`。"""
    stamps = collect(workbook, history)
    columns = ", ".join(f'"{name}"' for name in TABLE.column_names)
    placeholders = ",".join("?" * len(TABLE.column_names))
    connection.executemany(
        f'INSERT INTO "{TABLE.name}" ({columns}) VALUES ({placeholders})',
        rows(stamps),
    )
    return len(stamps)


def export(workbook: Workbook, history: "History | None" = None) -> Iterator[str]:
    """生成 `database/sql/temporal/data.sql` 的内容（连主键一起写入）。"""
    yield from iter_rows(TABLE, rows(collect(workbook, history)), with_identity=True)
