"""database.sqlfiles：由 `database/schema.py` 生成各层的 SQL 文件。

    python database/sqlfiles.py            # 只生成建表与查询
    python database/sqlfiles.py --with-data # 连数据初始化一起生成

产物（目录即层次，一个实体一套，实体名同名）：

- `database/sql/<entity>/table.sql` —— 建表（DDL），与 `src/sqlite/<entity>.sqlite` 一一对应
- `database/sql/<entity>/data.sql`  —— 数据初始化（INSERT）
- `src/sql/<entity>.sql`            —— 数据查询（12 条标准查询）

`src/sqlite/` 只放数据库文件本体；文本一律落在 `database/sql/`（建表与初始化）与
`src/sql/`（查询），两侧文件名都与实体同名。
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path
from typing import Any, Callable, Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.core import iter_rows
from database.schema import TABLES, Table, by_module, emit_sqlite

#: 实体模块 -> 对应 `src/entity/` 里的实体文件
ENTITY_FILES: dict[str, str] = {
    "temporal": "temporal.ts",
    "phenology": "phenology.ts",
    "part": "part.ts",
    "week": "week.ts",
    "phase": "phase.ts",
    "synodic": "synodic.ts",
    "epoch": "epoch.ts",
    "perform": "perform.ts",
    "encounter": "encounter.ts",
    "primary": "primary.ts",
    "dynasty": "dynasty.ts",
    "era": "era.ts",
    "chronology": "chronology.ts",
    "person": "event.ts",
    "event": "event.ts",
    # 模块 climate 的三张表都由 climate.ts 声明：`Climate`（气候）+
    # `ClimateYear` / `ClimateMonth`（节气纪年）
    "climate": "climate.ts",
    "astronomy.calendar": "astronomy.ts",
    "gregory.calendar": "gregory.ts",
    "jupiter.calendar": "jupiter.ts",
    "natural.calendar": "natural.ts",
    "tree.calendar": "tree.ts",
    "tropical.calendar": "tropical.ts",
}

#: 建表与查询文件按时间顺序排列，便于人读
ORDER: list[str] = [
    "temporal",
    "phenology",
    "climate",
    "phase",
    "part",
    "week",
    "synodic",
    "primary",
    "encounter",
    "perform",
    "epoch",
    "dynasty",
    "era",
    "person",
    "event",
    "astronomy.calendar",
    "gregory.calendar",
    "jupiter.calendar",
    "natural.calendar",
    "tree.calendar",
    "tropical.calendar",
    # chronology 的八列年指向上面每一部历法的年表，故列在最后
    "chronology",
]


def _header(*lines: str) -> str:
    return "\n".join(f"-- {line}" if line else "--" for line in lines) + "\n\n"


def _query_file(module: str, tables: list[Table]) -> str:
    """一个实体的标准查询集合。"""
    main = tables[0]
    columns = main.column_names
    projection = ", ".join(f'"{name}"' for name in columns)
    text_columns = [column.name for column in main.columns if column.kind == "text"]
    number_columns = [column.name for column in main.columns if column.kind != "text"]

    parts: list[str] = [
        _header(
            f"src/sql/{module}.sql",
            f"实体：src/entity/{ENTITY_FILES.get(module, module + '.ts')}",
            f"表：{', '.join(table.name for table in tables)}",
            "",
            "语句名与 src/repository/repository.ts 的方法名一一对应。",
            "",
            "参数约定（可选参数语义）：",
            "  等值  :<column>        未给条件时绑 NULL，条件自动失效",
            "  区间  :<column>Start / :<column>End    半开区间 [start, end)，任一为 NULL 即失效",
            "  模糊  :<column>Like     仅文本列，未给时绑 NULL",
            "  排序  :sortColumn       取本表列名的白名单枚举，SQL 用 CASE 分派，不拼接外部输入",
            "  投影  :projection       由 repository 按 fields 白名单校验后拼接",
            "  分页  :limit / :offset   （不能叫 :size —— 表和列里都有 size，会撞名）",
        )
    ]

    for table in tables:
        name = table.name
        projection = ", ".join(f'"{column}"' for column in table.column_names)
        text_columns = [column.name for column in table.columns if column.kind == "text"]
        number_columns = [column.name for column in table.columns if column.kind != "text"]

        # 可选参数语义：条件未给时绑 NULL，整段条件恒真。
        # 等值与区间对所有列都生成（文本列也要能精确匹配，例如 kind='era_begin'）；
        # 模糊匹配只对文本列生成。
        equals = "\n    AND ".join(
            f'(:{column} IS NULL OR "{column}" = :{column})'
            for column in table.column_names
        ) or "1 = 1"
        ranges = "\n    AND ".join(
            f'(:{column}Start IS NULL OR :{column}End IS NULL '
            f'OR ("{column}" >= :{column}Start AND "{column}" < :{column}End))'
            for column in table.column_names
        ) or "1 = 1"
        like = "\n    AND ".join(
            f'(:{column}Like IS NULL OR "{column}" LIKE :{column}Like)' for column in text_columns
        ) or "1 = 1"
        where = "\n".join(
            [
                "WHERE 1 = 1",
                f"    AND ({equals})",
                f"    AND ({ranges})",
                f"    AND ({like})",
            ]
        )
        # 排序与投影无法用绑定参数，改为在 SQL 内按列名白名单分派。
        # 必须用"搜索式 CASE"（CASE WHEN 条件 THEN …）而不是简单 CASE
        # （CASE x WHEN v THEN …）：后者写成 `WHEN :sortColumn = 'year'` 会被解析成
        # `:sortColumn = (:sortColumn = 'year')`，永远不成立，排序全部落到 ELSE。
        # 方向同理：用一个 CASE 顶 DESC、另一个 CASE 顶 ASC，只有一边会命中。
        if len(number_columns) > 1:
            sortable = [column for column in number_columns if column != "identity"]
            searched = "\n".join(
                f"        WHEN :sortColumn = '{column}' THEN \"{column}\"" for column in sortable
            )
            order_by = (
                "-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。\n"
                "-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。\n"
                "ORDER BY\n"
                "    (CASE WHEN :sortDirection = 'DESC' THEN (CASE\n"
                f"{searched}\n"
                '        ELSE "identity" END) END) DESC NULLS LAST,\n'
                "    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE\n"
                f"{searched}\n"
                '        ELSE "identity" END) END) ASC NULLS LAST,\n'
                '    "identity" ASC'
            )
        else:
            order_by = 'ORDER BY "identity" ASC'

        parts.append(
            _header(f"表 {name}") + "\n".join(
                [
                    "-- name: count",
                    f'SELECT COUNT(*) AS count FROM "{name}";',
                    "",
                    "-- name: countBy",
                    "SELECT COUNT(*) AS count",
                    f'FROM "{name}"',
                    where + ";",
                    "",
                    "-- name: existsByIdentity",
                    f'SELECT EXISTS(SELECT 1 FROM "{name}" WHERE "identity" = :identity) AS exists_;',
                    "",
                    "-- name: existsBy",
                    "SELECT EXISTS(",
                    "    SELECT 1",
                    f'    FROM "{name}"',
                    "\n".join(f"    {line}" if index else line for index, line in enumerate(where.splitlines())),
                    ") AS exists_;",
                    "",
                    "-- name: findAll",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    where,
                    order_by,
                    "LIMIT :limit OFFSET :offset;",
                    "",
                    "-- name: findAllByIdentities",
                    "-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    'WHERE "identity" IN (SELECT value FROM json_each(:identities))',
                    'ORDER BY "identity" ASC;',
                    "",
                    "-- name: findByIdentity",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    'WHERE "identity" = :identity;',
                    "",
                    "-- name: findBy",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    where,
                    order_by,
                    "LIMIT :limit OFFSET :offset;",
                    "",
                    "-- name: findFirstBy",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    where,
                    order_by,
                    "LIMIT 1;",
                    "",
                    "-- name: findOne",
                    f"SELECT {projection}",
                    f'FROM "{name}"',
                    where,
                    'ORDER BY "identity" ASC',
                    "LIMIT 2;",
                    "",
                    "-- name: selectByIdentity",
                    "-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入",
                    "SELECT :projection",
                    f'FROM "{name}"',
                    'WHERE "identity" = :identity;',
                    "",
                    "-- name: selectBy",
                    "-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入",
                    "SELECT :projection",
                    f'FROM "{name}"',
                    where,
                    order_by,
                    "LIMIT :limit OFFSET :offset;",
                    "",
                ]
            )
        )

    return "\n".join(parts)


def generate(root: Path, *, data: bool = True) -> list[Path]:
    """生成全部 SQL 文件，返回写出的路径。

    产物分布（目录即层次，一个实体一套）：

    - `database/sql/<entity>/table.sql` —— 建表语句，与 `src/sqlite/<entity>.sqlite` 一一对应
    - `database/sql/<entity>/data.sql`  —— 数据初始化（INSERT），与 table.sql 配套
    - `src/sql/<entity>.sql`            —— 数据查询（12 条标准查询），供 repository 一一对应

    建表与初始化放 `database/`（可执行、属于数据侧），查询放 `src/sql/`。
    `src/sqlite/` 只放数据库文件本体，不放任何文本。
    """
    written: list[Path] = []
    base = root / "database" / "sql"
    query_dir = root / "src" / "sql"
    base.mkdir(parents=True, exist_ok=True)
    query_dir.mkdir(parents=True, exist_ok=True)

    for module in ORDER:
        tables = by_module(module)
        if not tables:
            continue
        entity_file = ENTITY_FILES.get(module, f"{module}.ts")
        module_dir = base / module
        module_dir.mkdir(parents=True, exist_ok=True)

        ddl_chunks = [
            _header(
                f"database/sql/{module}/table.sql",
                f"实体：src/entity/{entity_file}",
                f"表：{', '.join(table.name for table in tables)}",
                f"目标数据库：src/sqlite/{module}.sqlite",
                "---- 说明 ----",
                "每个实体一个 SQLite 文件，本文件是该文件里的全部表结构。",
                "执行：python database/sqlfiles.py --apply",
                "跨文件的关联只记录在 docs/design.md，SQLite 本身不施加跨库外键；",
                "需要跨表查询时用 database/combine.py 由这些分库合并出全库。",
                "由 database/schema.py 生成，请勿手改。",
            )
        ]
        for table in tables:
            ddl_chunks.append(emit_sqlite(table))
            ddl_chunks.append("")
        # newline="\n"：Windows 上 write_text 默认写 CRLF，与 .editorconfig 的 LF 约定冲突。
        (module_dir / "table.sql").write_text(
            "\n".join(ddl_chunks), encoding="utf-8", newline="\n"
        )
        written.append(module_dir / "table.sql")

        (query_dir / f"{module}.sql").write_text(
            _query_file(module, tables), encoding="utf-8", newline="\n"
        )
        written.append(query_dir / f"{module}.sql")

    return written


def identity_resolver(root: Path) -> Callable[[Table], Callable[[Sequence[Any]], Sequence[Any]]]:
    """`data.sql` 里的跨库外键也必须写成真实的 identity。

    建库时 `database/store.py` 的 `write_table()` 会把业务键换成父表的自增 identity；
    `data.sql` 若直接导出业务键（例如 `phenology.year` 写成纪年块首瞬间
    `-230457018027`，而库里是 1..23500 的 identity），就和 `src/sqlite/*.sqlite`
    对不上了。这里按 `database/identity.py` 的 `BUSINESS_KEY` 从**已建好的分库**
    回读同一份映射，复用 `store.remapper()` 做同样的换算；父库不在时保持原值。

    业务键就是 `identity` 的表（`temporal`）不建映射：换算前后相同，白白吃掉
    上千万条内存。
    """
    from database.identity import Identities
    from database.schema import TABLES
    from database.store import remapper

    identities = Identities()
    module_of = {table.name: table.module for table in TABLES}
    loaded: set[str] = set()

    class _Context:
        """`remapper()` 只用到 `identities`。"""

    context = _Context()
    context.identities = identities  # type: ignore[attr-defined]
    cache: dict[str, Callable[[Sequence[Any]], Sequence[Any]]] = {}

    def load(parent: str) -> None:
        if parent in loaded:
            return
        loaded.add(parent)
        key_name = identities.business_key_of(parent)
        if key_name == "identity":
            return
        module = module_of.get(parent)
        if module is None:
            return
        path = root / "src" / "sqlite" / f"{module}.sqlite"
        if not path.exists():
            return
        handle = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        try:
            rows = handle.execute(
                f'SELECT "{key_name}", "identity" FROM "{parent}"'
            ).fetchall()
        finally:
            handle.close()
        for key, identity in rows:
            identities.record(parent, key, int(identity))

    def of(table: Table) -> Callable[[Sequence[Any]], Sequence[Any]]:
        if table.name not in cache:
            for column in table.columns:
                if column.references:
                    load(column.references.split(".")[0])
            cache[table.name] = remapper(context, table)  # type: ignore[arg-type]
        return cache[table.name]

    return of


def write_data(root: Path, modules: list[str] | None = None) -> list[Path]:
    """把各实体的行数据写成 `database/sql/<entity>/data.sql`。

    工作簿与历史数据各只解析一次：`datafiles.pairs_of()` 缺省会自己解析源文件，
    逐模块调用就会把 37 MB 的 `calendar.xlsx` 重解析十几遍，这里显式传入共享的源。
    """
    from database import datafiles
    from database.history import load_history
    from database.source import read_workbook

    base = root / "database" / "sql"
    targets = modules or [name for name in datafiles.ORDER if name in ORDER]
    written: list[Path] = []
    resolve = identity_resolver(root)
    workbook = None
    history = None
    for module in targets:
        if module in datafiles.HISTORY_MODULES:
            if history is None:
                history = load_history()
            source = history
        else:
            if workbook is None:
                workbook = read_workbook(str(root / "calendar.xlsx"))
            source = workbook
        pairs = datafiles.pairs_of(module, source)
        if pairs is None:
            continue
        chunks = [
            _header(
                f"database/sql/{module}/data.sql",
                f"实体：{ENTITY_FILES.get(module, module + '.ts')}",
                f"表：{', '.join(table.name for table, _ in pairs)}",
                "数据初始化语句，配合同目录的 table.sql 使用。",
                "由 database/datafiles.py 从源数据生成，请勿手改。",
            )
        ]
        for table, rows in pairs:
            convert = resolve(table)
            chunks.append(f"-- 表 {table.name}")
            chunks.append(f"-- 列：{', '.join(table.column_names)}")
            chunks.append("")
            chunks.extend(
                iter_rows(
                    table,
                    (convert(row) for row in rows),
                    rows_per_statement=100,
                )
            )
            chunks.append("")
        path = base / module / "data.sql"
        path.write_text("\n".join(chunks), encoding="utf-8", newline="\n")
        written.append(path)
        print(f"  {module:<12} data.sql {path.stat().st_size / 1048576:>8.2f} MiB")
    return written


def main(argv: list[str] | None = None) -> int:
    arguments = list(argv if argv is not None else sys.argv[1:])
    with_data = "--with-data" in arguments
    arguments = [item for item in arguments if item != "--with-data"]
    root = Path(arguments[0]) if arguments else Path(__file__).resolve().parent.parent
    written = generate(root)
    if with_data:
        print("生成数据初始化语句：")
        written.extend(write_data(root))
    print(f"生成 {len(written)} 个 SQL 文件：")
    for path in written:
        print(f"  {path.relative_to(root)}  ({path.stat().st_size} 字节)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
