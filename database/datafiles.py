"""database.datafiles：把各实体的行数据交给 `database/sqlfiles.py`写成 SQL。

    python database/datafiles.py [--gzip]

行数据只有一份来源，因此 SQL 与 `src/sqlite/*.sqlite` 不会漂移：

- `temporal / phenology / climate / phase / part / week / synodic / primary /
  encounter / perform / epoch` 来自 `calendar.xlsx` 的直接解析；
- `chronology` 由朔望年换算（一个朔望年一条纪年）；
- 七部派生历法（`astronomy / gregory / jupiter / natural / tree / tropical` 与
  `climate` 的节气纪年）来自 `database/calendars.py` 的换算法则；
- `dynasty / era / person / event` 来自 `database/data/*.csv`。
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
    """层级实体（元/会/运/世）：父列写**父层的全局序号**。

    与 `database/store.py` 的 `load_module()` 走同一条路 —— 不在这里预算父级 identity，
    统一交给 `database/sqlfiles.py` 的 `identity_resolver()` 按 `BUSINESS_KEY` 换算；
    否则 `data.sql` 与 `src/sqlite/*.sqlite` 会漂移（层级表的 identity 是插入位置，
    而 `Group.identity` 是首个月首的绝对时间，两者不是一回事）。
    """
    def exporter(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
        workbook = _workbook(source)
        return [(module.TABLE, module.rows(workbook))]

    return exporter


def _calendar(module: Any) -> Exporter:
    """七部派生历法：年表 / 月表的**行**（不是渲染好的 SQL）。

    注意与 `module.export()` 的区别：`export()` 按项目约定直接产出 SQL 文本
    （`core.iter_rows()` 的结果），而 `datafiles` 交给 `sqlfiles.write_data()`
    的是行迭代器，由它自己渲染，故这里用 `year_rows()` / `month_rows()`。
    """
    def exporter(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
        workbook = _workbook(source)
        return [
            (module.YEAR_TABLE, module.CALENDAR.year_rows(workbook)),
            (module.MONTH_TABLE, module.CALENDAR.month_rows(workbook)),
        ]

    return exporter


def _chronology(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
    workbook = _workbook(source)
    return [(chronology.TABLE, chronology.rows(workbook))]


def _climate(source: Workbook | History) -> list[tuple[Table, Iterator[tuple[int, ...]]]]:
    """模块 `climate` 三张表：气候表 + 节气纪年的年 / 月（行迭代器）。"""
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
    "chronology": _chronology,
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
    "dynasty", "era", "person", "event",
    "astronomy.calendar", "gregory.calendar", "jupiter.calendar",
    "natural.calendar", "tree.calendar", "tropical.calendar",
    "chronology",
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
