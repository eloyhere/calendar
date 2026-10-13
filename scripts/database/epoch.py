"""epoch：世。

世：1 世 = 30 朔望年，12 世 = 1 运；`perform` 列取运表的 identity。

    python scripts/database/epoch.py [calendar.xlsx] [--out src/sqlite] [--no-vacuum]

建出 src/sqlite/epoch.sqlite；`scripts/database/initialise.py` 按依赖顺序调用本文件。
单独运行时工作簿由本脚本自己解析，父级 identity 由 `scripts/database/__init__.py` 现算（父库不必先建好）。
"""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):  # 允许 `python scripts/database/epoch.py` 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from database.store import Stores, build_store
from scripts.database import run_entity

#: 实体名：等于 src/sqlite/<module>.sqlite、src/sql/<module>.sql、database/<module>.py
MODULE = "epoch"

#: 中文名，只用于日志与 --help
TITLE = "世"

#: 需要先建好的实体：它提供父级 identity，经 Stores.identities 传递
DEPENDS: tuple[str, ...] = ("perform",)


def build(stores: Stores, out_dir: Path, *, vacuum: bool = True) -> dict[str, int]:
    """建出本实体的 SQLite 文件，返回 表名 -> 行数。"""
    return build_store(MODULE, stores, out_dir, vacuum=vacuum)


def main(argv: list[str] | None = None) -> int:
    """单独运行本实体：python scripts/database/epoch.py。"""
    return run_entity(MODULE, TITLE, DEPENDS, build, argv)


if __name__ == "__main__":
    raise SystemExit(main())
