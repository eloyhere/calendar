"""按关联表仓库真正执行的 SQL，验证关联查询结果。

`src/repository/<模块>/<表>.association.ts` 里每个方法用的语句都来自
`src/datasource/<表>.sqlite.ts`（即 `src/sql/<模块>.sql`），本脚本用同一批语句、
同一套参数，在真实分库上跑一遍，核对结果。

    python scripts/verify_association_queries.py
"""

from __future__ import annotations

import importlib.util
import re
import sqlite3
import sys
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from database.association import associations_of  # noqa: E402
from database.store import STORE_ORDER  # noqa: E402

SQL_DIR = ROOT / "src" / "sql"
DB_DIR = ROOT / "src" / "sqlite"
NAME = re.compile(r"^-- name: (\w+)$")
TABLE = re.compile(r"^-- 表 (\w+)$")


def load_helper(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


stem_of = load_helper("_gd", ROOT / "scripts" / "generate_datasource.py").stem_of


def statements(module: str) -> dict[str, dict[str, str]]:
    """`src/sql/<模块>.sql` -> `{表名: {语句名: SQL}}`。"""
    path = SQL_DIR / f"{module}.sql"
    by_table: dict[str, dict[str, str]] = {}
    table: str | None = None
    current: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if table and current and buffer:
            by_table.setdefault(table, {})[current] = "\n".join(buffer).strip().rstrip(";")

    for line in path.read_text(encoding="utf-8").splitlines():
        hit_table = TABLE.match(line.strip())
        if hit_table:
            flush()
            table = hit_table.group(1)
            current, buffer = None, []
            by_table.setdefault(table, {})
            continue
        hit_name = NAME.match(line.strip())
        if hit_name:
            flush()
            current, buffer = hit_name.group(1), []
            continue
        if current is None or line.strip().startswith("--"):
            continue
        buffer.append(line)
    flush()
    return by_table


def bind(sql: str, **extra: object) -> dict[str, object]:
    parameters: dict[str, object] = {name: None for name in re.findall(r"(?<!:):(\w+)", sql)}
    parameters.update(extra)
    return parameters


def main() -> int:
    problems: list[str] = []
    checked = 0
    print("按关联表仓库的语句逐条核验")
    for module in STORE_ORDER:
        associations = associations_of(module)
        if not associations:
            continue
        path = DB_DIR / f"{module}.sqlite"
        if not path.exists():
            continue
        connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        by_table = statements(module)
        for association in associations:
            table = association.table.name
            sql = by_table.get(table, {})
            if not sql:
                problems.append(f"{table}：{module}.sql 里找不到该表的语句")
                continue
            parent, target = association.parent_field, association.target_field
            # 条件参数按各表实际列名置空：SQL 写成 `:col IS NULL OR ...`，全 NULL 即不加条件
            blanks = {
                column.name: None
                for column in association.table.columns
            }

            # count / findAll / selectBy：条件全空即不加条件
            total = connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            got = connection.execute(sql["count"], bind(sql["count"])).fetchone()[0]
            checked += 1
            if int(got) != int(total):
                problems.append(f"{table}.count：{got} != {total}")

            rows = connection.execute(
                sql["findAll"],
                bind(sql["findAll"], **blanks, sortColumn="identity", limit=3, offset=0),
            ).fetchall()
            checked += 1
            if len(rows) != min(3, int(total)):
                problems.append(f"{table}.findAll 首页 {len(rows)} 行，应为 {min(3, int(total))}")

            # findTargetsBy：取该表第一行的父值，应能查回 1..n 个目标
            first = connection.execute(
                f'SELECT "{parent}", "{target}" FROM "{table}" ORDER BY "identity" LIMIT 1'
            ).fetchone()
            if first is None:
                continue
            parent_value, target_value = first
            # findTargetsBy / findParentsBy：`:projection` 是列名，不能当绑定参数，
            # 仓库层是"过完列白名单后做受控字符串替换"，这里照做。
            found = connection.execute(
                sql["selectBy"].replace(":projection", f'"{target}"'),
                bind(
                    sql["selectBy"],
                    **{**blanks, parent: parent_value},
                    sortColumn="identity",
                    limit=-1,
                    offset=0,
                ),
            ).fetchall()
            checked += 1
            if not found:
                problems.append(f"{table}.findTargetsBy({parent_value}) 返回空")
            elif target_value not in {row[0] for row in found}:
                problems.append(f"{table}.findTargetsBy({parent_value}) 未包含已知目标 {target_value}")

            back = connection.execute(
                sql["selectBy"].replace(":projection", f'"{parent}"'),
                bind(
                    sql["selectBy"],
                    **{**blanks, target: target_value},
                    sortColumn="identity",
                    limit=-1,
                    offset=0,
                ),
            ).fetchall()
            checked += 1
            if parent_value not in {row[0] for row in back}:
                problems.append(f"{table}.findParentsBy({target_value}) 未包含已知父 {parent_value}")

        connection.close()
        print(f"  {module:20} {len(associations):>2} 张关联表已核验")

    print(f"\n共执行 {checked} 条查询")
    if problems:
        print(f"发现 {len(problems)} 个问题：")
        for problem in problems[:20]:
            print(f"  ! {problem}")
        return 1
    print("关联表查询全部返回预期结果")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
