"""database.climate：模块 `climate` 的三张表。

- `climate`       气候：长度 **5 天**的单位，源工作簿直接切分；
- `climate_year`  节气纪年的年：一年 24 个月；
- `climate_month` 节气纪年的月：每月以主节气或主中气起算。

年 / 月两张表由「气候 + phenology 的候」换算而来，换算法则见 `RULE`；本轮只建表，
行数据待生成（`load()` 记 0 行，`export()` 导出空内容）。

气候是**长度 5 天**的单位，与候、相同长：每个朔望月自月首起每 5 天一个气候，
末段不足 5 天时按月末截断，因此同一个朔望月内的气候首尾相接、无缝无叠。

`lengthOf*` 一律是「本区间含多少个该单位，向 0 取整」：5 天的气候
`lengthOfDay` = 5、`lengthOfWeek` = ⌊5/7⌋ = 0、`lengthOfPart` = ⌊5/10⌋ = 0。
"""

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING, Iterator

from .core import batch_write, iter_rows
from .schema import Table, by_module, emit_sqlite, table_of
from .source import Workbook

if TYPE_CHECKING:  # 仅用于类型标注：store.py 在函数内 import 本模块，运行时不能互相导入
    from .store import Stores

#: 换算法则，实现 `load()` 时的唯一依据
RULE = "一年 24 个月，每月以主节气或主中气起算；可由 phenology 的候按时间顺序两两归并得到。"

#: 本模块负责的全部表（实体表 + 关联表），建表时一张不落
TABLES: list[Table] = by_module("climate")
CLIMATE_TABLE: Table = table_of("climate")
YEAR_TABLE: Table = table_of("climate_year")
MONTH_TABLE: Table = table_of("climate_month")
#: 本模块的主表：气候表（唯一有行数据的表）
TABLE: Table = CLIMATE_TABLE

#: 气候长，天数
LENGTH_OF_DAY = 5
#: 气候含多少个 7 天的周：⌊5/7⌋ = 0
LENGTH_OF_WEEK = LENGTH_OF_DAY // 7
#: 气候含多少个 10 天的旬：⌊5/10⌋ = 0
LENGTH_OF_PART = LENGTH_OF_DAY // 10
#: 气候名的前缀
NAME_PREFIX = "气候"

SECONDS_PER_DAY = 86_400
SECONDS_PER_CLIMATE = LENGTH_OF_DAY * SECONDS_PER_DAY


def create(connection: sqlite3.Connection) -> None:
    """建表：气候 + 节气纪年的年 / 月 + 各关联表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """每个朔望月产出若干气候。

    `identity` 是自增主键，这里放该气候的起始瞬间作占位（写入时由 `batch_write` 剔除）；
    `absolute` 是全局气候序号，按时间升序从 1 递增；`relative` 是月内序号。
    """
    order = 0
    for position, month in enumerate(workbook.months):
        month_end = workbook.month_ends[position]
        start = month.absolute
        relative = 1
        while start <= month_end:
            following = start + SECONDS_PER_CLIMATE
            end = following - 1 if following <= month_end else month_end
            order += 1
            yield (
                start,
                order,
                relative,
                f"{NAME_PREFIX}{relative}",
                LENGTH_OF_DAY,
                LENGTH_OF_WEEK,
                LENGTH_OF_PART,
                False,
                month.absolute,
                start,
                end,
            )
            start = following
            relative += 1


def year_rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """节气纪年的年表：换算法则见 `RULE`，本轮不产出数据。"""
    return iter(())


def month_rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """节气纪年的月表：换算法则见 `RULE`，本轮不产出数据。"""
    return iter(())


def load(connection: sqlite3.Connection, stores: Stores, workbook: Workbook) -> dict[str, int]:
    """写入气候表；年 / 月两张表待换算，记 0 行。

    气候表的 `month` 是跨库外键（指向 `synodic_month`），列里存的是业务键，
    必须走 `database.store.write_table` 做「业务键 -> identity」换算，
    不能直接 `batch_write`——否则 `database/verify.py` 的跨库核对会全数报错。
    """
    from .store import write_table  # 延迟导入：store.py 在函数内才 import 本模块

    return {
        CLIMATE_TABLE.name: write_table(connection, stores, CLIMATE_TABLE, rows(workbook)),
        YEAR_TABLE.name: 0,
        MONTH_TABLE.name: 0,
    }


def export(workbook: Workbook) -> dict[str, Iterator[str]]:
    """生成 `database/sql/climate/data.sql` 的各表内容。"""
    return {
        CLIMATE_TABLE.name: iter_rows(CLIMATE_TABLE, rows(workbook)),
        YEAR_TABLE.name: iter(()),
        MONTH_TABLE.name: iter(()),
    }
