"""database.core：时间坐标换算、工作簿读取与 SQLite 连接。

时间坐标系（见 docs/design.md §2）：

- 建元 -2696-03-11 01:45:49，当天为第 1 日。
- days   = jdn(时刻) - jdn(建元) + 1
- seconds= 当天 00:00:00 起算的秒数
- absolute = days * 86400 + seconds   全表统一时间主键
"""

from __future__ import annotations

import datetime as _datetime
import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Iterator, Sequence

__all__ = [
    "Epoch",
    "TIMESTAMP",
    "connect",
    "day_number",
    "load_source",
    "parse_timestamp",
    "timestamp",
]

# 天文纪年 proleptic 格里高利历：允许 0 年与负数年，故不能用 datetime。
TIMESTAMP = re.compile(r"^(-?\d{1,6})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$")

SECONDS_PER_DAY = 86_400


@dataclass(frozen=True)
class Epoch:
    """建元。当天为第 1 日，absolute 为 0 的瞬间是建元当天 00:00:00。"""

    year: int = -2696
    month: int = 3
    day: int = 11
    hour: int = 1
    minute: int = 45
    second: int = 49

    @property
    def day_number(self) -> int:
        return day_number(self.year, self.month, self.day)

    @property
    def seconds_of_day(self) -> int:
        return self.hour * 3600 + self.minute * 60 + self.second


EPOCH = Epoch()


def day_number(year: int, month: int, day: int) -> int:
    """天文纪年 proleptic 格里高利历日序数，整天数，跨 0 年与负数年连续。"""
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    return day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045


def _floor_div(numerator: int, denominator: int) -> int:
    return numerator // denominator


def parse_timestamp(text: str) -> tuple[int, int, int, int, int, int]:
    """`-9999-04-18 09:39:33` -> (年, 月, 日, 时, 分, 秒)。"""
    matched = TIMESTAMP.match(text.strip())
    if matched is None:
        raise ValueError(f"非法时间戳：{text!r}")
    return tuple(int(group) for group in matched.groups())  # type: ignore[return-value]


def _format_timestamp(parts: Sequence[int]) -> str:
    year, month, day, hour, minute, second = parts
    sign = "-" if year < 0 else ""
    return f"{sign}{abs(year):04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"


def timestamp(text: str, epoch: Epoch = EPOCH) -> int:
    """时间戳 -> absolute（秒）。"""
    return absolute_of(parse_timestamp(text), epoch)


def absolute_of(parts: Sequence[int], epoch: Epoch = EPOCH) -> int:
    year, month, day, hour, minute, second = parts
    days = day_number(year, month, day) - epoch.day_number + 1
    return days * SECONDS_PER_DAY + hour * 3600 + minute * 60 + second


def decompose(absolute: int, epoch: Epoch = EPOCH) -> tuple[int, int, int, int, int, int, int, int]:
    """absolute -> (days, seconds, 年, 月, 日, 时, 分, 秒)。"""
    days = _floor_div(absolute, SECONDS_PER_DAY)
    seconds = absolute - days * SECONDS_PER_DAY
    jdn = days - 1 + epoch.day_number
    year, month, day = _civil_from_days(jdn)
    hour, remainder = divmod(seconds, 3600)
    minute, second = divmod(remainder, 60)
    return days, seconds, year, month, day, hour, minute, second


def _civil_from_days(jdn: int) -> tuple[int, int, int]:
    """反解 proleptic 格里高利历日期。"""
    a = jdn + 32044
    b = (4 * a + 3) // 146097
    c = a - (146097 * b) // 4
    d = (4 * c + 3) // 1461
    e = c - (1461 * d) // 4
    m = (5 * e + 2) // 153
    day = e - (153 * m + 2) // 5 + 1
    month = m + 3 - 12 * (m // 10)
    year = 100 * b + d - 4800 + (m // 10)
    return year, month, day


def format_absolute(absolute: int, epoch: Epoch = EPOCH) -> str:
    """absolute -> 可读时间戳（与工作簿同格式）。"""
    _, _, year, month, day, hour, minute, second = decompose(absolute, epoch)
    return _format_timestamp((year, month, day, hour, minute, second))


def iso_absolute(absolute: int, epoch: Epoch = EPOCH) -> str:
    """absolute -> ISO-8601 文本，用于 SQLite 的 TEXT 时间列。"""
    _, _, year, month, day, hour, minute, second = decompose(absolute, epoch)
    sign = "-" if year < 0 else ""
    return f"{sign}{abs(year):04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{second:02d}"


# --------------------------------------------------------------------------- #
# 工作簿读取
# --------------------------------------------------------------------------- #

SHEET_RE = re.compile(r"^(前|第)(\d+)$")


def sheet_span(name: str) -> tuple[int, int]:
    """工作表名 -> 该表覆盖的纪年块首尾年（实测值）。

    `前10` -> (-9999, -9000)，`前1` -> (-999, 0)，`第1` -> (1, 1000)，`第14` -> (13001, 14000)。
    """
    matched = SHEET_RE.match(name.strip())
    if matched is None:
        raise ValueError(f"无法解析工作表名：{name!r}")
    prefix, index = matched.groups()
    blocks = int(index)
    if prefix == "前":
        start = -1000 * blocks + 1
        return (start, start + 999)
    start = (blocks - 1) * 1000 + 1
    return (start, start + 999)


def worksheet_order(names: Iterable[str]) -> list[str]:
    """按时间先后排序工作表名：前10 在最前，第14 在最后。"""
    def sort_key(name: str) -> tuple[int, int]:
        matched = SHEET_RE.match(name.strip())
        if matched is None:
            raise ValueError(f"无法解析工作表名：{name!r}")
        prefix, index = matched.groups()
        if prefix == "前":
            return (-1, -int(index))
        return (1, int(index))

    return sorted(names, key=sort_key)


def load_source(path: str):
    """便利入口：解析工作簿（实现见 `database.source.read_workbook`）。"""
    from .source import read_workbook

    return read_workbook(path)


def connect(path: str, *, pragmas: Sequence[str] = ()) -> sqlite3.Connection:
    """打开 SQLite 连接，使用适合批量导入的参数。"""
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA journal_mode = OFF")
    connection.execute("PRAGMA synchronous = OFF")
    connection.execute("PRAGMA temp_store = MEMORY")
    connection.execute("PRAGMA foreign_keys = OFF")
    connection.execute("PRAGMA cache_size = -262144")
    for pragma in pragmas:
        connection.execute(pragma)
    return connection


def now_stamp() -> str:
    return _datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# --------------------------------------------------------------------------- #
# 批量写入与导出
# --------------------------------------------------------------------------- #

def bindable_names(table: Any) -> list[str]:
    """参与 INSERT 的列名：自增主键由数据库生成，不绑定。"""
    return [column.name for column in table.columns if not column.auto]


def bindable_values(table: Any, row: Sequence[Any]) -> tuple[Any, ...]:
    """按列位置把整行元组裁成"可绑定"的值。

    各模块的 `rows()` 仍然产出与声明列等长的元组（含主键位置上的业务值，
    例如朔望月的全局序号），这里统一剔除自增列，模块侧不必关心。
    """
    return tuple(value for column, value in zip(table.columns, row) if not column.auto)


def insert_prefix(table: Any, *, with_identity: bool = False) -> str:
    """`INSERT INTO "t" ("a","b") VALUES `。

    默认跳过自增主键；`with_identity=True` 时连主键一起写
    （只有 `temporal` 需要：它的主键就是绝对时间本身）。
    """
    names = (
        list(table.column_names) if with_identity else bindable_names(table)
    )
    columns = ", ".join(f'"{name}"' for name in names)
    return f'INSERT INTO "{table.name}" ({columns}) VALUES '


def batch_write(
    connection: Any,
    table: Any,
    rows: Iterable[Sequence[Any]],
    *,
    batch_size: int = 20_000,
    remap: Callable[[Sequence[Any]], Sequence[Any]] | None = None,
) -> int:
    """分批写入，返回写入行数。

    用单行占位符 + `executemany`，由 SQLite 复用同一个预编译语句：
    既避开 SQLITE_MAX_VARIABLE_NUMBER（多值 VALUES 会把 列数 × 行数 个变量一次塞进去），
    又比拼多值语句快。自增主键列不参与绑定。

    `remap` 在绑定前对整行做一次换算，用于把跨库外键的"业务键"换成父表真实的
    identity（见 `database/identity.py`）。
    """
    names = bindable_names(table)
    statement = f"{insert_prefix(table)}({','.join('?' * len(names))})"
    buffer: list[tuple[Any, ...]] = []
    total = 0
    for row in rows:
        mapped = remap(row) if remap is not None else row
        buffer.append(bindable_values(table, mapped))
        if len(buffer) >= batch_size:
            connection.executemany(statement, buffer)
            total += len(buffer)
            buffer.clear()
    if buffer:
        connection.executemany(statement, buffer)
        total += len(buffer)
    return total


def iter_rows(
    table: Any,
    rows: Iterable[Sequence[Any]],
    *,
    rows_per_statement: int = 200,
    with_identity: bool = False,
) -> Iterator[str]:
    """把行渲染成多值 INSERT 语句，用于生成数据初始化 SQL。

    默认跳过自增主键列；`with_identity=True` 时连主键一起写入
    （只有 `temporal` 需要：它的主键就是绝对时间本身）。
    """
    if with_identity:
        columns = list(table.columns)
        prefix = insert_prefix(table, with_identity=True)
    else:
        columns = [column for column in table.columns if not column.auto]
        prefix = insert_prefix(table)

    buffer: list[str] = []
    for row in rows:
        if with_identity:
            values = list(row)
        else:
            values = [value for column, value in zip(table.columns, row) if not column.auto]
        buffer.append("(" + ",".join(column.literal(value) for column, value in zip(columns, values)) + ")")
        if len(buffer) >= rows_per_statement:
            yield prefix + ",".join(buffer) + ";\n"
            buffer.clear()
    if buffer:
        yield prefix + ",".join(buffer) + ";\n"


def count_rows(connection: Any, table_name: str) -> int:
    (count,) = connection.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()
    return int(count)
