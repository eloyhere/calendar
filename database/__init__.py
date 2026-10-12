"""database 包：把 calendar.xlsx 转换为 SQLite 数据库。

分层的唯一约定见 `docs/design.md`。

- 每个实体一个模块，模块名与 `src/entity/<entity>.ts` 同名。
- 每个模块提供 `create(connection)`（建表）与 `load(connection, data)`（写入）。
- 表结构集中声明在 `schema.py`，`src/sql/*.sql` 由它生成，避免两处漂移。
"""

from .core import (
    Epoch,
    connect,
    day_number,
    load_source,
    parse_timestamp,
    timestamp,
)

__all__ = [
    "Epoch",
    "connect",
    "day_number",
    "load_source",
    "parse_timestamp",
    "timestamp",
]
