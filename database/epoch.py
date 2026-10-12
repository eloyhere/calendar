"""database.epoch：`epoch` 表（世）。

对应 `src/entity/epoch.ts` 的 `Epoch`。建元当天为第 1 世，1 世 = 30 朔望月。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator, Mapping

from .hierarchy import Assembly, Result, install
from .schema import Table
from .source import Workbook

#: 装配体：1 世 = 30 朔望月，12 世 = 1 运
ASSEMBLY: Assembly = install(module="epoch", size=30, parent_size=12, parent_module="perform")

#: 本模块负责的表
TABLES: list[Table] = ASSEMBLY.tables
TABLE: Table = ASSEMBLY.table


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    ASSEMBLY.create(connection)


def rows(workbook: Workbook, perform_identities: Mapping[int, int] | None = None) -> Iterator[tuple[int, ...]]:
    """产出全部世。`perform_identities` 由 `database/perform.py` 提供。"""
    return ASSEMBLY.rows(workbook, perform_identities)


def load(
    connection: sqlite3.Connection,
    workbook: Workbook,
    perform_identities: Mapping[int, int] | None = None,
) -> Result:
    """写入 `epoch`。"""
    return ASSEMBLY.load(connection, workbook, perform_identities)


def export(workbook: Workbook, perform_identities: Mapping[int, int] | None = None) -> Iterator[str]:
    """生成 `src/sql/data/epoch.sql` 的内容。"""
    return ASSEMBLY.export(workbook, perform_identities)
