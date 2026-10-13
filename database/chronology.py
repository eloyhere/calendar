"""database.chronology：`chronology` 表（纪年）。

对应 `src/entity/chronology.ts` 的 `Chronology`：

    interface Chronology extends Proleptic {
        epoch: Epoch;                 // 所属世
        astronomy / climate / gregory / jupiter / natural / tree / tropical / synodic: <Year>;
        lengthOf<X>Month: bigint;     // 各历法在本纪年里的月数
    }

`calendar.xlsx` 不含纪年数据，因此本表按"**一个朔望年一条纪年**"物化，
并把它与**八部历法的年表一一对应**：

- 时间区间 = 该朔望年的 `[start, end]`，与 `synodic_calendar_year` 完全一致；
- `epoch`  = 该年所属的世（**1 世 = 30 朔望年**，见 `database/epoch.py`）；
- 八列年（`astronomy` … `synodic`）各取「**纪年首所在**」的那一年：一个朔望年约 354 天，
  可能跨历法年（例如跨格里高利历的元旦），故以纪年的 `start` 定归属 ——
  与 `calendar.xlsx` 的纪年块标签取「块首所在年份」是同一口径；
- 八列 `lengthOf<X>Month` 是那一年的月数，与各年表的 `lengthOfMonth` 同值
  （格里高利 / 干支 / 回归 / 木星通常为 12，节气纪年为 24，朔望年与轩辕纪年为 12 或 13；
  首尾被覆盖区间截断的那些年按实际月数记）；
- `relative` = 本纪年在所属世内的序号（`Proleptic`：父级内的相对序列数）；
  一个世恰好含 30 个朔望年，故该值是 1–30（首尾不足 30 的世除外）；
- `absolute` = 全局纪年序号，按时间升序从 1 起。

八列年与 `epoch` 都是跨库外键，列里放业务键（各年的 `start`、世的全局序号），
由 `database/store.py` 的 `write_table` 换算成父表真实的自增 identity。
"""

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING, Iterator

from . import calendars
from .core import iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import YEAR_INDEX_OFFSET, Workbook

if TYPE_CHECKING:  # 仅用于类型标注：store.py 在函数内 import 本模块，运行时不能互相导入
    from .store import Stores

#: 本模块负责的表
TABLES: list[Table] = by_module("chronology")
TABLE: Table = TABLES[0]

#: 一个世含多少个朔望年（`database/epoch.py` 的 ASSEMBLY.size）
YEARS_PER_EPOCH = 30

#: 纪年要一一对应的八部历法（除 synodic 外）：列名 -> 年表所属模块。
#: 顺序与 `src/entity/chronology.ts` 一致，`synodic` 排在最后、由源表的纪年块提供。
CALENDARS: tuple[tuple[str, str], ...] = (
    ("astronomy", "astronomy.calendar"),
    ("climate", "climate"),
    ("gregory", "gregory.calendar"),
    ("jupiter", "jupiter.calendar"),
    ("natural", "natural.calendar"),
    ("tree", "tree.calendar"),
    ("tropical", "tropical.calendar"),
)

#: 八列年在表里的列名，顺序即写入顺序
YEAR_COLUMNS: tuple[str, ...] = tuple(name for name, _ in CALENDARS) + ("synodic",)


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def _epoch_order(year_label: int) -> int:
    """纪年块标签 -> 该朔望年所属的世序号（建元所在世为 1，可为负）。"""
    return (year_label + YEAR_INDEX_OFFSET - 1) // YEARS_PER_EPOCH + 1


def _synodic_years(workbook: Workbook) -> list[tuple[int, int, int, int]]:
    """按时间升序的朔望年：`[(年首, 年尾, 世序号, 月数)]`。"""
    grouped: dict[int, list[int]] = {}
    for position, month in enumerate(workbook.months):
        grouped.setdefault(month.year_label, []).append(position)
    rows: list[tuple[int, int, int, int]] = []
    for label in sorted(grouped):
        positions = grouped[label]
        rows.append(
            (
                workbook.months[positions[0]].absolute,
                workbook.month_ends[positions[-1]],
                _epoch_order(label),
                len(positions),
            )
        )
    return rows


def _axes(workbook: Workbook) -> dict[str, list[tuple[int, int, int, int]]]:
    """八部历法各一条年轴：`[(年首, 年尾, 年的业务键, 月数)]`，按时间升序。

    年的业务键一律取年的 `start`（见 `database/identity.py` 的 `BUSINESS_KEY`）。
    """
    axes: dict[str, list[tuple[int, int, int, int]]] = {}
    for name, module in CALENDARS:
        axes[name] = [
            (unit.start, unit.end, unit.start, count)
            for unit, count in calendars.years_with_months(workbook, module)
        ]
    axes["synodic"] = [
        (start, end, start, months) for start, end, _, months in _synodic_years(workbook)
    ]
    return axes


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """产出全部纪年：一个朔望年一条，每部历法各挂上包含它的那一年。

    `identity` 放年首瞬间作占位（写入时剔除）；`epoch` 与八列年放业务键，
    写入时换算成父表的自增 identity。八条年轴与朔望年都按时间升序，
    因此一次双指针扫描即可全部对齐。
    """
    axes = _axes(workbook)
    pointers = {name: 0 for name in YEAR_COLUMNS}
    within: dict[int, int] = {}

    for absolute, (start, end, epoch, _) in enumerate(_synodic_years(workbook), start=1):
        within[epoch] = within.get(epoch, 0) + 1
        values: list[int] = [start, within[epoch], absolute, epoch]
        for name in YEAR_COLUMNS:
            axis = axes[name]
            index = pointers[name]
            while index < len(axis) and axis[index][1] < start:
                index += 1
            pointers[name] = index
            if index < len(axis) and axis[index][0] <= end:
                _, _, key, count = axis[index]
            else:  # 理论到不了：年轴平铺整条时间轴，纪年区间必落在某一年内
                key, count = 0, 0
            values.append(key)
            values.append(count)
        values.extend([start, end])
        yield tuple(values)


def load(connection: sqlite3.Connection, stores: "Stores", workbook: Workbook) -> dict[str, int]:
    """写入 `chronology`。返回 `表名 -> 行数`。"""
    from .store import write_table  # 延迟导入：store.py 在函数内才 import 本模块

    return {TABLE.name: write_table(connection, stores, TABLE, rows(workbook))}


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `database/sql/chronology/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
