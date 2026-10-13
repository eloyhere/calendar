"""database.hierarchy：元/会/运/世四层的公共实现。

`primary.py`、`encounter.py`、`perform.py`、`epoch.py` 共用这里的 `install()`，
因此四层表结构、行序、外键推导方式完全一致，只有"几个**朔望年**一组"不同：

    1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望年
    1 会 = 30 运 = 360 世 = 10800 朔望年
    1 运 = 12 世 = 360 朔望年
    1 世 = 30 朔望年

口径以 `src/entity/*.ts` 为准（`epoch.ts` 的"1世=30朔望年"、`perform.ts` 的
"1运=12世=360朔望年"、`encounter.ts` 的"1会=30运=360世=10800朔望年"、
`primary.ts` 的"1元=12会=…=129600朔望年"）。

切分单位是**朔望年**而不是朔望月：一个朔望年含 12 或 13 个朔望月，长度不固定，
所以同一层各组含的月数并不恒定；但各组的 `start` / `end` 仍取首月月首与末月月末，
落在 `temporal` 已有时间点上。`group_months()` 保留了按朔望月切分的旧口径备用。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field
from typing import Callable, Iterator, Mapping

from .core import batch_write, count_rows, iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Group, Workbook, group_months, group_years

__all__ = ["Assembly", "Identities", "Result", "install"]

#: 序号 -> identity
Identities = dict[int, int]


@dataclass
class Result:
    """一次 load/export 的结果。"""

    rows: int = 0
    count: int = 0
    identities: Identities = field(default_factory=Identities)
    tables: dict[str, int] = field(default_factory=dict)


class Assembly:
    """一个层级模块的装配体。"""

    def __init__(
        self,
        *,
        module: str,
        size: int,
        parent_size: int | None,
        parent_module: str | None,
        unit: str = "year",
    ) -> None:
        self.module = module
        self.size = size
        self.parent_size = parent_size
        self.parent_module = parent_module
        #: 切分单位：`year`（朔望年，实体口径）或 `month`（朔望月）
        self.unit = unit
        self.tables: list[Table] = by_module(module)
        self.table: Table = self.tables[0]

    # -- 结构 -------------------------------------------------------------- #

    def create(self, connection: sqlite3.Connection) -> None:
        """建表。"""
        for table in self.tables:
            connection.executescript(emit_sqlite(table))

    def groups(self, workbook: Workbook) -> list[Group]:
        """本层的全部分组，按时间升序。"""
        split = group_years if self.unit == "year" else group_months
        return list(split(workbook, self.size, self.parent_size))

    def identity_of(self, workbook: Workbook, order: int) -> int:
        """分组序号 -> identity。"""
        for group in self.groups(workbook):
            if group.order == order:
                return group.identity
        raise KeyError(f"{self.module} 没有序号 {order}")

    def rows(self, workbook: Workbook, parent_identities: Mapping[int, int] | None = None) -> Iterator[tuple[int, ...]]:
        """产出本层全部行。

        按 `self.table` 的列定义逐个取值，因此顶层（`primary` 没有父列）
        与其余三层（有父列）共用同一段代码。

        `parent` 列取父分组的 `identity`；`parent_identities` 由父级模块提供，
        构建顺序由 `database/build.py` 保证。
        """
        parents = parent_identities or {}
        columns = self.table.column_names
        parent_column = self.parent_column
        for group in self.groups(workbook):
            end = workbook.month_ends[group.last - workbook.first_month_index]
            parent = parents.get(group.parent, group.parent) if parent_column else 0
            values: dict[str, object] = {
                "identity": group.identity,
                "relative": group.relative,
                "absolute": group.order,
                "start": group.identity,
                "end": end,
            }
            if parent_column is not None:
                values[parent_column] = parent
            yield tuple(values[name] for name in columns)

    @property
    def parent_column(self) -> str | None:
        """本层指向父级的列名，顶层返回 None。"""
        for name in ("primary", "encounter", "perform"):
            if name in self.table.column_names:
                return name
        return None

    # -- 读写 -------------------------------------------------------------- #

    def load(
        self,
        connection: sqlite3.Connection,
        workbook: Workbook,
        parent_identities: Mapping[int, int] | None = None,
    ) -> Result:
        """写入本层表。"""
        groups = self.groups(workbook)
        written = batch_write(connection, self.table, self.rows(workbook, parent_identities))
        return Result(
            rows=written,
            count=count_rows(connection, self.table.name),
            identities={group.order: group.identity for group in groups},
            tables={self.table.name: written},
        )

    def export(self, workbook: Workbook, parent_identities: Mapping[int, int] | None = None) -> Iterator[str]:
        """生成 `src/sql/data/<module>.sql` 的内容。"""
        yield from iter_rows(self.table, self.rows(workbook, parent_identities))


def install(
    *,
    module: str,
    size: int,
    parent_size: int | None,
    parent_module: str | None,
    unit: str = "year",
) -> Assembly:
    """构建一个层级模块的装配体。`size` 的单位由 `unit` 决定（缺省朔望年）。"""
    return Assembly(
        module=module,
        size=size,
        parent_size=parent_size,
        parent_module=parent_module,
        unit=unit,
    )
