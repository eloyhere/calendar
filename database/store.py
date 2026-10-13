"""database.store：每个实体一个 SQLite 文件。

    src/sqlite/temporal.sqlite      primary.sqlite      dynasty.sqlite     …
    src/sqlite/synodic.sqlite       encounter.sqlite    astronomy.sqlite   …

一个实体一个文件、一个文件一张（或同一实体内紧密相关的几张）表，
与 `src/entity/*.ts`、`src/sql/*.sql`、`src/sqlite/*.sqlite` 逐一对齐。

构建顺序即依赖顺序，后建的文件从先建的实体取键：
`temporal` 提供全库时间点，`synodic_month` 提供给元/会/运/世的切分。

SQLite 不支持跨文件外键，因此跨实体关联只写在 `docs/design.md` 与各 `.sql` 注释里；
需要跨表查询时用 `database/combine.py` 把这些分库合并成全库。
"""

from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterator, Sequence

from .core import batch_write, connect, count_rows, now_stamp
from .association import fill
from .identity import Identities
from .history import History, load_history
from .schema import Table, by_module, emit_sqlite
from .source import Workbook

__all__ = [
    "STORE_ORDER",
    "Stores",
    "build_store",
    "build_stores",
    "create_module",
    "fill_module_associations",
    "finish_associations",
    "load_module",
    "write_meta",
]


def write_meta(
    connection: sqlite3.Connection,
    *,
    module: str,
    source_name: str,
    digest: str,
    counts: dict[str, int],
) -> None:
    """每个分库都记录自己的来源与行数，便于逐个核对。"""
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS "_meta" (
            "key"   TEXT PRIMARY KEY,
            "value" TEXT NOT NULL
        );
        """
    )
    rows = [
        ("module", module),
        ("source", source_name),
        ("source_sha256", digest),
        ("built_at", now_stamp()),
        ("tables", ", ".join(counts)),
        ("rows", str(sum(counts.values()))),
        ("counts", ", ".join(f"{name}={value}" for name, value in sorted(counts.items()))),
    ]
    connection.executemany('INSERT OR REPLACE INTO "_meta" ("key","value") VALUES (?,?)', rows)
    connection.commit()


@dataclass
class Stores:
    """构建过程中各分库之间需要传递的键。"""

    workbook: Workbook
    source_name: str
    digest: str
    #: 源工作簿路径，供必须重建解析结果时使用
    source_path: str = "calendar.xlsx"
    #: 朝代/年号/人物/事件的数据来源
    history: History = field(default_factory=load_history)
    #: 表名 -> 行数
    counts: dict[str, int] = field(default_factory=dict)
    #: 实体模块名 -> 该库的 (表名 -> 行数)
    per_module: dict[str, dict[str, int]] = field(default_factory=dict)
    #: 跨库外键的「业务键 -> identity」登记表（见 database/identity.py）
    identities: Identities = field(default_factory=Identities)
    #: 分库输出目录：填关联表时要按模块名找父库
    out_dir: Path = field(default_factory=lambda: Path("src") / "sqlite")


def remapper(stores: Stores, table: Table) -> Callable[[Sequence[Any]], Sequence[Any]]:
    """为一张表生成"跨库外键换算"函数。

    子表的 `references` 形如 `synodic_calendar_year.identity`，而该列里存的是
    业务键（例如纪年块标签），故按父表的业务键换成真实的自增 identity。

    **只有 `None` 视为"没有值"**：业务键 `0` 是合法的 —— 元/会/运/世四层的业务键是
    "全局序号"，建元所在元就是第 0 元（`primary.absolute = 0`），第 0 会、第 0 运、
    第 0 世同理。若把 0 也当成"不涉及"跳过，这些行的外键会全部落成 0，
    而父表里根本没有 identity = 0 的行。查不到的业务键（例如 `event.dynasty` 里
    未知朝代写的 0，而 `dynasty` 的业务键是起始年的绝对时间）自然保持原值。
    """
    foreign = [column for column in table.columns if column.references]
    if not foreign:
        return lambda row: row

    positions: list[tuple[int, str]] = []
    for column in foreign:
        parent = column.references.split(".")[0]
        index = table.column_names.index(column.name)
        positions.append((index, parent))

    def convert(row: Sequence[Any]) -> Sequence[Any]:
        values = list(row)
        for index, parent in positions:
            key = values[index]
            if key is None:
                continue
            resolved = stores.identities.resolve(parent, key)
            if resolved is not None:
                values[index] = resolved
        return values

    return convert


def ensure_derived(stores: Stores, module: str) -> None:
    """保证当前 workbook 上的派生时间点缓存已算过。

    `temporal` 与"气候 / 旬 / 周"这类按固定天数切分的表由各自独立的进程构建，
    派生时间点集合又是 `Workbook` 上的缓存，因此建这类表之前必须在同一个
    workbook 实例上重算一次，否则 `temporal` 会漏掉这些边界时刻。
    """
    if module == "temporal" or stores.workbook._derived is not None:
        return
    from .source import read_workbook

    workbook = read_workbook(stores.source_path)
    workbook.derived_stamps()
    stores.workbook = workbook


def create_module(connection: sqlite3.Connection, module: str) -> list[str]:
    """建出某个实体的全部表。"""
    tables = by_module(module)
    for table in tables:
        connection.executescript(emit_sqlite(table))
    return [table.name for table in tables]


def seed_from_table(stores: Stores, connection: sqlite3.Connection, table: Table) -> None:
    """从已写入的父表读回「业务键 -> identity」，供子表换算跨库外键。

    主键是数据库自增的，行号在写入前无法预知，因此父表写完后立刻回读一次；
    子表按构建顺序都在父表之后，读得到。
    """
    key_name = stores.identities.business_key_of(table.name)
    if key_name not in table.column_names:
        return
    rows = connection.execute(
        f'SELECT "{key_name}", "identity" FROM "{table.name}"'
    ).fetchall()
    for key, identity in rows:
        stores.identities.record(table.name, key, int(identity))


def write_table(
    connection: sqlite3.Connection,
    stores: Stores,
    table: Table,
    rows: Iterator[Sequence[Any]],
) -> int:
    """写入一张表：登记业务键、换算跨库外键、批量插入，最后回读 identity。"""
    written = batch_write(
        connection,
        table,
        rows,
        remap=remapper(stores, table),
    )
    seed_from_table(stores, connection, table)
    return written


def ensure_parent_identities(stores: Stores, module: str) -> None:
    """保证本模块要用的父级 identity 已登记。

    跨库外键换算（`remapper()`）要求「父表业务键 -> identity」已经在
    `stores.identities` 里。整批建库时父表刚写完就由 `seed_from_table()` 登记好了；
    只建子集时（`initialise.py --only`、单独运行某个实体脚本）父表没被回读过，
    这里补一次，两条路：

    1. 父库文件已存在 —— 只读打开，按它的业务键列回读（`synodic` -> `chronology`
       这类跨层依赖走这条）；
    2. 父库不存在、但父实体有 `ASSEMBLY` —— 按 `Assembly.groups()` 现算
       （层级 identity 完全由工作簿决定，与父库是否存在无关）。

    缺这一步时 `remapper()` 查不到父级，外键会整列保留业务键原值
    （例如 `chronology.synodic` 里会留下年首绝对时间，而不是 `synodic_calendar_year`
    的 identity），`database/verify.py` 的跨库核对就会报错。
    """
    import importlib

    from .schema import TABLES

    module_of = {table.name: table.module for table in TABLES}
    for table in by_module(module):
        for column in table.columns:
            if not column.references:
                continue
            parent_table = column.references.split(".")[0]
            if stores.identities.known(parent_table):
                continue
            _seed_parent(stores, parent_table, module_of.get(parent_table), importlib)


def _seed_parent(
    stores: Stores, parent_table: str, parent_module: str | None, importlib: object
) -> None:
    """登记一张父表的「业务键 -> identity」：先回读父库，再退回 ASSEMBLY 现算。"""
    if parent_module is None:
        return

    key_name = stores.identities.business_key_of(parent_table)
    path = Path(stores.out_dir) / f"{parent_module}.sqlite"
    if path.exists():
        rows: list[tuple[Any, Any]] = []
        try:
            handle = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
            try:
                rows = handle.execute(
                    f'SELECT "{key_name}", "identity" FROM "{parent_table}"'
                ).fetchall()
            finally:
                handle.close()
        except sqlite3.Error:
            rows = []
        if rows:
            for key, identity in rows:
                stores.identities.record(parent_table, key, int(identity))
            return

    package = _import_module(importlib, parent_module)
    if package is None:
        return
    assembly = getattr(package, "ASSEMBLY", None)
    if assembly is None:
        return
    # 层级表的行按全局序号升序插入，分库自增 identity 就是 1 起的位置；
    # `Group.identity` 是首个月首的绝对时间，那是 `start` 列的值，不是 identity。
    stores.identities.seed_orders(
        parent_table,
        {
            group.order: position
            for position, group in enumerate(assembly.groups(stores.workbook), start=1)
        },
    )


def _import_module(importlib: object, module: str) -> object | None:
    """按实体模块名 import `database/<module>.py`。

    七部派生历法的实体名带点（`astronomy.calendar`），而 Python 模块去掉 `.calendar`
    后缀（`database/astronomy.py`）；其余同名。import 不到时返回 None ——
    只有元/会/运/世四层有 `ASSEMBLY`，其余父表靠回读父库，本就不该在这里 import。
    """
    for name in (module, module.split(".")[0]):
        try:
            return importlib.import_module(f".{name}", __package__)  # type: ignore[attr-defined]
        except ImportError:
            continue
    return None


def load_module(connection: sqlite3.Connection, stores: Stores, module: str) -> dict[str, int]:
    """写入某个实体的全部行数据。"""
    from . import (
        astronomy,
        chronology,
        climate,
        dynasty,
        encounter,
        epoch,
        era,
        event,
        gregory,
        jupiter,
        natural,
        part,
        perform,
        person,
        phase,
        phenology,
        primary,
        synodic,
        temporal,
        tree,
        tropical,
        week,
    )

    ensure_parent_identities(stores, module)
    workbook = stores.workbook
    history = stores.history
    counts: dict[str, int] = {}

    if module == "temporal":
        counts["temporal"] = temporal.load(connection, workbook, history)
        seed_from_table(stores, connection, temporal.TABLE)
    elif module == "phenology":
        counts["phenology"] = write_table(
            connection, stores, phenology.TABLE, phenology.rows(workbook)
        )
    elif module == "phase":
        counts["phase"] = write_table(connection, stores, phase.TABLE, phase.rows(workbook))
    elif module == "climate":
        # 模块 climate 三张表：气候表有行数据（month 是跨库外键，由 write_table 换算），
        # 节气纪年的年 / 月待换算
        counts.update(climate.load(connection, stores, workbook))
    elif module == "part":
        counts["part"] = write_table(connection, stores, part.TABLE, part.rows(workbook))
    elif module == "week":
        counts["week"] = write_table(connection, stores, week.TABLE, week.rows(workbook))
    elif module == "synodic":
        counts[synodic.YEAR_TABLE.name] = write_table(
            connection, stores, synodic.YEAR_TABLE, synodic.year_rows(workbook)
        )
        counts[synodic.MONTH_TABLE.name] = write_table(
            connection, stores, synodic.MONTH_TABLE, synodic.month_rows(workbook)
        )
    elif module == "primary":
        counts["primary"] = write_table(
            connection, stores, primary.TABLE, primary.rows(workbook)
        )
    elif module == "encounter":
        counts["encounter"] = write_table(
            connection, stores, encounter.TABLE, encounter.rows(workbook)
        )
    elif module == "perform":
        counts["perform"] = write_table(
            connection, stores, perform.TABLE, perform.rows(workbook)
        )
    elif module == "epoch":
        counts["epoch"] = write_table(
            connection, stores, epoch.TABLE, epoch.rows(workbook)
        )
    elif module == "dynasty":
        counts["dynasty"] = write_table(
            connection, stores, dynasty.TABLE, dynasty.rows(history)
        )
    elif module == "era":
        counts["era"] = write_table(connection, stores, era.TABLE, era.rows(history))
    elif module == "person":
        counts["person"] = write_table(
            connection, stores, person.TABLE, person.rows(history)
        )
    elif module == "event":
        counts["event"] = write_table(connection, stores, event.TABLE, event.rows(history))
    elif module == "chronology":
        # 与 climate 一样返回「表名 -> 行数」的字典，故用 update 而不是赋值
        counts.update(chronology.load(connection, stores, workbook))
    else:
        module_object = {
            "astronomy.calendar": astronomy,
            "gregory.calendar": gregory,
            "jupiter.calendar": jupiter,
            "natural.calendar": natural,
            "tree.calendar": tree,
            "tropical.calendar": tropical,
        }[module]
        counts.update(module_object.load(connection, stores, workbook))

    stores.counts.update(counts)
    stores.per_module[module] = counts
    for table in by_module(module):
        counts.setdefault(table.name, 0)
    return counts


#: 建库顺序：时间 -> 候/相/旬/周 -> 朔望年月 -> 世运会展 -> 朝代/年号/人物/事件
#: -> 七部派生历法 -> 纪年
STORE_ORDER: list[str] = [
    # 顺序即依赖顺序：父表先建，子表的跨库外键才解得开 business_key -> identity。
    # temporal：全库时间坐标系，主键就是绝对时间本身
    "temporal",
    # 朔望年 -> 朔望月：候/气候/相/旬/周的 month、year 都指向它们
    "synodic",
    "phenology",
    "climate",
    "phase",
    "part",
    "week",
    # 元会运世：逐层指向上一级
    "primary",
    "encounter",
    "perform",
    "epoch",
    # 历史四表：event 指向 dynasty 与 era
    "dynasty",
    "era",
    "person",
    "event",
    # 七部派生历法：年 / 月表
    "astronomy.calendar",
    "gregory.calendar",
    "jupiter.calendar",
    "natural.calendar",
    "tree.calendar",
    "tropical.calendar",
    # chronology 的八列年分别指向上面每一部历法的年表，故必须排在它们之后
    "chronology",
]


def fill_associations(
    module: str,
    stores: Stores,
    connection: sqlite3.Connection,
    opened: dict[str, sqlite3.Connection],
) -> dict[str, int]:
    """填充本模块声明的关联表，返回 `表名 -> 行数`。

    关联表的两端可能分属不同库（例如 `synodic_month_phenologies` 的 month 在
    `synodic.sqlite`、phenology 在 `phenology.sqlite`），所以按表名解析到各自的库：
    本模块的表用当前连接，别的模块的表**临时只读打开、读完立刻关闭**。

    关联表两端的模块**不一定**在本模块之前建好：`primary_performs` 的父端 primary
    先建、子端 perform 后建；`synodic_month_weeks` 的子端 week 也排在 synodic 之后。
    因此本函数只在"全部模块都建完"的第二遍里调用（见 `finish_associations`），
    那时两端都已是完整区间。
    """
    from .association import associations_of, fill
    from .schema import TABLES

    if not associations_of(module):
        return {}

    module_of = {table.name: table.module for table in TABLES}
    out_dir = stores.out_dir

    def connection_for(table_name: str) -> sqlite3.Connection | None:
        owner = module_of.get(table_name)
        if owner is None:
            return None
        if owner == module:
            return connection
        handle = opened.get(owner)
        if handle is not None:
            return handle
        path = out_dir / f"{owner}.sqlite"
        if not path.exists():
            return None
        handle = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        opened[owner] = handle
        return handle

    return fill(module, connection, stores, connection_for)


def fill_module_associations(
    module: str,
    stores: Stores,
    out_dir: Path,
    *,
    vacuum: bool = True,
) -> dict[str, int]:
    """第二遍：只填某个模块的关联表，并把结果写回该库的 `_meta`。

    必须等全部模块都建完之后再调用：关联表两端的模块未必都排在它前面。
    """
    from .association import associations_of

    path = out_dir / f"{module}.sqlite"
    tables = by_module(module)
    if not path.exists() or not associations_of(module):
        return {}

    stores.out_dir = out_dir
    opened: dict[str, sqlite3.Connection] = {}
    try:
        connection = connect(str(path))
        try:
            counts = {table.name: count_rows(connection, table.name) for table in tables}
            counts.update(fill_associations(module, stores, connection, opened))
            connection.commit()
            write_meta(
                connection,
                module=module,
                source_name=stores.source_name,
                digest=stores.digest,
                counts={table.name: counts.get(table.name, 0) for table in tables},
            )
        finally:
            connection.close()
    finally:
        # 句柄跨模块留着，后面那个模块重建自己的库时 `unlink` 会报 WinError 32
        for handle in opened.values():
            handle.close()

    if vacuum:
        connection = connect(str(path))
        try:
            connection.execute("PRAGMA journal_mode = DELETE")
            connection.execute("VACUUM")
            connection.execute("ANALYZE")
            connection.commit()
        finally:
            connection.close()

    return {table.name: counts.get(table.name, 0) for table in tables}


def finish_associations(
    stores: Stores,
    out_dir: Path,
    *,
    modules: Sequence[str] | None = None,
    vacuum: bool = True,
) -> dict[str, dict[str, int]]:
    """全部模块建完后统一填关联表（第二遍）。返回 `实体 -> (表名 -> 行数)`。"""
    stores.out_dir = out_dir
    result: dict[str, dict[str, int]] = {}
    for module in modules or STORE_ORDER:
        counts = fill_module_associations(module, stores, out_dir, vacuum=vacuum)
        if counts:
            result[module] = counts
    return result


def build_store(
    module: str,
    stores: Stores,
    out_dir: Path,
    *,
    vacuum: bool = True,
    associations: bool = False,
) -> dict[str, int]:
    """建出某一个实体的 SQLite 文件，返回 `表名 -> 行数`。

    `out_dir/<module>.sqlite` 整体重建（先删后建）：表结构取 `database/schema.py`，
    行数据取 `database/<module>.py`，最后写入 `_meta`，可选 VACUUM + ANALYZE。

    跨实体的键都从 `stores` 取（`identities` 里的父级 identity、`history` 里的历史数据），
    因此调用方必须先建好本实体依赖的那些实体 —— 顺序见 `STORE_ORDER`。
    一实体一个脚本（`scripts/database/<entity>.py`）就是对本函数的包装。

    @param associations 只建本实体时置 True：本实体的关联表立刻填一遍。
        整批建库时保持 False，由 `finish_associations()` 在全部模块建完后统一填 ——
        关联表的另一端可能排在后面，提前填只会得到空表。
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{module}.sqlite"
    counts = _build_one(module, stores, out_dir, path, vacuum=vacuum)
    if associations:
        returned = fill_module_associations(module, stores, out_dir, vacuum=vacuum)
        counts = returned or counts
    return counts


def _build_one(
    module: str,
    stores: Stores,
    out_dir: Path,
    path: Path,
    *,
    vacuum: bool,
) -> dict[str, int]:
    if path.exists():
        path.unlink()

    ensure_derived(stores, module)
    # 只建子集时（--only / 单个实体脚本）父表可能还没回读过，这里按父库文件补登记；
    # `ensure_parent_identities()` 要靠 out_dir 找父库。
    stores.out_dir = out_dir
    connection = connect(str(path))
    try:
        tables = create_module(connection, module)
        counts = load_module(connection, stores, module)
        # 关联表（实体的复数集合字段）留到第二遍再填：两端的模块未必都排在本模块之前，
        # 见 fill_module_associations() / finish_associations()。
        connection.commit()
        write_meta(
            connection,
            module=module,
            source_name=stores.source_name,
            digest=stores.digest,
            counts={name: counts.get(name, 0) for name in tables},
        )
    finally:
        connection.close()

    if vacuum:
        connection = connect(str(path))
        try:
            connection.execute("PRAGMA journal_mode = DELETE")
            connection.execute("VACUUM")
            connection.execute("ANALYZE")
            connection.commit()
        finally:
            connection.close()

    return {name: counts.get(name, 0) for name in tables}


def build_stores(
    workbook: Workbook,
    *,
    source_name: str,
    digest: str,
    out_dir: Path,
    source_path: str = "calendar.xlsx",
    vacuum: bool = True,
    only: list[str] | None = None,
) -> dict[str, dict[str, int]]:
    """逐个实体建库。返回 实体 -> (表名 -> 行数)。"""
    stores = Stores(
        workbook=workbook,
        source_name=source_name,
        digest=digest,
        source_path=source_path,
        out_dir=out_dir,
    )
    targets = only or STORE_ORDER

    for module in targets:
        started = time.time()
        counts = build_store(module, stores, out_dir, vacuum=vacuum)
        size = (out_dir / f"{module}.sqlite").stat().st_size
        total = sum(counts.values())
        print(
            f"  {module:<12} {len(counts)} 表 {total:>10,} 行 "
            f"{size / 1048576:>8.3f} MiB {time.time() - started:>5.1f}s"
        )

    # 第二遍：全部模块都建完，关联表的两端才都完整。
    for module, counts in finish_associations(
        stores, out_dir, modules=targets, vacuum=vacuum
    ).items():
        stores.per_module[module] = counts

    return stores.per_module
