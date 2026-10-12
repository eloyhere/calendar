"""database.era：`era` 表（年号）。

对应 `src/entity/era.ts` 的 `Era`。

- 神话朝代自伏羲始，伏羲即是第一个年号；其后各年号按历史典籍。
- 当代年号为「」（空字符），本表不设该行。
- 多个年号可以并存（并立政权各自改元），主键一律取 `start`，按起始先后分先后。

行数据来自 `database/data/era.csv`，由 `scripts/build_history_data.py` 生成。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .history import History, assign_identities, load_history, span
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("era")
TABLE: Table = TABLES[0]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(history: History) -> Iterator[tuple[int, ...]]:
    """产出全部年号。

    `relative` 是"该朝代内的第几个年号"：同一朝代按起始年排序计数。
    归并不到朝代的政权（源表里以"某朝统治地区其他势力"之类命名）留 0。
    """
    identities = assign_identities(history.era.rows)
    within: dict[str, int] = {}
    positions: list[int] = []
    for row in history.era.rows:
        dynasty = row.get("dynasty", "")
        within[dynasty] = within.get(dynasty, 0) + 1
        positions.append(within[dynasty])

    for order, (row, (begin, identity), relative) in enumerate(
        zip(history.era.rows, identities, positions), start=1
    ):
        _, end_year, end = span(row)
        yield (
            identity,
            relative,
            order,
            row["name"],
            row.get("kind", ""),
            row.get("regime", ""),
            row.get("ruler", ""),
            row.get("dynasty", ""),
            begin,
            end_year,
            row.get("years", ""),
            identity,
            end,
        )


def load(connection: sqlite3.Connection, history: History | None = None) -> int:
    """写入 `era`。返回行数。"""
    return batch_write(connection, TABLE, rows(history or load_history()))


def export(history: History | None = None) -> Iterator[str]:
    """生成 `database/sql/era/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(history or load_history()))
