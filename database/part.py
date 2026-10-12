"""database.part：`part` 表。

对应 `src/entity/part.ts` 的 `Part`（旬，10 天）。

每个朔望月切成上旬（第 1-10 天）、中旬（第 11-20 天）、下旬（第 21 天到月末）；
下旬不足 10 天时按月末截断，故三段首尾相接、无缝隙、不重叠。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("part")
TABLE: Table = TABLES[0]

SECONDS_PER_DAY = 86_400


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """每个朔望月产出三条旬。"""
    for position, month in enumerate(workbook.months):
        month_end = workbook.month_ends[position]
        middle = month.absolute + 10 * SECONDS_PER_DAY
        last = month.absolute + 20 * SECONDS_PER_DAY
        yield (month.absolute, 1, month.absolute, 1, month.absolute, middle - 1)
        yield (middle, 2, month.absolute, 11, middle, last - 1)
        yield (last, 3, month.absolute, 21, last, month_end)


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入 `part`。返回行数。"""
    return batch_write(connection, TABLE, rows(workbook))


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `src/sql/data/part.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
