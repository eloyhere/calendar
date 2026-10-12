"""database.history：朝代 / 年号 / 人物 / 事件四张表的数据读取与推导。

数据来自 `database/data/*.csv`，由 `scripts/build_history_data.py` 从
zh.wikipedia「中国朝代」与「中国年号列表」清洗、繁简转换后写出。

两条约定：

1. **时间换算**：历史资料只精确到年，所以"某年"取该年 1 月 1 日 00:00:00
   的绝对时间（`absolute`），结束年取该年 12 月 31 日 23:59:59。绝对时间与
   `temporal` 同一坐标系（建元 -2696-03-11 01:45:49 为第 1 日）。
2. **允许重叠**：多个朝代、多个年号可以同时并存（三国、十六国、五代十国、
   辽宋金夏都是并立政权）。主键一律取 `start`，按起始先后分先后；
   同年起始的条目再按源表顺序各加 1 秒错开，保证 `identity` 唯一。
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from .core import absolute_of

__all__ = ["History", "Table", "load_history", "span", "year_begin", "year_end"]

DATA = Path(__file__).resolve().parent / "data"


@dataclass(frozen=True)
class Table:
    """一张历史表的行与按名索引。"""

    name: str
    rows: list[dict[str, str]]
    by_name: dict[str, dict[str, str]]


@dataclass
class History:
    """四张历史表的集合，附 identity 索引。"""

    dynasty: Table
    era: Table
    event: Table
    #: 朝代名 -> identity
    dynasty_identity: dict[str, int] = field(default_factory=dict)
    #: 年号名 -> identity（同年号名可能先后出现在不同政权，取最早一个）
    era_identity: dict[str, int] = field(default_factory=dict)


def _read(path: Path) -> Table:
    if not path.exists():
        raise FileNotFoundError(f"缺少历史数据文件：{path}；请先运行 scripts/build_history_data.py")
    with path.open(encoding="utf-8", newline="") as handle:
        rows = [
            {key: (value or "").strip() for key, value in row.items()}
            for row in csv.DictReader(handle)
        ]
    by_name: dict[str, dict[str, str]] = {}
    for row in rows:
        name = row.get("name", "")
        if name and name not in by_name:
            by_name[name] = row
    return Table(name=path.stem, rows=rows, by_name=by_name)


def year_begin(year: int) -> int:
    """某年第一天 00:00:00 的绝对时间。"""
    return absolute_of((year, 1, 1, 0, 0, 0))


def year_end(year: int) -> int:
    """某年最后一天 23:59:59 的绝对时间。"""
    return absolute_of((year, 12, 31, 23, 59, 59))


def _int(value: str | None) -> int | None:
    if value is None or value.strip() == "":
        return None
    return int(value)


def span(row: dict[str, str]) -> tuple[int, int, int]:
    """一行历史数据 -> (起始年, 结束年, 结束绝对时间)。

    尚未终结的朝代（当代）：结束年记 0，结束时间记 0。
    """
    begin = _int(row.get("begin"))
    end = _int(row.get("end"))
    if begin is None:
        raise ValueError(f"缺少起始年：{row}")
    if end is None:
        return begin, 0, 0
    return begin, end, year_end(end)


def assign_identities(rows: list[dict[str, str]], *, reverse: bool = False) -> list[tuple[int, int]]:
    """给一组"按 start 排序"的历史行分配唯一 identity。

    返回与 `rows` 等长的 `(起始年, identity)` 列表。同一年起始的条目，
    按传入顺序各错开 1 秒，保证 `identity` 唯一且仍然"按 start 先后"排列。
    """
    result: list[tuple[int, int]] = []
    used: dict[int, int] = {}
    for row in rows:
        begin = _int(row.get("begin"))
        if begin is None:
            continue
        base = year_begin(begin)
        offset = used.get(base, 0)
        used[base] = offset + 1
        result.append((begin, base + offset))
    return result


def load_history(directory: Path = DATA) -> History:
    """读取四张历史表并建立 identity 索引。"""
    dynasty = _read(directory / "dynasty.csv")
    era = _read(directory / "era.csv")
    event = _read(directory / "event.csv")
    history = History(dynasty=dynasty, era=era, event=event)

    for row, (_, identity) in zip(dynasty.rows, assign_identities(dynasty.rows)):
        history.dynasty_identity.setdefault(row["name"], identity)
    for row, (_, identity) in zip(era.rows, assign_identities(era.rows)):
        history.era_identity.setdefault(row["name"], identity)
    return history


def history_stamps(history: History) -> set[int]:
    """四张历史表用到的全部时间点。

    `temporal` 必须收录这些时间点，否则历史表的时间列会指向不存在的行。
    除各行的 `start`/`end` 外，还要收 person 与 event 按年内序号错开后的 identity。
    """
    stamps: set[int] = set()
    for rows in (history.dynasty.rows, history.era.rows):
        for _, identity in assign_identities(rows):
            stamps.add(identity)
        for row in rows:
            _, _, end = span(row)
            if end:
                stamps.add(end)

    # person：姓名按首次出现年份排序，identity = 该年年初 + 序号
    for order, (_, year) in enumerate(person_order(history), start=1):
        stamps.add(year_begin(year) + order)

    # event：按年份分组，identity = 该年年初 + 年内序号
    within: dict[int, int] = {}
    for row in history.event.rows:
        year = _int(row.get("year"))
        if year is None:
            continue
        offset = within.get(year, 0)
        within[year] = offset + 1
        stamps.add(year_begin(year) + offset)
        stamps.add(year_end(year))
    return stamps


def person_order(history: History) -> list[tuple[str, int]]:
    """人物姓名 -> 首次出现的年份，按年份与姓名排序。

    与 `database/person.py` 的 `_collect()` 用同一套规则，
    否则 person 表的 identity 会落在 temporal 之外。
    """
    first: dict[str, int] = {}
    for row in history.era.rows:
        name = row.get("ruler", "")
        if not name:
            continue
        year = _int(row.get("begin"))
        if year is None:
            continue
        if name not in first or year < first[name]:
            first[name] = year
    return sorted(first.items(), key=lambda item: (item[1], item[0]))
