"""database.phase：`phase` 表（相）。

对应 `src/entity/phase.ts` 的 `Phase`。数据来自源表 D~G 列：

    D 朔月 -> 第 1 相    E 上弦 -> 第 2 相
    F 望月 -> 第 3 相    G 下弦 -> 第 4 相

每个朔望月四条相，始终齐全。相是**长度 5 天**的单位（`LENGTH_OF_DAY`），与候同长。
`lengthOf*` 一律是「本区间含多少个该单位，向 0 取整」：5 天的相
`lengthOfWeek` = ⌊5/7⌋ = 0、`lengthOfPart` = ⌊5/10⌋ = 0。
"""

from __future__ import annotations

import sqlite3
from typing import Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

#: 本模块负责的表
TABLES: list[Table] = by_module("phase")
TABLE: Table = TABLES[0]

#: 相名，按源表列序
NAMES: tuple[str, ...] = ("朔月", "上弦", "望月", "下弦")

#: 相长，天数。相与候同为 5 天。
LENGTH_OF_DAY = 5

#: 相含多少个 7 天的周：⌊5/7⌋ = 0
LENGTH_OF_WEEK = LENGTH_OF_DAY // 7

#: 相含多少个 10 天的旬：⌊5/10⌋ = 0
LENGTH_OF_PART = LENGTH_OF_DAY // 10

SECONDS_PER_DAY = 86_400
SECONDS_PER_WEEK = 7 * 86_400


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """每个朔望月产出四条相。

    `identity` 是自增主键，这里放该相的起始瞬间作占位（写入时由 `batch_write` 剔除）；
    `absolute` 是全局相序号，自建元当月第一个相起算，从 1 递增；
    `relative` 是该相在月内的序号 1-4；`end` 取下一个相起点 - 1，
    末相顺延一个朔望周，故四相首尾相接。
    """
    for position, month in enumerate(workbook.months):
        month_order = workbook.month_index(position)
        moments = (
            month.new_moon,
            month.first_quarter,
            month.full_moon,
            month.last_quarter,
        )
        for index, absolute in enumerate(moments):
            following = moments[index + 1] if index + 1 < len(moments) else month.last_quarter + 29 * SECONDS_PER_DAY
            yield (
                absolute,
                month_order * 4 + index + 1,
                index + 1,
                NAMES[index],
                LENGTH_OF_DAY,
                LENGTH_OF_WEEK,
                LENGTH_OF_PART,
                False,
                month.absolute,
                absolute,
                following - 1,
            )


def load(connection: sqlite3.Connection, workbook: Workbook) -> int:
    """写入 `phase`。返回行数。"""
    return batch_write(connection, TABLE, rows(workbook))


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `database/sql/phase/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
