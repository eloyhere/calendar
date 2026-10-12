"""database.combine：把各实体的分库合并成全库。

    python database/combine.py [--dir src/sqlite] [--target src/sqlite/calendar.sqlite]

为什么需要合并：一个实体一个 `.sqlite` 文件便于逐个核对与替换，但 SQLite
不支持跨文件外键，跨实体查询（例如"这个朔望月落在哪一世"）无法在分库里完成。
本模块用 `ATTACH` 把分库挂上来，按表 `INSERT INTO … SELECT …` 灌进全库，
数据仍然只有一份来源：`src/sqlite/*.sqlite` 分库本身。
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.core import connect, count_rows, now_stamp
from database.schema import TABLES, by_module
from database.store import STORE_ORDER


def _qualified(schema: str, table: str) -> str:
    return f'"{schema}"."{table}"'


def combine(
    store_dir: Path,
    target: Path,
    *,
    source_name: str,
    digest: str,
    vacuum: bool = True,
) -> dict[str, int]:
    """把所有存在的分库合并到 `target`。返回 表名 -> 行数。"""
    available = [module for module in STORE_ORDER if (store_dir / f"{module}.sqlite").exists()]
    missing = [module for module in STORE_ORDER if module not in available]
    if missing:
        print(f"      跳过尚未构建的实体：{', '.join(missing)}")

    if target.exists():
        target.unlink()
    target.parent.mkdir(parents=True, exist_ok=True)

    connection = connect(str(target))
    counts: dict[str, int] = {}
    try:
        for module in available:
            connection.execute(f"ATTACH DATABASE ? AS {module}", (str(store_dir / f'{module}.sqlite'),))

        # 建出全部分库都有的表结构（全库不施加外键，跨库关联见 docs/design.md）
        for module in available:
            for table in by_module(module):
                connection.executescript(_create_sql(table))

        for module in available:
            for table in by_module(module):
                columns = ", ".join(f'"{name}"' for name in table.column_names)
                connection.execute(
                    f'INSERT INTO "{table.name}" ({columns}) '
                    f"SELECT {columns} FROM {_qualified(module, table.name)}"
                )
                counts[table.name] = count_rows(connection, table.name)
            connection.execute(f"DETACH DATABASE {module}")

        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS "_meta" (
                "key"   TEXT PRIMARY KEY,
                "value" TEXT NOT NULL
            );
            """
        )
        connection.executemany(
            'INSERT OR REPLACE INTO "_meta" ("key","value") VALUES (?,?)',
            [
                ("kind", "combined"),
                ("built_from", ", ".join(f"{module}.sqlite" for module in available)),
                ("source", source_name),
                ("source_sha256", digest),
                ("built_at", now_stamp()),
                ("tables", str(len(counts))),
                ("rows", str(sum(counts.values()))),
            ],
        )
        connection.commit()
    finally:
        connection.close()

    if vacuum:
        connection = connect(str(target))
        try:
            connection.execute("PRAGMA journal_mode = DELETE")
            connection.execute("VACUUM")
            connection.execute("ANALYZE")
            connection.commit()
        finally:
            connection.close()

    return counts


def _create_sql(table) -> str:
    from database.schema import emit_sqlite

    return emit_sqlite(table)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="合并 src/sqlite/*.sqlite")
    parser.add_argument("--dir", default="src/sqlite", help="分库目录")
    parser.add_argument("--target", default=None, help="全库路径，默认 <dir>/calendar.sqlite")
    parser.add_argument("--source", default="calendar.xlsx", help="源工作簿名，仅写入 _meta")
    parser.add_argument("--no-vacuum", action="store_true")
    arguments = parser.parse_args(argv)

    store_dir = Path(arguments.dir)
    target = Path(arguments.target) if arguments.target else store_dir / "calendar.sqlite"
    started = time.time()

    print(f"合并 {store_dir}/*.sqlite -> {target}")
    counts = combine(
        store_dir,
        target,
        source_name=arguments.source,
        digest="",
        vacuum=not arguments.no_vacuum,
    )
    for name in sorted(counts):
        print(f"  {name:<28} {counts[name]:>10,}")
    print(
        f"完成：{len(counts)} 张表、{sum(counts.values()):,} 行、"
        f"{target.stat().st_size / 1048576:.1f} MiB，用时 {time.time() - started:.1f}s"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
