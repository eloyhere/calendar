"""database.chronology：`chronology` 表（纪年）。

对应 `src/entity/chronology.ts` 的 `Chronology`：

    interface Chronology extends Proleptic {
        epoch: Epoch;                 // 所属世
        astronomy / climate / gregory / jupiter / natural / tree / tropical / synodic: <Year>;
        lengthOf<X>Month: bigint;     // 各历法在本纪年里的月数
    }

`calendar.xlsx` 不含纪年数据，因此本表按"**一个朔望年一条纪年**"物化：

- 时间区间 = 该朔望年的 `[start, end]`，与 `synodic_calendar_year` 完全一致；
- `epoch`  = 该年首所属的世（1 世 = 30 朔望月，见 `database/epoch.py`）；
- `synodic`= 该朔望年；
- `lengthOfSynodicMonth` = 该年的朔望月数（12 或 13）；
- `relative` = 本纪年在所属世内的序号（`Proleptic`：父级内的相对序列数）；一个世跨 2–3 个
  朔望年，故该值通常是 1–3；
- `absolute` = 全局纪年序号，按时间升序从 1 起。

实体里另外七部历法（`astronomy` / `climate` / …）的年份与月数没有在表结构里落地 ——
`src/service/chronology.service.ts` 已写明"实体声明了 8 种纪年，但表里只有 synodic 一种"，
`database/schema.py` 的 `chronology` 也只声明了 `epoch` / `synodic` /
`lengthOfSynodicMonth` 三个业务列（见 `docs/table.md` §chronology）。需要跨历法对照时，
按时间区间 JOIN 同名分库即可。

`epoch` / `synodic` 都是跨库外键，列里放业务键，由 `database/store.py` 的 `write_table`
换算成父表真实的自增 identity。
"""

from __future__ import annotations

import sqlite3
from typing import TYPE_CHECKING, Iterator

from .core import iter_rows
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

if TYPE_CHECKING:  # 仅用于类型标注：store.py 在函数内 import 本模块，运行时不能互相导入
    from .store import Stores

#: 本模块负责的表
TABLES: list[Table] = by_module("chronology")
TABLE: Table = TABLES[0]

#: 一个世含多少个朔望月（`database/epoch.py` 的 ASSEMBLY.size）
MONTHS_PER_EPOCH = 30


def create(connection: sqlite3.Connection) -> None:
    """建表。"""
    for table in TABLES:
        connection.executescript(emit_sqlite(table))


def _epoch_order(month_index: int) -> int:
    """全局朔望月序号 -> 该月所属的世序号（建元当月所在世为 1，可为负）。"""
    return (month_index - 1) // MONTHS_PER_EPOCH + 1


def _years(workbook: Workbook) -> list[tuple[int, int, int, int]]:
    """按时间升序的朔望年：`[(年首, 年尾, 世序号, 月数)]`。"""
    grouped: dict[int, list[int]] = {}
    for position, month in enumerate(workbook.months):
        grouped.setdefault(month.year_label, []).append(position)
    rows: list[tuple[int, int, int, int]] = []
    for label in sorted(grouped):
        positions = grouped[label]
        first_index = workbook.month_index(positions[0])
        rows.append(
            (
                workbook.months[positions[0]].absolute,
                workbook.month_ends[positions[-1]],
                _epoch_order(first_index),
                len(positions),
            )
        )
    return rows


def rows(workbook: Workbook) -> Iterator[tuple[int, ...]]:
    """产出全部纪年：一个朔望年一条。

    `identity` 放年首瞬间作占位（写入时剔除）；`epoch` / `synodic` 放业务键
    （世的全局序号、朔望年的首瞬间），写入时换算成父表的自增 identity。
    """
    within: dict[int, int] = {}
    for absolute, (start, end, epoch, months) in enumerate(_years(workbook), start=1):
        within[epoch] = within.get(epoch, 0) + 1
        yield (
            start,                       # identity 占位，写入时剔除
            within[epoch],               # relative：本纪年在所属世内的序号
            absolute,                    # absolute：全局纪年序号
            epoch,                       # epoch：所属世（业务键 = 世的全局序号）
            start,                       # synodic：对应朔望年（业务键 = 年首瞬间）
            months,                      # lengthOfSynodicMonth
            start,
            end,
        )


def load(connection: sqlite3.Connection, stores: "Stores", workbook: Workbook) -> dict[str, int]:
    """写入 `chronology`。返回 `表名 -> 行数`。"""
    from .store import write_table  # 延迟导入：store.py 在函数内才 import 本模块

    return {TABLE.name: write_table(connection, stores, TABLE, rows(workbook))}


def export(workbook: Workbook) -> Iterator[str]:
    """生成 `database/sql/chronology/data.sql` 的内容。"""
    yield from iter_rows(TABLE, rows(workbook))
