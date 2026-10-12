"""database.tropical：``tropical_year`` 与 ``tropical_month`` 两张表。

对应 ``src/entity/tropical.ts`` 的 ``回归年`` 年/月实体。

换算法则（RULE）：

    以太阳黄经回到同一值为年界，年长约 365.2422 日；月为回归年 12 等分。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .derived import Calendar, calendar
from .schema import Table, by_module
from .source import Workbook

#: 换算法则，实现 `load()` 时的唯一依据
RULE = "以太阳黄经回到同一值为年界，年长约 365.2422 日；月为回归年 12 等分。"

#: 本模块负责的表：年表在前、月表在后（顺序与 database/schema.py 一致）
TABLES: list[Table] = by_module("tropical.calendar")
YEAR_TABLE: Table = TABLES[0]
MONTH_TABLE: Table = TABLES[1]
TABLE: Table = MONTH_TABLE

#: 装配体：一张年表 + 一张月表
CALENDAR: Calendar = calendar(module="tropical.calendar", title="回归年", rule=RULE)


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    CALENDAR.create(connection)


def load(connection: sqlite3.Connection, workbook: Workbook) -> dict[str, int]:
    """写入年表与月表。换算法则见 `RULE`。"""
    return CALENDAR.load(connection, workbook)


def export(workbook: Workbook) -> dict[str, Iterator[str]]:
    """生成 `database/sql/tropical.calendar/data.sql` 的各表内容。"""
    return CALENDAR.export(workbook)
