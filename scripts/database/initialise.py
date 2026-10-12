"""整个项目的数据初始化：按依赖顺序逐个实体建库。

    python scripts/database/initialise.py [calendar.xlsx] [--out src/sqlite]
                                          [--only temporal synodic] [--no-vacuum] [--list]

三步：

1. 解析 `calendar.xlsx` 一次，并读一次历史数据（`database/data/*.csv`），得到各实体共享的 `Stores`；
2. 按 `database/store.py` 的 `STORE_ORDER`（它本身就是依赖顺序）依次 import 同目录的实体脚本
   `scripts/database/<entity>.py`，调用它的 `build()`，由那个脚本建出 `src/sqlite/<entity>.sqlite`；
3. 打印每个实体的表数 / 行数 / 体积 / 耗时与合计，并提示后续两步。

顺序为什么重要：`temporal` 提供全库时间点；`primary` → `encounter` → `perform` → `epoch`
逐级提供父级 identity（在 `Stores.identities` 里传递，不落库）。其余实体只依赖工作簿与历史数据。

调用方式是 import 调用而不是子进程，所以工作簿只解析一次；每个实体脚本也可以单独运行
（`python scripts/database/<entity>.py`），那时它自己解析工作簿。

SQL 文本与自检不在本脚本里：

    python database/sqlfiles.py --with-data      # 建表 / 初始化 / 查询 SQL
    python database/verify.py                    # 分库自检 + 跨库关联核对
    python database/combine.py                   # 合并成全库
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

if __package__ in (None, ""):  # 允许 `python scripts/database/initialise.py` 直接运行
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.database import (
    DEFAULT_OUT,
    DEFAULT_SOURCE,
    ROOT,
    describe,
    load_script,
    new_stores,
    ordered,
    script_path,
)


def absent_scripts(modules: list[str]) -> list[str]:
    """`STORE_ORDER` 里登记了、但还没有实体脚本的实体。"""
    return [module for module in modules if not script_path(module).exists()]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python scripts/database/initialise.py",
        description="整个项目的数据初始化：逐实体建出 src/sqlite/<entity>.sqlite",
    )
    parser.add_argument("source", nargs="?", default=str(DEFAULT_SOURCE), help="源工作簿，缺省 calendar.xlsx")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="数据库输出目录，缺省 src/sqlite")
    parser.add_argument("--only", nargs="+", default=None, help="只建这些实体（仍按依赖顺序）")
    parser.add_argument("--no-vacuum", action="store_true", help="跳过 VACUUM / ANALYZE")
    parser.add_argument("--list", action="store_true", help="只列出实体与对应脚本，不建库")
    arguments = parser.parse_args(argv)

    modules = ordered(arguments.only)

    if arguments.list:
        print(f"实体脚本共 {len(modules)} 个，顺序即依赖顺序：")
        for index, module in enumerate(modules, start=1):
            path = script_path(module).relative_to(ROOT)
            print(f"  {index:>2}. {module:<14} -> {path}")
        return 0

    absent = absent_scripts(modules)
    if absent:
        for module in absent:
            print(f"缺少实体脚本：{script_path(module)}", file=sys.stderr)
        return 1

    source = Path(arguments.source)
    if not source.exists():
        print(f"源文件不存在：{source}", file=sys.stderr)
        return 1

    out_dir = Path(arguments.out)
    started = time.time()
    print(f"源：{source}")
    print(f"输出：{out_dir}")
    print("[1/2] 解析工作簿与历史数据")
    stores = new_stores(source)
    workbook = stores.workbook
    print(
        f"      {len(workbook.months):,} 个朔望月，{len(workbook.sheets)} 个工作表，"
        f"全局月序 {workbook.first_month_index} … {workbook.month_index(len(workbook.months) - 1)}"
    )

    print(f"[2/2] 逐个实体建库（{len(modules)} 个）")
    per_module: dict[str, dict[str, int]] = {}
    for module in modules:
        entity_started = time.time()
        try:
            script = load_script(module)
            counts = script.build(stores, out_dir, vacuum=not arguments.no_vacuum)
        except Exception as error:  # 建库失败就停在这里，后面的实体依赖它
            print(f"  {module} 建库失败：{type(error).__name__}: {error}", file=sys.stderr)
            return 1
        per_module[module] = counts
        print(describe(module, counts, out_dir, time.time() - entity_started))

    rows = sum(sum(counts.values()) for counts in per_module.values())
    size = sum((out_dir / f"{module}.sqlite").stat().st_size for module in per_module)
    print(
        f"完成：{len(per_module)} 个数据库、{rows:,} 行、{size / 1048576:.1f} MiB，"
        f"用时 {time.time() - started:.1f}s"
    )
    print("      SQL 文本：python database/sqlfiles.py --with-data")
    print("      自检：python database/verify.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
