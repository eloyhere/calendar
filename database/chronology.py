"""database.chronology：`chronology` 表（纪年）。

对应 `src/entity/chronology.ts` 的 `Chronology`。

层次上它与 `epoch`（世）对接：`epoch` 由朔望月每 30 个一组推导，已经落库。
历史纪年（某年号某年）需要把年号与朔望月逐一对照，目前还没有这份对照表，
因此本模块只建表，`load()` 不写入任何行。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("chronology")
TABLE: Table = TABLES[0]

#: 数据源是否包含本实体的行
HAS_SOURCE = False


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """本实体暂无数据源，产出空序列。"""
    return iter(())


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入 `chronology`。暂无数据源，恒为 0 行。"""
    return batch_write(connection, TABLE, rows(workbook))


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `database/sql/chronology/data.sql` 的内容（只有表头）。"""
    yield from iter_rows(TABLE, rows(workbook))
