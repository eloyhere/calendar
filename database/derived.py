"""database.derived：由朔望月/回归年换算的其它七部历法。

`astronomy`、`climate`、`gregory`、`jupiter`、`natural`、`tree`、`tropical`
这七部历法的实体形状与 `synodic` 完全一致（年 + 月），差别只在"以什么定年月边界"。
因此这里用同一个装配体 `Calendar` 生成行：**换算法则集中在 `database/calendars.py`**，
各模块只声明自己的 `RULE` 常量（人读的说明），`calendar(module, title, rule)` 拿模块名
去取对应的年 / 月区间。

写库时：

- 月表的 `year` 是跨库外键，列里放的是**父年业务的键**（该年的首瞬间，见
  `database/identity.py` 的 `BUSINESS_KEY`），由 `database/store.py` 的 `write_table`
  统一换算成父表真实的自增 identity，因此年表必须先写；
- 年表的 `months` / `phenologies` / `weeks` / `parts` 与月表的同类字段都是**复数属性**，
  按约定落成关联表（`<表>_<属性>`，见 `database/schema.py`），由
  `database/association.py` 按时间区间相交填出，本模块只写年 / 月两张主表；
- `lengthOfX` 一律是"本区间含多少个 X 单位，向 0 取整"（见 `docs/table.md`）。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterator

from . import calendars
from .core import iter_rows
from .schema import Table, by_module, emit_sqlite

if TYPE_CHECKING:  # 仅用于类型标注：store.py 在函数内 import 本模块，运行时不能互相导入
    from .store import Stores

__all__ = ["Calendar", "calendar"]

SECONDS_PER_DAY = calendars.SECONDS_PER_DAY


@dataclass(frozen=True)
class Calendar:
    """一部历法的装配体：一张年表 + 一张月表 + 一套换算法则。

    `year_table_name` / `month_table_name` 缺省取本模块的第 1、2 张表；模块 `climate`
    一个库里还有一张气候主表，故显式指定。
    """

    module: str
    title: str
    rule: str
    year_table_name: str = ""
    month_table_name: str = ""

    @property
    def tables(self) -> list[Table]:
        return by_module(self.module)

    @property
    def year_table(self) -> Table:
        return self._named(self.year_table_name, 0)

    @property
    def month_table(self) -> Table:
        return self._named(self.month_table_name, 1)

    def _named(self, name: str, index: int) -> Table:
        if not name:
            return self.tables[index]
        for table in self.tables:
            if table.name == name:
                return table
        raise KeyError(f"{self.module} 没有表 {name}")

    def create(self, connection: sqlite3.Connection) -> None:
        """建表。"""
        for table in self.tables:
            connection.executescript(emit_sqlite(table))

    # -- 换算 --------------------------------------------------------------- #

    def pairs(self, workbook) -> list[tuple[calendars.Unit, list[calendars.Unit]]]:
        """按年分组：`[(年, 该年的月)]`，月按时间升序、完全落在年内。"""
        years = calendars.years(workbook, self.module)
        months = calendars.months(workbook, self.module)
        grouped: list[tuple[calendars.Unit, list[calendars.Unit]]] = []
        position = 0
        for year in years:
            bucket: list[calendars.Unit] = []
            while position < len(months) and months[position].start <= year.end:
                bucket.append(months[position])
                position += 1
            grouped.append((year, bucket))
        return grouped

    # -- 行 ----------------------------------------------------------------- #

    def year_rows(self, workbook) -> Iterator[tuple[int, ...]]:
        """年表行，列顺序与 `database/schema.py` 一致。"""
        for unit, months in self.pairs(workbook):
            yield (
                unit.start,                                  # identity 占位，写入时剔除
                unit.relative,
                unit.absolute,
                len(months),                                 # lengthOfMonth
                _length_of(unit, 5 * SECONDS_PER_DAY),       # lengthOfPhenology
                _length_of(unit, 7 * SECONDS_PER_DAY),       # lengthOfWeek
                _length_of(unit, 10 * SECONDS_PER_DAY),      # lengthOfPart
                unit.days,                                   # lengthOfDay
                _is_leap_year(unit, months),                 # leap
                unit.start,
                unit.end,
            )

    def month_rows(self, workbook) -> Iterator[tuple[int, ...]]:
        """月表行，列顺序与 `database/schema.py` 一致。"""
        for unit, months in self.pairs(workbook):
            for month in months:
                yield (
                    month.start,                # identity 占位，写入时剔除
                    month.relative,
                    month.absolute,
                    unit.start,                 # year：业务键 = 该年首瞬间，写入时换算
                    month.ordinal,
                    month.leap,
                    month.days,                 # lengthOfDay
                    month.name,
                    month.start,
                    month.end,
                )

    # -- 读写 --------------------------------------------------------------- #

    def load(self, connection: sqlite3.Connection, stores: "Stores", workbook) -> dict[str, int]:
        """写入年表与月表。返回 `表名 -> 行数`。"""
        from .store import write_table  # 延迟导入：store.py 在函数内才 import 本模块

        return {
            self.year_table.name: write_table(
                connection, stores, self.year_table, self.year_rows(workbook)
            ),
            self.month_table.name: write_table(
                connection, stores, self.month_table, self.month_rows(workbook)
            ),
        }

    def export(self, workbook) -> dict[str, Iterator[str]]:
        """生成 `database/sql/<module>/data.sql` 的各表内容。"""
        return {
            self.year_table.name: iter_rows(self.year_table, self.year_rows(workbook)),
            self.month_table.name: iter_rows(self.month_table, self.month_rows(workbook)),
        }


def _length_of(unit: calendars.Unit, unit_seconds: int) -> int:
    """本区间含多少个该单位，向 0 取整。"""
    return unit.seconds // unit_seconds


def _is_leap_year(unit: calendars.Unit, months: list[calendars.Unit]) -> bool:
    """年是否闰。

    换算法则自己给出结论时（格里高利历的闰年、轩辕纪年的 13 月年）以它为准；
    没有闰概念的历法里，一年出现 13 个月也算闰年。
    """
    if unit.leap:
        return True
    return len(months) == 13


def calendar(
    module: str,
    title: str,
    rule: str,
    *,
    year_table_name: str = "",
    month_table_name: str = "",
) -> Calendar:
    """构建一部历法的装配体。"""
    return Calendar(
        module=module,
        title=title,
        rule=rule,
        year_table_name=year_table_name,
        month_table_name=month_table_name,
    )
