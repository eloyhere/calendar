"""database.perform：`perform` 表（运）。

对应 `src/entity/perform.ts` 的 `Perform`。建元当天为第 1 运，
**1 运 = 12 世 = 360 朔望年**。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator, Mapping

from .hierarchy import Assembly, Result, install
from .schema import Table
from .source import Workbook

#: 装配体：1 运 = 360 朔望年，30 运 = 1 会
ASSEMBLY: Assembly = install(
    module="perform", size=360, parent_size=30, parent_module="encounter", unit="year"
)

#: 本模块负责的表
TABLES: list[Table] = ASSEMBLY.tables
TABLE: Table = ASSEMBLY.table


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    ASSEMBLY.create(connection)


def rows(workbook: Workbook, encounter_identities: Mapping[int, int] | None = None) -> Iterator[tuple[int, ...]]:
    """产出全部运。`encounter_identities` 由 `database/encounter.py` 提供。"""
    return ASSEMBLY.rows(workbook, encounter_identities)


def load(
    connection: sqlite3.Connection,
    workbook: Workbook,
    encounter_identities: Mapping[int, int] | None = None,
) -> Result:
    """写入 `perform`。"""
    return ASSEMBLY.load(connection, workbook, encounter_identities)


def export(workbook: Workbook, encounter_identities: Mapping[int, int] | None = None) -> Iterator[str]:
    """生成 `src/sql/data/perform.sql` 的内容。"""
    return ASSEMBLY.export(workbook, encounter_identities)
