"""database.gregory：``gregory_year`` 与 ``gregory_month`` 两张表。

对应 ``src/entity/gregory.ts`` 的 ``格里高利历`` 年/月实体。

换算法则（RULE）：

    proleptic 格里高利历，可直接由 temporal 展开：闰年 366 天、平年 365 天。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .derived import Calendar, calendar
from .schema import Table, by_module
from .source import Workbook

#: 换算法则，实现 `load()` 时的唯一依据
RULE = "proleptic 格里高利历，可直接由 temporal 展开：闰年 366 天、平年 365 天。"

#: 本模块负责的表：年表在前、月表在后（顺序与 database/schema.py 一致）
TABLES: list[Table] = by_module("gregory.calendar")
YEAR_TABLE: Table = TABLES[0]
MONTH_TABLE: Table = TABLES[1]
TABLE: Table = MONTH_TABLE

#: 装配体：一张年表 + 一张月表
CALENDAR: Calendar = calendar(module="gregory.calendar", title="格里高利历", rule=RULE)


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    CALENDAR.create(connection)


def load(connection: sqlite3.Connection, workbook: Workbook) -> dict[str, int]:
    """写入年表与月表。换算法则见 `RULE`。"""
    return CALENDAR.load(connection, workbook)


def export(workbook: Workbook) -> dict[str, Iterator[str]]:
    """生成 `database/sql/gregory.calendar/data.sql` 的各表内容。"""
    return CALENDAR.export(workbook)
