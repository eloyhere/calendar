"""gregory.calendar：格里高利历。

proleptic 格里高利历（年 + 月）：年界 1 月 1 日、月界各月 1 日，闰年 366 天、平年 365 天；
换算法则见 `database/calendars.py` 的 `gregory.calendar` 一项。

    python scripts/database/gregory_calendar.py [calendar.xlsx] [--out src/sqlite] [--no-vacuum]

建出 src/sqlite/gregory.calendar.sqlite；`scripts/database/initialise.py` 按依赖顺序调用本文件。
单独运行与 `initialise.py` 调用等价：解析工作簿，只建这一个库。
"""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):  # 允许 `python scripts/database/gregory_calendar.py` 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from database.store import Stores, build_store
from scripts.database import run_entity

#: 实体名：等于 src/sqlite/<module>.sqlite、src/sql/<module>.sql、database/<module>.py
MODULE = "gregory.calendar"

#: 中文名，只用于日志与 --help
TITLE = "格里高利历"

#: 需要先建好的实体：它提供父级 identity，经 Stores.identities 传递
DEPENDS: tuple[str, ...] = ()


def build(stores: Stores, out_dir: Path, *, vacuum: bool = True) -> dict[str, int]:
    """建出本实体的 SQLite 文件，返回 表名 -> 行数。"""
    return build_store(MODULE, stores, out_dir, vacuum=vacuum)


def main(argv: list[str] | None = None) -> int:
    """单独运行本实体：python scripts/database/gregory_calendar.py。"""
    return run_entity(MODULE, TITLE, DEPENDS, build, argv)


if __name__ == "__main__":
    raise SystemExit(main())
