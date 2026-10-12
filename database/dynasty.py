"""database.dynasty：`dynasty` 表（朝代）。

对应 `src/entity/dynasty.ts` 的 `Dynasty`。分期（`kind`）：

    上古   盘古以前
    神话   伏羲起，至舜
    历史   夏起，至清
    现代   中华民国（1912-1949）、当代（1949- ，尚未终结）

多个朝代可以并存（三国、十六国、五代十国、辽宋金夏），主键一律取 `start`，
按起始先后分先后；同年起始的再各错 1 秒。行数据来自
`database/data/dynasty.csv`，由 `scripts/build_history_data.py` 生成。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .history import History, assign_identities, load_history, span
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("dynasty")
TABLE: Table = TABLES[0]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(history: History) -> Iterator[tuple[int, ...]]:
    """产出全部朝代。"""
    identities = assign_identities(history.dynasty.rows)

    for order, (row, (begin, identity)) in enumerate(zip(history.dynasty.rows, identities), start=1):
        _, end_year, end = span(row)
        yield (
            identity,
            order,
            order,
            row["name"],
            row.get("kind", ""),
            begin,
            end_year,
            identity,
            end,
        )


def load(connection: sqlite3.Connection, history: History | None = None) -> int:
    """写入 `dynasty`。返回行数。"""
    return batch_write(connection, TABLE, rows(history or load_history()))


def export(history: History | None = None) -> Iterator[str]:
    """生成 `database/sql/dynasty/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(history or load_history()))
