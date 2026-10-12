"""database.primary：`primary` 表（元）。

对应 `src/entity/primary.ts` 的 `Primary`。1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望月。

本库朔望月总数 290,654，不足 3 元，实际只有 1 行（第 1 元），
但表结构与推导逻辑对任意元数都成立。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator, Mapping

from .hierarchy import Assembly, Result, install
from .schema import Table
from .source import Workbook

#: 装配体：1 元 = 129600 朔望月，顶层无父级
ASSEMBLY: Assembly = install(module="primary", size=129_600, parent_size=None, parent_module=None)

#: 本模块负责的表
TABLES: list[Table] = ASSEMBLY.tables
TABLE: Table = ASSEMBLY.table


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    ASSEMBLY.create(connection)


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """产出全部元。"""
    return ASSEMBLY.rows(workbook)


def load(connection: sqlite3.Connection, workbook: Workbook) -> Result:
    """写入 `primary`。"""
    return ASSEMBLY.load(connection, workbook)


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `src/sql/data/primary.sql` 的内容。"""
    return ASSEMBLY.export(workbook)
