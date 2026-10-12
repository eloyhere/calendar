"""database.derived：由朔望月/回归年换算的其它七部历法。

`astronomy`、`climate`、`gregory`、`jupiter`、`natural`、`tree`、`tropical`
这七部历法的实体形状与 `synodic` 完全一致（年 + 月），差别只在"以什么定年月边界"。
因此这里用同一个装配体 `Calendar` 生成建表语句，各模块只声明自己的换算法则。

行数据需要额外的天文换算（回归年长度、岁星周期、干支起算等），
`calendar.xlsx` 中并不直接包含，故本轮只建表；换算法则记录在
各模块的 `RULE` 常量中，作为后续生成数据的依据。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Iterator

from .schema import Table, by_module, emit_sqlite
from .source import Workbook

__all__ = ["Calendar", "calendar"]


@dataclass(frozen=True)
class Calendar:
    """一部历法的装配体：一张年表 + 一张月表。"""

    module: str
    title: str
    rule: str

    @property
    def tables(self) -> list[Table]:
        return by_module(self.module)

    @property
    def year_table(self) -> Table:
        return self.tables[0]

    @property
    def month_table(self) -> Table:
        return self.tables[1]

    def create(self, connection: sqlite3.Connection) -> None:
        """建表。"""
        for table in self.tables:
            connection.executescript(emit_sqlite(table))

    def load(self, connection: sqlite3.Connection, workbook: Workbook) -> dict[str, int]:
        """本次不写入行数据，只保证表结构可用。

        换算法则见 `rule`；实现后在此把年份与月份写入两张表即可，
        列顺序必须与 `database/schema.py` 的声明一致。
        """
        return {self.year_table.name: 0, self.month_table.name: 0}

    def export(self, workbook: Workbook) -> dict[str, Iterator[str]]:
        """没有行数据，导出空内容（仍生成文件头，便于以后替换）。"""
        return {self.year_table.name: iter(()), self.month_table.name: iter(())}


def calendar(module: str, title: str, rule: str) -> Calendar:
    """构建一部历法的装配体。"""
    return Calendar(module=module, title=title, rule=rule)
