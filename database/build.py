"""database.build：把 calendar.xlsx 构建成 SQLite 数据库与 SQL 文件。

    python database/build.py [calendar.xlsx] [--out src/sqlite]

产物与实体一一对应：

    src/sqlite/<entity>.sqlite        每个实体一个 SQLite 文件
    src/sql/<entity>.sql              每个实体的查询语句（由 sqlfiles.py 生成）
    database/sql/<entity>/data.sql    每个实体的行数据导出（由 datafiles.py 生成）

分库之间需要跨表查询时，用 `database/combine.py` 合并成全库。
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import time
from pathlib import Path

if __package__ in (None, ""):  # 允许 `python database/build.py` 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.source import read_workbook
from database.store import STORE_ORDER, build_stores


def file_digest(path: Path) -> str:
    """源文件 SHA-256，用于各分库的 `_meta` 追溯。"""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="构建 src/sqlite/<entity>.sqlite")
    parser.add_argument("source", nargs="?", default="calendar.xlsx", help="源工作簿")
    parser.add_argument("--out", default="src/sqlite", help="数据库输出目录")
    parser.add_argument("--no-vacuum", action="store_true", help="跳过 VACUUM")
    parser.add_argument("--only", nargs="*", default=None, help="只构建指定实体")
    arguments = parser.parse_args(argv)

    started = time.time()
    source = Path(arguments.source)
    if not source.exists():
        print(f"源文件不存在：{source}", file=sys.stderr)
        return 1

    print(f"[1/3] 解析 {source.name}")
    workbook = read_workbook(str(source))
    print(
        f"      {len(workbook.months)} 个朔望月，{len(workbook.sheets)} 个工作表，"
        f"全局月序 {workbook.first_month_index} … "
        f"{workbook.month_index(len(workbook.months) - 1)}"
    )

    digest = file_digest(source)
    out_dir = Path(arguments.out)
    targets = arguments.only or STORE_ORDER
    print(f"[2/3] 逐个实体建库 -> {out_dir}（{len(targets)} 个）")
    per_module = build_stores(
        workbook,
        source_name=source.name,
        source_path=str(source),
        digest=digest,
        out_dir=out_dir,
        vacuum=not arguments.no_vacuum,
        only=arguments.only,
    )

    total_rows = sum(sum(counts.values()) for counts in per_module.values())
    total_bytes = sum(
        (out_dir / f"{module}.sqlite").stat().st_size for module in per_module
    )
    print(
        f"[3/3] 完成：{len(per_module)} 个数据库、{total_rows:,} 行、"
        f"{total_bytes / 1048576:.1f} MiB，用时 {time.time() - started:.1f}s"
    )
    print("      合并全库：python database/combine.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
