"""database.encounter：`encounter` 表（会）。

对应 `src/entity/encounter.ts` 的 `Encounter`。建元当天为第 1 会，
**1 会 = 30 运 = 360 世 = 10800 朔望年**。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator, Mapping

from .hierarchy import Assembly, Result, install
from .schema import Table
from .source import Workbook

#: 装配体：1 会 = 10800 朔望年，12 会 = 1 元
ASSEMBLY: Assembly = install(
    module="encounter", size=10_800, parent_size=12, parent_module="primary", unit="year"
)

#: 本模块负责的表
TABLES: list[Table] = ASSEMBLY.tables
TABLE: Table = ASSEMBLY.table


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    ASSEMBLY.create(connection)


def rows(workbook: Workbook, primary_identities: Mapping[int, int] | None = None) -> Iterator[tuple[int, ...]]:
    """产出全部会。`primary_identities` 由 `database/primary.py` 提供。"""
    return ASSEMBLY.rows(workbook, primary_identities)


def load(
    connection: sqlite3.Connection,
    workbook: Workbook,
    primary_identities: Mapping[int, int] | None = None,
) -> Result:
    """写入 `encounter`。"""
    return ASSEMBLY.load(connection, workbook, primary_identities)


def export(workbook: Workbook, primary_identities: Mapping[int, int] | None = None) -> Iterator[str]:
    """生成 `src/sql/data/encounter.sql` 的内容。"""
    return ASSEMBLY.export(workbook, primary_identities)
