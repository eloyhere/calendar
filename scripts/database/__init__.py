"""scripts.database：一个实体一个初始化脚本，由 `initialise.py` 逐个调用。

    python scripts/database/initialise.py           # 全部实体，按依赖顺序
    python scripts/database/temporal.py             # 只建一个实体

分工：`database/` 包回答「一个实体怎么建」——表结构在 `database/schema.py`，
行数据在 `database/<entity>.py`；本目录回答「建哪些、按什么顺序建」——
每个实体一个文件（`scripts/database/<entity>.py`），文件里写清它的实体名、
中文名与依赖，`initialise.py` 按 `database/store.py` 的 `STORE_ORDER` 依次调用。

调用方式是 **import 调用**（不是子进程）：`initialise.py` 只解析一次 `calendar.xlsx`
与一次历史数据，把同一个 `Stores` 交给每个实体脚本，因此 24 个工作表不会重复解析，
父级 identity（元 → 会 → 运 → 世）也能在内存里逐级传递。每个脚本同时可以单独运行，
那时它自己解析工作簿、现算父级 identity，只建自己那一个库。
"""

from __future__ import annotations

import argparse
import importlib
import sys
import time
from pathlib import Path
from typing import Callable, Mapping, Sequence

#: 脚本要从项目根目录导入 `database` 包
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database.build import file_digest
from database.source import read_workbook
from database.store import STORE_ORDER, Stores

__all__ = [
    "DEFAULT_OUT",
    "DEFAULT_SOURCE",
    "ROOT",
    "describe",
    "load_script",
    "new_stores",
    "ordered",
    "run_entity",
    "script_name",
    "script_path",
    "seed_dependencies",
]


#: 源工作簿，缺省取项目根目录下的 calendar.xlsx
DEFAULT_SOURCE = ROOT / "calendar.xlsx"

#: 数据库输出目录，缺省 src/sqlite（一个实体一个 .sqlite）
DEFAULT_OUT = ROOT / "src" / "sqlite"


def script_name(module: str) -> str:
    """实体名 -> 脚本文件名。模块名里有点时（`astronomy.calendar`），文件名用下划线。"""
    return module.replace(".", "_")


def script_path(module: str) -> Path:
    """实体脚本的绝对路径：`scripts/database/<entity>.py`。"""
    return Path(__file__).resolve().parent / f"{script_name(module)}.py"


def load_script(module: str):
    """import 一个实体脚本（`python scripts/database/<entity>.py` 这个文件本体）。"""
    return importlib.import_module(f"{__name__}.{script_name(module)}")


def ordered(only: Sequence[str] | None = None) -> list[str]:
    """要建哪些实体，顺序一律取 `STORE_ORDER`（它就是依赖顺序）。

    `only` 给出子集时也按 `STORE_ORDER` 重排，避免依赖被排在它依赖的实体之前。
    """
    if not only:
        return list(STORE_ORDER)
    unknown = [name for name in only if name not in STORE_ORDER]
    if unknown:
        raise SystemExit(f"未登记的实体：{', '.join(unknown)}\n可选：{', '.join(STORE_ORDER)}")
    wanted = set(only)
    return [module for module in STORE_ORDER if module in wanted]


def new_stores(source: Path) -> Stores:
    """解析工作簿 + 读历史数据，得到各实体共享的 `Stores`。

    整个初始化过程只调用一次：`database/source.py` 的约定是整本工作簿只解析一次。
    """
    workbook = read_workbook(str(source))
    return Stores(workbook=workbook, source_name=source.name, digest=file_digest(source))


def seed_dependencies(stores: Stores, depends: Sequence[str]) -> None:
    """单独运行某个实体时，父级 identity 还没被父实体的 build 填进 `stores`，这里现算。

    父级 identity 完全由工作簿决定（`Assembly.groups()`），与父库是否已建好无关；
    `initialise.py` 按顺序调用时父级已经在 `stores.identities` 里，这里只补缺、不覆盖。
    """
    for module in depends:
        if module in stores.identities:
            continue
        package = importlib.import_module(f"database.{module}")
        assembly = getattr(package, "ASSEMBLY", None)
        if assembly is None:
            raise SystemExit(f"{module} 没有 ASSEMBLY，无法为它现算父级 identity")
        stores.identities[module] = {group.order: group.identity for group in assembly.groups(stores.workbook)}


def describe(module: str, counts: Mapping[str, int], out_dir: Path, seconds: float) -> str:
    """一行进度：实体、表数、行数、体积、耗时（列宽与 `database/store.py` 的日志对齐）。"""
    path = out_dir / f"{module}.sqlite"
    size = path.stat().st_size / 1048576 if path.exists() else 0.0
    return f"  {module:<14} {len(counts)} 表 {sum(counts.values()):>10,} 行 {size:>8.3f} MiB {seconds:>5.1f}s"


def run_entity(
    module: str,
    title: str,
    depends: Sequence[str],
    build: Callable[..., dict[str, int]],
    argv: Sequence[str] | None = None,
) -> int:
    """单独运行一个实体脚本的统一入口：解析参数 -> 解析工作簿 -> 建库 -> 打一行日志。

    @param module 实体名（= `src/sqlite/<module>.sqlite`）。
    @param title 中文名，只用于 `--help` 与日志。
    @param depends 需要先建好的实体（提供父级 identity）。
    @param build 实体脚本自己的 build 函数。
    @param argv 命令行参数；缺省取 `sys.argv[1:]`。
    """
    parser = argparse.ArgumentParser(
        prog=f"python scripts/database/{script_name(module)}.py",
        description=f"建出 {module}.sqlite（{title}）",
    )
    parser.add_argument("source", nargs="?", default=str(DEFAULT_SOURCE), help="源工作簿，缺省 calendar.xlsx")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="数据库输出目录，缺省 src/sqlite")
    parser.add_argument("--no-vacuum", action="store_true", help="跳过 VACUUM / ANALYZE")
    arguments = parser.parse_args(argv)

    source = Path(arguments.source)
    if not source.exists():
        print(f"源文件不存在：{source}", file=sys.stderr)
        return 1

    started = time.time()
    stores = new_stores(source)
    seed_dependencies(stores, depends)
    out_dir = Path(arguments.out)
    counts = build(stores, out_dir, vacuum=not arguments.no_vacuum)
    print(describe(module, counts, out_dir, time.time() - started))
    return 0
