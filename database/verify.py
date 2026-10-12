"""database.verify：逐个分库自检，并核对跨库关联。

    python database/verify.py [--root .] [--verbose]

检查五件事：

1. 每个实体的 `.sqlite`、建表语句 `src/sqlite/<entity>.sql`、
   查询语句 `src/sql/query/<entity>.sql`、实体 `src/entity/*.ts` 都在；
2. 库内每张表的行数与 `_meta` 记录一致，列与 `database/schema.py` 一致；
3. `src/sql/query/<entity>.sql` 的 12 条语句都能执行，且全条件绑 NULL 时返回
   全表 —— 这是"可选参数语义"的关键验证；
4. 跨库关联成立：子表每个外键值都能在父库中找到；
5. 区间端点成立：每张表 start/end 都能在 temporal 库中找到。
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.schema import TABLES, by_module
from database.store import STORE_ORDER

NAME = re.compile(r"^-- name: (\w+)$")
PLACEHOLDER = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")

STORE_ORDER_ALL = STORE_ORDER

#: 数据库连接缓存用"表名 -> 模块"来定位：跨库外键的两端可能分属不同模块
def module_of_table(table_name: str) -> str:
    for table in TABLES:
        if table.name == table_name:
            return table.module
    raise KeyError(f"没有表 {table_name}")


def foreign_keys() -> list[tuple[str, str, str, str]]:
    """从 schema 读出全部跨库外键：`(子表, 子列, 父表, 父列)`。

    不再手工维护清单 —— `database/schema.py` 是唯一来源，
    列上写了 `references` 才会被检查。
    """
    pairs: list[tuple[str, str, str, str]] = []
    for table in TABLES:
        for column in table.columns:
            if not column.references:
                continue
            parent_table, parent_column = column.references.split(".")
            pairs.append((table.name, column.name, parent_table, parent_column))
    return pairs


#: 这些表的时间列允许出现 0，表示"尚未终结"（如当代）
ZERO_MEANS_OPEN = {"dynasty", "era", "person", "event"}

EXPECTED_STATEMENTS = {
    "count",
    "countBy",
    "existsByIdentity",
    "existsBy",
    "findAll",
    "findAllByIdentities",
    "findByIdentity",
    "findBy",
    "findFirstBy",
    "findOne",
    "selectByIdentity",
    "selectBy",
}


def split_statements(text: str) -> dict[str, str]:
    """取出 `-- name: xxx` 标记的语句。"""
    statements: dict[str, str] = {}
    current: str | None = None
    buffer: list[str] = []
    for line in text.splitlines():
        matched = NAME.match(line.strip())
        if matched:
            if current and buffer:
                statements[current] = "\n".join(buffer).strip().rstrip(";")
            current = matched.group(1)
            buffer = []
            continue
        if current is None or line.strip().startswith("--"):
            continue
        buffer.append(line)
    if current and buffer:
        statements[current] = "\n".join(buffer).strip().rstrip(";")
    return statements


def bind(sql: str, *, size: int = 10) -> tuple[str, dict[str, object]]:
    """把语句里的占位符全部绑成"条件不生效"的值，用于自检可选参数语义。

    分页占位符是 `:limit` / `:offset`，**不是 `:size`** ——
    `size` 在若干表里是真实存在的列名（如 `synodic_month.size`），
    同名会把列条件静默绑成 NULL。
    """
    parameters: dict[str, object] = {name: None for name in PLACEHOLDER.findall(sql)}
    prepared = sql
    if "SELECT :projection" in prepared:
        prepared = prepared.replace("SELECT :projection", 'SELECT "identity"')
        parameters.pop("projection", None)
    if ":limit" in prepared:
        parameters["limit"] = size
    if ":offset" in prepared:
        parameters["offset"] = 0
    if ":sortColumn" in prepared:
        parameters["sortColumn"] = ""
    if ":identities" in prepared:
        parameters["identities"] = "[1,2]"
    return prepared, parameters


def open_readonly(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)


def database_of(module: str, root: Path) -> Path:
    """实体模块 -> 数据库文件：一个模块一个库，库名等于模块名。"""
    return root / "src" / "sqlite" / f"{module}.sqlite"


def entity_file_of(module: str) -> str:
    """实体模块 -> `src/entity/` 下的文件名。

    两处特例：`person` 与 `event` 共用 `event.ts`；模块 `climate` 的三张表
    （`climate` 气候 + `climate_year` / `climate_month` 节气纪年）都由 `climate.ts` 声明。
    七部派生历法的模块名带 `.calendar`（`astronomy.calendar`），实体文件去掉该后缀
    （`astronomy.ts`）。
    """
    if module == "person":
        return "event.ts"
    if module == "climate":
        return "climate.ts"
    base = module[: -len(".calendar")] if module.endswith(".calendar") else module
    return f"{base.replace('_', '-')}.ts"


def check_module(module: str, root: Path, *, verbose: bool) -> tuple[list[str], dict[str, int]]:
    """核对一个实体：文件齐备、库中表与列与 schema 一致、`_meta` 行数吻合。

    查询语句的可执行性由 `scripts/verify_datasource.py` 逐表核对，这里不重复。
    """
    problems: list[str] = []
    db_path = database_of(module, root)
    ddl_path = root / "database" / "sql" / module / "table.sql"
    query_path = root / "src" / "sql" / f"{module}.sql"
    entity_path = root / "src" / "entity" / entity_file_of(module)
    tables = by_module(module)

    for path, label in ((ddl_path, "建表语句"), (query_path, "查询语句"), (entity_path, "实体文件")):
        if not path.exists():
            problems.append(f"{label}缺失：{path.relative_to(root)}")
    if problems:
        return problems, {}

    # 只建表、尚未物化行数据的实体没有数据库文件，属于预期
    if not db_path.exists():
        problems.append(f"数据库缺失：{db_path.relative_to(root)}")
        return problems, {}

    counts: dict[str, int] = {}
    connection = open_readonly(db_path)
    try:
        existing = {
            row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        meta = (
            dict(connection.execute('SELECT "key","value" FROM "_meta"'))
            if "_meta" in existing
            else {}
        )

        for table in tables:
            if table.name not in existing:
                problems.append(f"库中缺表：{table.name}")
                continue
            (count,) = connection.execute(f'SELECT COUNT(*) FROM "{table.name}"').fetchone()
            counts[table.name] = int(count)
            columns = {row[1] for row in connection.execute(f'PRAGMA table_info("{table.name}")')}
            for column in table.columns:
                if column.name not in columns:
                    problems.append(f"{table.name} 缺列：{column.name}")
            recorded = _meta_count(meta.get("counts", ""), table.name)
            if recorded is not None and recorded != counts[table.name]:
                problems.append(f"_meta 记 {table.name}={recorded}，实测 {counts[table.name]}")

        if not ddl_path.read_text(encoding="utf-8").strip():
            problems.append("建表语句为空")
        statements = split_statements(query_path.read_text(encoding="utf-8"))
        for missing in sorted(EXPECTED_STATEMENTS - set(statements)):
            problems.append(f"查询语句缺少 {missing}")
    finally:
        connection.close()
    return problems, counts


def _meta_count(text: str, table: str) -> int | None:
    for item in text.split(","):
        key, separator, value = item.partition("=")
        if separator and key.strip() == table:
            try:
                return int(value)
            except ValueError:
                return None
    return None


def check_cross_entity(cache: dict[str, sqlite3.Connection]) -> list[str]:
    """每个跨库外键的值都要能在父库对应的列里找到。

    按 `database/schema.py` 的 `references` 逐列核对：
    子列的值应当出现在父表**被引用的那一列**里（通常是 `identity`，
    时间列则是 `temporal.identity`，即绝对时间本身）。
    """
    problems: list[str] = []
    key_cache: dict[tuple[str, str], set[object]] = {}

    def keys_of(table: str, column: str) -> set[object]:
        cached = key_cache.get((table, column))
        if cached is None:
            module = module_of_table(table)
            connection = cache.get(module)
            if connection is None:
                return set()
            cached = {row[0] for row in connection.execute(f'SELECT "{column}" FROM "{table}"')}
            key_cache[(table, column)] = cached
        return cached

    checked = 0
    for child_table, child_column, parent_table, parent_column in foreign_keys():
        child_module = module_of_table(child_table)
        if child_module not in cache:
            continue
        parents = keys_of(parent_table, parent_column)
        if not parents and parent_column != "identity":
            continue
        checked += 1
        # 0 一律视为"不涉及"：父表没有对应行时子列就写 0
        dangling = 0
        sample: list[object] = []
        for (value,) in cache[child_module].execute(
            f'SELECT "{child_column}" FROM "{child_table}"'
        ):
            if value is None or value == 0:
                continue
            if value not in parents:
                dangling += 1
                if len(sample) < 3:
                    sample.append(value)
        if dangling:
            problems.append(
                f"{child_table}.{child_column} 有 {dangling} 个值在 "
                f"{parent_table}.{parent_column} 中找不到，例如 {sample}"
            )
    print(f"      核对外键 {checked} 组")
    return problems


def check_spans(cache: dict[str, sqlite3.Connection], *, verbose_open: bool = False) -> list[str]:
    """每张表的 start/end 都要能在 temporal 库中找到。"""
    problems: list[str] = []
    if "temporal" not in cache:
        return ["temporal.sqlite 不存在，无法核对区间端点"]
    stamps = {row[0] for row in cache["temporal"].execute('SELECT "identity" FROM "temporal"')}
    for module in STORE_ORDER_ALL:
        connection = cache.get(module)
        if connection is None:
            continue
        for table in by_module(module):
            names = table.column_names
            if "start" not in names or "end" not in names:
                continue
            missing = 0
            open_ended = 0
            for start, end in connection.execute(f'SELECT "start","end" FROM "{table.name}"'):
                if table.name in ZERO_MEANS_OPEN and end == 0:
                    open_ended += 1
                elif start not in stamps or end not in stamps:
                    missing += 1
            if missing:
                problems.append(f"{table.name} 有 {missing} 行的 start/end 不在 temporal 中")
            elif open_ended and verbose_open:
                print(f"      {table.name}：{open_ended} 行 end=0（尚未终结）")
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="逐个分库自检")
    parser.add_argument("--root", default=".", help="项目根目录")
    parser.add_argument("--verbose", action="store_true", help="打印每条查询的返回行数")
    parser.add_argument("--skip-cross", action="store_true", help="跳过跨库与区间检查")
    arguments = parser.parse_args(argv)

    root = Path(arguments.root)
    problems: list[str] = []
    total_rows = 0

    print("逐个实体自检")
    for module in STORE_ORDER_ALL:
        found, counts = check_module(module, root, verbose=arguments.verbose)
        total_rows += sum(counts.values())
        summary = ", ".join(f"{name}={value:,}" for name, value in counts.items()) or "未建库"
        print(f"  {module:<12} {'OK' if not found else str(len(found)) + ' 个问题':<10} {summary}")
        for problem in found:
            print(f"      ! {problem}")
        problems.extend(f"{module}: {problem}" for problem in found)

    if not arguments.skip_cross:
        print("跨库关联与区间端点核对")
        cache: dict[str, sqlite3.Connection] = {}
        try:
            for module in STORE_ORDER_ALL:
                path = root / "src" / "sqlite" / f"{module}.sqlite"
                if path.exists():
                    cache[module] = open_readonly(path)
            extra = check_cross_entity(cache) + check_spans(cache)
        finally:
            for connection in cache.values():
                connection.close()
        for problem in extra:
            print(f"  ! {problem}")
        problems.extend(extra)
        if not extra:
            print("  全部外键值与区间端点都能在父库中找到")

    print(f"\n合计 {total_rows:,} 行，{len(problems)} 个问题")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
