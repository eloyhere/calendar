"""database.jupiter：``jupiter_year`` 与 ``jupiter_month`` 两张表。

对应 ``src/entity/jupiter.ts`` 的 ``木星历法`` 年/月实体。

换算法则（RULE）：

    以岁星（木星）约 11.862 年绕天一周为年长，年首取木星与太阳同黄经的时刻；需星历表。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .derived import Calendar, calendar
from .schema import Table, by_module
from .source import Workbook

#: 换算法则，实现 `load()` 时的唯一依据
RULE = "以岁星（木星）约 11.862 年绕天一周为年长，年首取木星与太阳同黄经的时刻；需星历表。"

#: 本模块负责的表：年表在前、月表在后（顺序与 database/schema.py 一致）
TABLES: list[Table] = by_module("jupiter.calendar")
YEAR_TABLE: Table = TABLES[0]
MONTH_TABLE: Table = TABLES[1]
TABLE: Table = MONTH_TABLE

#: 装配体：一张年表 + 一张月表
CALENDAR: Calendar = calendar(module="jupiter.calendar", title="木星历法", rule=RULE)


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    CALENDAR.create(connection)


def load(connection: sqlite3.Connection, workbook: Workbook) -> dict[str, int]:
    """写入年表与月表。换算法则见 `RULE`。"""
    return CALENDAR.load(connection, workbook)


def export(workbook: Workbook) -> dict[str, Iterator[str]]:
    """生成 `database/sql/jupiter.calendar/data.sql` 的各表内容。"""
    return CALENDAR.export(workbook)
