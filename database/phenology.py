"""database.phenology：`phenology` 表。

对应 `src/entity/phenology.ts` 的 `Phenology`（候，5 天）。

源表每行最多给出一条主节气（H/I 列）、一条主中气（J/K 列）、一条副节中气（L/M 列）。
副节中气是源表对"落在同月但次序靠后的节气"的补充列，故同一候名可能在同年出现两次，
这里按 `kind` 区分，不做去重。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import KIND_AUX, KIND_QI, KIND_TERM, Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("phenology")
TABLE: Table = TABLES[0]

#: kind -> 名称
KIND_NAMES: dict[int, str] = {KIND_TERM: "主节气", KIND_QI: "主中气", KIND_AUX: "副节中气"}

#: 候长，天数。候就是 5 天的物候单位。
LENGTH_OF_DAY = 5


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """按纪年块分组，逐条产出候。

    候是**长度 5 天**的物候单位（`LENGTH_OF_DAY`）。元数据里源表借用了二十四节气名，
    但候与节气不是一回事，名字只是源表给的名字。

    `identity` 是自增主键，这里放该候的起始瞬间作占位（写入时由 `batch_write` 剔除）；
    `absolute` = 候在年内的序号；`end` = 下一条候的起始瞬间 - 1，
    年末最后一条取该纪年块的结束瞬间。
    `year` 取 `synodic_calendar_year.identity`（该年首个朔月的起始瞬间），
    与 `database/synodic.py` 共用同一份换算，跨库比对得上。
    """
    from .synodic import year_identities

    identities = year_identities(workbook)
    grouped: dict[int, list[tuple[int, str, int]]] = {}
    year_ends: dict[int, int] = {}
    for position, month in enumerate(workbook.months):
        year_ends[month.year_label] = workbook.month_ends[position]
        for term in month.terms:
            grouped.setdefault(month.year_label, []).append((term.absolute, term.name, term.kind))
    for year in sorted(grouped):
        terms = sorted(grouped[year])
        year_end = year_ends[year]
        for position, (absolute, name, kind) in enumerate(terms):
            end = terms[position + 1][0] - 1 if position + 1 < len(terms) else year_end
            yield (
                absolute,
                position + 1,
                name,
                kind,
                LENGTH_OF_DAY,
                identities[year],
                absolute,
                end,
            )


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入 `phenology`。返回行数。"""
    return batch_write(connection, TABLE, rows(workbook))


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `src/sql/data/phenology.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
