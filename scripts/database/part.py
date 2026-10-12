"""part：旬。

旬：上旬 1-10、中旬 11-20、下旬 21-月末，一个朔望月三条。

    python scripts/database/part.py [calendar.xlsx] [--out src/sqlite] [--no-vacuum]

建出 src/sqlite/part.sqlite；`scripts/database/initialise.py` 按依赖顺序调用本文件。
单独运行与 `initialise.py` 调用等价：解析工作簿，只建这一个库。
"""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):  # 允许 `python scripts/database/part.py` 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from database.store import Stores, build_store
from scripts.database import run_entity

#: 实体名：等于 src/sqlite/<module>.sqlite、src/sql/<module>.sql、database/<module>.py
MODULE = "part"

#: 中文名，只用于日志与 --help
TITLE = "旬"

#: 需要先建好的实体：它提供父级 identity，经 Stores.identities 传递
DEPENDS: tuple[str, ...] = ()


def build(stores: Stores, out_dir: Path, *, vacuum: bool = True) -> dict[str, int]:
    """建出本实体的 SQLite 文件，返回 表名 -> 行数。"""
    return build_store(MODULE, stores, out_dir, vacuum=vacuum)


def main(argv: list[str] | None = None) -> int:
    """单独运行本实体：python scripts/database/part.py。"""
    return run_entity(MODULE, TITLE, DEPENDS, build, argv)


if __name__ == "__main__":
    raise SystemExit(main())
