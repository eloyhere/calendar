"""database.person：`person` 表（人物）。

对应 `src/entity/event.ts` 的 `Person`，是 `Event.subject` 的目标类型。

历史资料只提供姓名，所以只有 `name` 有值；`gender`、`biography` 无来源，
保持空字符串，等接入人物传记资料后按 `database/schema.py` 的列顺序补齐即可。

行数据来自年号表中出现过的君主姓名，去重后按首次出现的年份排序。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .history import History, load_history, person_order, year_begin
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("person")
TABLE: Table = TABLES[0]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def _collect(history: History) -> list[tuple[str, int]]:
    """(姓名, 首次出现的年份)，按年份与姓名排序。

    与 `database/history.py` 的 `person_order()` 共用同一套规则，
    否则 person 表的 identity 会落在 temporal 之外。
    """
    return person_order(history)


def rows(history: History) -> Iterator[tuple[int, ...]]:
    """产出全部人物。"""
    for order, (name, year) in enumerate(_collect(history), start=1):
        identity = year_begin(year) + order
        yield (identity, order, order, name, "", "", identity, identity)


def load(connection: sqlite3.Connection, history: History | None = None) -> int:
    """写入 `person`。返回行数。"""
    return batch_write(connection, TABLE, rows(history or load_history()))


def export(history: History | None = None) -> Iterator[str]:
    """生成 `database/sql/person/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(history or load_history()))
