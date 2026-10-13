"""database.tree：``tree_year`` 与 ``tree_month`` 两张表。

对应 ``src/entity/tree.ts`` 的 ``干支年`` 年/月实体。

换算法则（RULE）：

    以立春为年界，年干=(年-4) mod 10、年支=(年-4) mod 12；月按 24 节气的「节」分界。
"""

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING, Iterator

from .derived import Calendar, calendar
from .schema import Table, by_module
from .source import Workbook

if TYPE_CHECKING:  # 仅用于类型标注：store.py 在函数内 import 本模块，运行时不能互相导入
    from .store import Stores

#: 换算法则，实现 `load()` 时的唯一依据
RULE = "以立春为年界，年干=(年-4) mod 10、年支=(年-4) mod 12；月按 24 节气的「节」分界。"

#: 本模块负责的表：年表在前、月表在后（顺序与 database/schema.py 一致）
TABLES: list[Table] = by_module("tree.calendar")
YEAR_TABLE: Table = TABLES[0]
MONTH_TABLE: Table = TABLES[1]
TABLE: Table = MONTH_TABLE

#: 装配体：一张年表 + 一张月表
CALENDAR: Calendar = calendar(module="tree.calendar", title="干支年", rule=RULE)


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    CALENDAR.create(connection)


def load(connection: sqlite3.Connection, stores: "Stores", workbook: Workbook) -> dict[str, int]:
    """写入年表与月表。换算法则见 `RULE`。"""
    return CALENDAR.load(connection, stores, workbook)


def export(workbook: Workbook) -> dict[str, Iterator[str]]:
    """生成 `database/sql/tree.calendar/data.sql` 的各表内容。"""
    return CALENDAR.export(workbook)
