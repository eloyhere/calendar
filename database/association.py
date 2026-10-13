"""database.association：填充关联表。

按约定，实体里的**复数集合字段**（`Array<X>`，如 `months`、`weeks`、`parts`、
`phenologies`）不落成主表的列，而是各自成为一张关联表 `<父表>_<复数>`，
由 `database/schema.py` 声明，形如：

    Table("synodic_month_weeks", columns=[identity, month -> synodic_month, week -> week])

本模块负责把这些关联表的行填出来：

1. 找出每张关联表的两端（父列与目标列），两端的表都由 `references` 给出；
2. 按**时间区间相交**（`[start, end]` 闭区间有交集）判定父子关系；
3. 用双指针线性扫描，避免 n×m 的两两比较。

相交判定对所有层级都成立，且不需要为每种历法单独写规则：年含月、月含旬/周/候/相/
气候，都是"时间上有重叠"。对于长度 5 天的气候不必含 7 天的周——`lengthOfWeek` 记 0
正说明这一点，关联表自然是空的。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import Callable, Iterator, Sequence

from .schema import TABLES, Table, by_module

__all__ = ["Association", "associations_of", "fill"]


#: 关联表两端的列名规律：`<父表>_<复数>` 里，父列取父表名去掉模块前缀，
#: 目标列取目标表名去掉模块前缀。schema 里已声明 `references`，
#: 但列名本身与表名不一定同名（`synodic_calendar_year_weeks.year` -> `week`），
#: 故按"去掉模块前缀"推导，推导不出时退回表名。
def linked_name(module: str, table_name: str) -> str:
    """`("synodic", "synodic_month")` -> `month`；`("phenology", "phenology")` -> `phenology`。"""
    for candidate in (module, module.replace(".", "_")):
        if table_name.startswith(f"{candidate}_"):
            return table_name[len(candidate) + 1 :]
    return table_name


@dataclass(frozen=True)
class Association:
    """一张关联表的两端。"""

    table: Table
    #: 父端的列名与表名
    parent_column: str
    parent_table: str
    #: 目标端的列名与表名
    target_column: str
    target_table: str
    #: 父表所属模块（用来推导列名，也是库文件名）
    parent_module: str = ""
    #: 目标表所属模块
    target_module: str = ""

    @property
    def name(self) -> str:
        return self.table.name

    @property
    def parent_field(self) -> str:
        """父列的字段名，例如 `month`。"""
        return self.parent_column

    @property
    def target_field(self) -> str:
        """目标列的字段名，例如 `week`。"""
        return self.target_column


def associations_of(module: str) -> list[Association]:
    """某个实体模块的关联表（除主键外恰好两个外键列、且两端都是实体表）。"""
    from .schema import TABLES

    by_name = {table.name: table for table in TABLES}
    result: list[Association] = []
    for table in by_module(module):
        foreign = [column for column in table.columns if column.references]
        if len(foreign) != 2 or len(table.columns) != 3:
            continue
        (first, second) = foreign
        parent_table = first.references.split(".")[0]
        target_table = second.references.split(".")[0]
        parent = by_name.get(parent_table)
        target = by_name.get(target_table)
        if parent is None or target is None:
            continue
        result.append(
            Association(
                table=table,
                parent_column=first.name,
                parent_table=parent_table,
                target_column=second.name,
                target_table=target_table,
                parent_module=parent.module,
                target_module=target.module,
            )
        )
    return result


def spans(connection: sqlite3.Connection, table: str) -> list[tuple[int, int, int]]:
    """表的时间区间：`[(identity, start, end)]`，按 start 升序。

    `end` 为 0 表示尚未终结（如当代），按无穷大处理。
    """
    rows = connection.execute(
        f'SELECT "identity", "start", "end" FROM "{table}" ORDER BY "start"'
    ).fetchall()
    far = 1 << 62
    return [(int(i), int(s), int(e) if e else far) for i, s, e in rows]


def pairs(parents: list[tuple[int, int, int]], targets: list[tuple[int, int, int]]) -> Iterator[tuple[int, int]]:
    """双指针扫出全部相交对：产出 `(父 identity, 目标 identity)`。

    两端都按 start 升序，目标区间跨度远小于父区间时是线性复杂度。
    """
    index = 0
    total = len(targets)
    for parent_id, parent_start, parent_end in parents:
        # 跳过完全落在父区间之前的目标
        while index < total and targets[index][2] < parent_start:
            index += 1
        cursor = index
        while cursor < total and targets[cursor][1] <= parent_end:
            if targets[cursor][2] >= parent_start:
                yield parent_id, targets[cursor][0]
            cursor += 1


def fill(
    module: str,
    connection: sqlite3.Connection,
    stores: object,
    connection_for: Callable[[str], sqlite3.Connection | None],
) -> dict[str, int]:
    """填充某模块的全部关联表，返回 `表名 -> 行数`。

    关联表的两端列里放的是**父表 / 目标表真实的 identity**（`spans()` 直接读的就是
    `identity` 列），因此这里用 `batch_write` 直接落库，**不能**走 `write_table`：
    后者会按 `database/identity.py` 的业务键再换算一次，而 `primary` / `encounter` /
    `perform` / `epoch` 的业务键恰好是"全局序号"，与自增 identity 落在同一段小区间里，
    二次换算会把它们整体错位（例如 identity 1 被当成序号 1 换成 identity 2）。
    写入前先清空本表，保证本函数可以重复执行。

    @param module 实体模块名。
    @param connection 本模块的库连接（关联表自己就写在这里）。
    @param stores 构建上下文（`database.store.Stores`），保留以便与其它实体统一签名。
    @param connection_for 表名 -> 已打开的连接。父表与目标表可能在不同库里，
        因此按表名取连接，缺连接时该关联表记 0 行。
    """
    from .core import batch_write

    counts: dict[str, int] = {}
    for association in associations_of(module):
        table = association.table
        parent_connection = connection_for(association.parent_table)
        target_connection = connection_for(association.target_table)
        if parent_connection is None or target_connection is None:
            counts[association.name] = 0
            continue
        parent_rows = spans(parent_connection, association.parent_table)
        target_rows = spans(target_connection, association.target_table)
        parent_index = table.column_names.index(association.parent_column)
        target_index = table.column_names.index(association.target_column)

        def rows() -> Iterator[tuple[int, ...]]:
            for parent_id, target_id in pairs(parent_rows, target_rows):
                values = [0] * len(table.column_names)
                values[parent_index] = parent_id
                values[target_index] = target_id
                yield tuple(values)

        connection.execute(f'DELETE FROM "{association.name}"')
        counts[association.name] = batch_write(connection, table, rows())
    return counts
