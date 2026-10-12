"""database.datafiles：把各实体的行数据交给 `database/sqlfiles.py`写成 SQL。

    python database/datafiles.py [--gzip]

行数据只有一份来源，因此 SQL 与 `src/sqlite/*.sqlite` 不会漂移：

- `temporal / phenology / moon_phase / part / week / synodic / primary /
  encounter / perform / epoch / astronomy … tropical` 来自 `calendar.xlsx`；
- `dynasty / era / person / event` 来自 `database/data/*.csv`；
- `chronology` 暂无数据源，只有建表语句。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Callable, Iterator

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import (
    astronomy,
    climate,
    chronology,
    dynasty,
    encounter,
    epoch,
    era,
    event,
    gregory,
    jupiter,
    natural,
    part,
    perform,
    person,
    phase,
    phenology,
    primary,
    synodic,
    temporal,
    tree,
    tropical,
    week,
)
from database.history import History, load_history
from database.schema import Table
from database.source import Workbook, read_workbook

#: 一个实体产出 (表, 行迭代器) 的函数
Exporter = Callable[[Workbook | History], list[tuple[Table, Iterator[tuple[int, ...]]]]]


def _single(module: Any) -> Exporter:
    def exporter(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
        return [(module.TABLE, module.rows(source))]

    return exporter


def _temporal(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
    """`temporal` 的行由 `collect()` 汇总后交给 `rows()`。"""
    workbook = _workbook(source)
    return [(temporal.TABLE, temporal.rows(temporal.collect(workbook, load_history())))]


def _synodic(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
    workbook = _workbook(source)
    return [
        (synodic.YEAR_TABLE, synodic.year_rows(workbook)),
        (synodic.MONTH_TABLE, synodic.month_rows(workbook)),
    ]


def _hierarchy(module: Any, parent: str | None) -> Exporter:
    def exporter(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
        workbook = _workbook(source)
        parents = _parents(workbook, parent) if parent else None
        rows = module.rows(workbook, parents) if parents is not None else module.rows(workbook)
        return [(module.TABLE, rows)]

    return exporter


def _parents(workbook: Workbook, parent: str) -> dict[int, int]:
    """父层"序号 -> identity"，与 database/store.py 的构建顺序一致。"""
    from database import encounter, perform, primary

    module = {"primary": primary, "encounter": encounter, "perform": perform}[parent]
    return {group.order: group.identity for group in module.ASSEMBLY.groups(workbook)}


def _calendar(module: Any) -> Exporter:
    def exporter(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
        return [(module.YEAR_TABLE, iter(())), (module.MONTH_TABLE, iter(()))]

    return exporter


def _climate(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
    """模块 `climate` 三张表：气候表有行数据，节气纪年的年 / 月导出空内容。"""
    workbook = _workbook(source)
    return [
        (climate.CLIMATE_TABLE, climate.rows(workbook)),
        (climate.YEAR_TABLE, climate.year_rows(workbook)),
        (climate.MONTH_TABLE, climate.month_rows(workbook)),
    ]


def _workbook(source: Workbook | History) -> Workbook:
    if not isinstance(source, Workbook):
        raise TypeError("该实体需要 calendar.xlsx 的解析结果")
    return source


#: 实体模块名 -> 导出器
EXPORTERS: dict[str, Exporter] = {
    "temporal": _temporal,
    "phenology": _single(phenology),
    "climate": _climate,
    "phase": _single(phase),
    "part": _single(part),
    "week": _single(week),
    "synodic": _synodic,
    "primary": _single(primary),
    "encounter": _hierarchy(encounter, "primary"),
    "perform": _hierarchy(perform, "encounter"),
    "epoch": _hierarchy(epoch, "perform"),
    "dynasty": _single(dynasty),
    "era": _single(era),
    "person": _single(person),
    "event": _single(event),
    "chronology": _single(chronology),
    "astronomy.calendar": _calendar(astronomy),
    "gregory.calendar": _calendar(gregory),
    "jupiter.calendar": _calendar(jupiter),
    "natural.calendar": _calendar(natural),
    "tree.calendar": _calendar(tree),
    "tropical.calendar": _calendar(tropical),
}

#: 导出顺序：与 database/store.py 的建库顺序保持一致（父表在前）
ORDER: list[str] = [
    "temporal", "synodic", "phenology", "climate", "phase", "part", "week",
    "primary", "encounter", "perform", "epoch",
    "dynasty", "era", "person", "event", "chronology",
    "astronomy.calendar", "gregory.calendar", "jupiter.calendar",
    "natural.calendar", "tree.calendar", "tropical.calendar",
]

#: 需要历史数据而非工作簿的实体
HISTORY_MODULES = {"dynasty", "era", "person", "event"}


def pairs_of(module: str, source: Workbook | History | None = None) -> list[tuple[Table, Iterator[tuple[int, ...]]]] | None:
    """取某实体的 (表, 行迭代器)。`source` 省略时按需解析。"""
    exporter = EXPORTERS.get(module)
    if exporter is None:
        return None
    if source is None:
        source = load_history() if module in HISTORY_MODULES else read_workbook("calendar.xlsx")
    return exporter(source)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="生成 database/sql/<entity>/data.sql")
    parser.add_argument("--root", default=".")
    parser.add_argument("--with-data", action="store_true", help="（默认项，保留以便直接调用 sqlfiles）")
    arguments = parser.parse_args(argv)

    from database.sqlfiles import write_data

    root = Path(arguments.root)
    print("生成数据初始化语句 -> database/sql/<entity>/data.sql")
    written = write_data(root)
    total = sum(path.stat().st_size for path in written)
    print(f"共 {len(written)} 个文件、{total / 1048576:.1f} MiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
