"""database.event：`event` 表（历史事件）。

对应 `src/entity/event.ts` 的 `Event`。

按用户定义，本实体**只记两类事**：

    era_begin / era_end          年号起止
    dynasty_begin / dynasty_end  朝代更迭

其余史事一律不论。因此 `cause`（原因）与 `result`（结果）没有数据来源，
保持空字符串；`subject` 记该年号的君主姓名，`colony` 记政权名。

历史资料只精确到年，所以 `start` 取该年 1 月 1 日 00:00:00、
`end` 取该年 12 月 31 日 23:59:59。多个事件可以同处一年，主键按起始时间加序号错开。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .history import History, assign_identities, load_history, year_begin, year_end
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("event")
TABLE: Table = TABLES[0]


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(history: History) -> Iterator[tuple[int, ...]]:
    """产出全部事件。

    `dynasty`/`era` 是跨实体外键；分库里 SQLite 不施加跨库外键，
    因此这里写入对应的 identity，由 `database/verify.py` 负责核对。
    """
    dynasty_identities = {
        row["name"]: identity
        for row, (_, identity) in zip(history.dynasty.rows, assign_identities(history.dynasty.rows))
    }
    era_identities = {
        row["name"]: identity
        for row, (_, identity) in zip(history.era.rows, assign_identities(history.era.rows))
    }

    within_year: dict[int, int] = {}
    for order, row in enumerate(history.event.rows, start=1):
        try:
            year = int(row["year"])
        except (KeyError, ValueError):
            continue
        offset = within_year.get(year, 0)
        within_year[year] = offset + 1
        # identity 必须与 database/history.py 的 history_stamps() 完全一致，
        # 否则 event 的时间列会落在 temporal 之外。
        start = year_begin(year) + offset
        end = year_end(year)
        dynasty_name = row.get("dynasty", "")
        era_name = row.get("era", "")
        yield (
            start,
            offset + 1,
            order,
            row.get("name", ""),
            row.get("kind", ""),
            row.get("subject", ""),
            row.get("colony", ""),
            row.get("cause", ""),
            row.get("incident", ""),
            row.get("result", ""),
            year,
            dynasty_identities.get(dynasty_name, 0),
            era_identities.get(era_name, 0),
            start,
            end,
        )


def load(connection: sqlite3.Connection, history: History | None = None) -> int:
    """写入 `event`。返回行数。"""
    return batch_write(connection, TABLE, rows(history or load_history()))


def export(history: History | None = None) -> Iterator[str]:
    """生成 `database/sql/event/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(history or load_history()))
