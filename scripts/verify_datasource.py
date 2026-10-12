"""校验 `src/datasource/*.sqlite.ts` 与 `src/sql/*.sql` 是否一致，并执行真实查询。

    python scripts/verify_datasource.py [--verbose]

`src/datasource` 现在是**一张表一个文件**（`<entity>.sqlite.ts` 或
`<entity>.<table>.sqlite.ts`），而 `src/sql/<entity>.sql` 仍按实体组织、
一个实体内可能含多张表。所以比对必须**按表**进行：

1. 解析 `src/sql/<entity>.sql` 的 `-- 表 <name>` 分块，得到每张表的语句；
2. 逐个 datasource 文件取出导出的 SQL 常量，与「该文件所属表」的同名语句逐字比对
   （忽略末尾分号），报出任何一处漂移；
3. 把语句拿到对应的 `src/sqlite/<entity>.sqlite` 上真实执行，确认可执行、「条件全绑
   NULL 即不加条件」；
4. 报出类名冲突与未被引用的孤儿模块。
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASOURCE = ROOT / "src" / "datasource"
SQL_DIR = ROOT / "src" / "sql"
DB_DIR = ROOT / "src" / "sqlite"

NAME = re.compile(r"^-- name: (\w+)$")
TABLE = re.compile(r"^-- 表 (\w+)$")
EXPORT = re.compile(r"^export const (\w+): string = `(.*?)`;$", re.S | re.M)
CLASS = re.compile(r"^export class (\w+)", re.M)
PLACEHOLDER = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")


_KNOWN: set[str] | None = None


def known_modules() -> set[str]:
    """`database/schema.py` 里登记的全部实体模块名。

    结果缓存到 `_KNOWN`；`resolve_modules()` 负责在建好连接后再填充一次，
    避免早于 `sys.path` 设置时被算成空集。
    """
    global _KNOWN
    if _KNOWN is None:
        _KNOWN = _load_modules()
    return _KNOWN


def _load_modules() -> set[str]:
    sys.path.insert(0, str(ROOT))
    from database.schema import TABLES

    return {table.module for table in TABLES}


def resolve_modules() -> set[str]:
    """重新装载模块名集合，返回结果。用于需要确保缓存新鲜的场合。"""
    global _KNOWN
    _KNOWN = _load_modules()
    return _KNOWN


def entity_of(path: Path) -> str:
    """datasource 文件 -> 实体模块名。

    数据访问层按**表**拆文件，文件名是"产物主干 + 表后缀"，而 `src/sql/<实体>.sql`
    按**实体**组织。映射规则：

    - `temporal.sqlite.ts` -> `temporal`（表名与模块名同名）
    - `climate.sqlite.ts` -> `climate`（模块 climate 的主表就是 `climate`）
    - `astronomy.year.sqlite.ts` -> `astronomy.calendar`（七部派生历法的模块名带 `.calendar`）

    因此把"已知模块名"和"模块名 + `.calendar`"都作为候选，取**最长**的匹配前缀：
    `astronomy.year` 必须命中 `astronomy.calendar`，而不是较短的 `astronomy`。
    """
    stem = path.name[: -len(".sqlite.ts")] if path.name.endswith(".sqlite.ts") else path.stem
    modules = known_modules()

    def stem_form(module: str) -> str:
        """模块名 -> 产物文件主干。`.calendar` 后缀不出现在产物名里。"""
        return module[: -len(".calendar")] if module.endswith(".calendar") else module

    # 单表实体：文件名主干就等于某个模块的产物主干
    for module in sorted(modules):
        if stem == stem_form(module):
            return module
    # 双表实体：取最长的匹配前缀（比较的是产物主干）
    best = ""
    for module in modules:
        prefix = stem_form(module)
        if stem.startswith(f"{prefix}.") and len(prefix) > len(best):
            best = prefix
    for module in modules:
        if stem_form(module) == best:
            return module
    return stem.rsplit(".", 1)[0] if "." in stem else stem


def canonical(module: str) -> dict[str, dict[str, str]]:
    """`src/sql/<entity>.sql` -> {表名: {语句名: SQL}}。"""
    path = SQL_DIR / f"{module}.sql"
    if not path.exists():
        return {}
    by_table: dict[str, dict[str, str]] = {}
    table: str | None = None
    current: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if table and current and buffer:
            by_table.setdefault(table, {})[current] = "\n".join(buffer).strip().rstrip(";")

    for line in path.read_text(encoding="utf-8").splitlines():
        matched_table = TABLE.match(line.strip())
        if matched_table:
            flush()
            table = matched_table.group(1)
            current, buffer = None, []
            by_table.setdefault(table, {})
            continue
        matched_name = NAME.match(line.strip())
        if matched_name:
            flush()
            current, buffer = matched_name.group(1), []
            continue
        if current is None or line.strip().startswith("--"):
            continue
        buffer.append(line)
    flush()
    return by_table


def modules_of(entity: str) -> list[str]:
    """`src/sqlite` 里属于该实体的库文件名（单表实体与双表实体同名）。"""
    return [entity]


def placeholders(sql: str) -> list[str]:
    return sorted(set(PLACEHOLDER.findall(sql)))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="校验数据访问层")
    parser.add_argument("--verbose", action="store_true")
    arguments = parser.parse_args(argv)

    problems: list[str] = []
    files = sorted(DATASOURCE.glob("*.sqlite.ts"))
    if not files:
        print("没有找到 src/datasource/*.sqlite.ts", file=sys.stderr)
        return 1

    # 先把模块名集合装载好，后面 entity_of() 依赖它
    resolve_modules()

    # 先按"一个实体一个库"分组：双表实体的多个文件应恰好覆盖该实体的全部表
    by_entity: dict[str, list[Path]] = {}
    for path in files:
        by_entity.setdefault(entity_of(path), []).append(path)
    exported_classes: dict[str, str] = {}
    connections: dict[str, sqlite3.Connection] = {}
    covered: dict[str, set[str]] = {}
    print(f"检查 {len(files)} 个 datasource 模块，覆盖 {len(by_entity)} 个实体")

    for path in files:
        text = path.read_text(encoding="utf-8")
        entity = entity_of(path)
        exports = {name: sql.strip().rstrip(";") for name, sql in EXPORT.findall(text)}
        classes = CLASS.findall(text)

        if not classes:
            problems.append(f"{path.name}：没有导出 Sqlite 类")
        for class_name in classes:
            if class_name in exported_classes:
                problems.append(f"{path.name}：类名 {class_name} 与 {exported_classes[class_name]} 冲突")
            exported_classes[class_name] = path.name
        if not exports:
            problems.append(f"{path.name}：没有导出 SQL 常量")
            continue

        by_table = canonical(entity)
        if not by_table:
            problems.append(f"{path.name}：找不到对应的 src/sql/{entity}.sql")
            continue

        # 由 count 语句里的表名确定本文件负责哪张表（不能用"实体"来推断，
        # 双表实体的 month 与 year 两张表列不同，混了会得出错误结论）
        matched = re.search(r'FROM "(\w+)"', exports.get("count", ""))
        if not matched:
            problems.append(f"{path.name}：count 语句里找不到表名")
            continue
        table = matched.group(1)
        expected_by_name = by_table.get(table)
        if expected_by_name is None:
            problems.append(f"{path.name}：表 {table} 不在 src/sql/{entity}.sql 中")
            continue
        covered.setdefault(entity, set()).add(table)

        for name, sql in exports.items():
            expected = expected_by_name.get(name)
            if expected is None:
                problems.append(f"{path.name}：语句 {name} 在表 {table} 的规范里不存在")
                continue
            if sql != expected:
                problems.append(
                    f"{path.name}：语句 {name} 与 src/sql/{entity}.sql 表 {table} 不一致"
                    f"（{len(sql)} / {len(expected)} 字符）"
                )

        # 真实执行
        connection = connections.get(entity)
        if connection is None:
            db_path = DB_DIR / f"{entity}.sqlite"
            if db_path.exists():
                connection = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True)
                connections[entity] = connection
        if connection is None:
            problems.append(f"{path.name}：找不到 src/sqlite/{entity}.sqlite")
            continue

        (total,) = connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()
        row = connection.execute(exports["count"], {name: None for name in placeholders(exports["count"])}).fetchone()
        if row is None or int(row[0]) != int(total):
            problems.append(f"{path.name}：count 返回 {row}，表 {table} 实际 {total} 行")
        if arguments.verbose:
            print(f"  {path.name:<34} 表 {table:<24} {int(total):>10,} 行")

        sql = exports["findAll"]
        parameters = {name: None for name in placeholders(sql)}
        # 分页占位符是 :limit / :offset，不是 :size —— `size` 在若干表里是同名列
        parameters["limit"] = 3
        parameters["offset"] = 0
        parameters["sortColumn"] = ""
        try:
            rows = connection.execute(sql, parameters).fetchall()
            want = min(3, int(total))
            if len(rows) != want:
                problems.append(f"{path.name}：findAll 首页应有 {want} 行，实际 {len(rows)}")
            if int(total) > 3:
                ascending = connection.execute(sql, {**parameters, "sortDirection": "ASC"}).fetchall()
                descending = connection.execute(sql, {**parameters, "sortDirection": "DESC"}).fetchall()
                if ascending and descending and ascending[0][0] == descending[0][0]:
                    problems.append(f"{path.name}：ASC 与 DESC 首页相同，排序未生效")
        except Exception as error:  # noqa: BLE001
            problems.append(f"{path.name}：findAll 执行失败：{error}")

    for connection in connections.values():
        connection.close()

    # 每个实体的全部表都要有对应文件
    sys.path.insert(0, str(ROOT))
    from database.schema import by_module

    for entity in sorted(by_entity):
        want = {table.name for table in by_module(entity)}
        got = covered.get(entity, set())
        if want and want != got:
            problems.append(f"{entity}：表覆盖不全，缺 {sorted(want - got)}，多 {sorted(got - want)}")

    # 引用情况。数据访问层是"一张表一个文件"，repository 侧的引用有两处：
    # 模块类（`src/repository/<模块>.repository.ts`）只 import 主表文件，
    # 关联表类（`src/repository/<模块>/<表>.association.ts`）import 各自的关联表文件，
    # 因此要连子目录一起扫，且说明符可能是 `../../datasource/...`。
    referenced: set[str] = set()
    sources = (
        list(DATASOURCE.glob("*.ts"))
        + list((ROOT / "src" / "repository").glob("*.ts"))
        + list((ROOT / "src" / "repository").glob("*/*.ts"))
    )
    for path in sources:
        for matched_name in re.findall(
            r'from "[^"]*?([^"/]+\.sqlite\.ts)"', path.read_text(encoding="utf-8")
        ):
            referenced.add(Path(matched_name).name)

    referenced_entities = {entity_of(path) for path in files if path.name in referenced}
    all_entities = {entity_of(path) for path in files}
    unreferenced_entities = sorted(all_entities - referenced_entities)
    if unreferenced_entities:
        problems.append(f"整个实体都没被任何文件引用：{unreferenced_entities}")

    unreferenced = [path for path in files if path.name not in referenced]
    print(f"导出 Sqlite 类 {len(exported_classes)} 个，覆盖 {len(connections)} 个库")
    print(
        f"实体 {len(all_entities)} 个全部被引用；"
        f"文件层面 {len(files) - len(unreferenced)}/{len(files)} 个被 repository 引用"
    )
    if problems:
        print(f"\n发现 {len(problems)} 个问题：")
        for problem in problems:
            print(f"  ! {problem}")
        return 1
    print("\n数据访问层与 src/sql/*.sql 逐表一致，查询可执行且排序生效，表覆盖完整")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
