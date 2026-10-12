"""database.week：`week` 表。

对应 `src/entity/week.ts` 的 `Week`（星期，7 天）。

以朔望月月首所在周的第 1 天为起点，每 7 天切一段；最后一段不足 7 天时
按月末截断。跨月的残段不会重复登记，因此相邻月的周区间首尾相接。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("week")
TABLE: Table = TABLES[0]

SECONDS_PER_WEEK = 7 * 86_400
#: 本周天数，7：`lengthOfDay` 是「本区间含多少天」，不是秒
LENGTH_OF_DAY = 7


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """每个朔望月产出若干周。"""
    for position, month in enumerate(workbook.months):
        month_end = workbook.month_ends[position]
        start = month.absolute
        relative = 1
        while start <= month_end:
            following = start + SECONDS_PER_WEEK
            end = following - 1 if following <= month_end else month_end
            yield (start, relative, month.absolute, LENGTH_OF_DAY, start, end)
            start = following
            relative += 1


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入 `week`。返回行数。"""
    return batch_write(connection, TABLE, rows(workbook))


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `src/sql/data/week.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
