"""由 `src/sql/<entity>.sql` 生成 `src/datasource/<entity>[.<table>].sqlite.ts`。

    python scripts/generate_datasource.py

`src/sql/*.sql` 是查询语句的唯一来源，本脚本把每个 `-- name:` 语句逐字抄进
TypeScript 常量，因此两者不会漂移 —— repository 只引用这些常量，不再手抄 SQL。

一个 `.sql` 里可以有多张紧密相关的表（如 `astronomy_year` 与 `astronomy_month`），
但每张表下都有同样 12 条语句名，抄进同一个 TS 模块就是重名导出（TS2451），
故按 `-- 表 <name>` 分节**一表一个文件**：

    src/sql/astronomy.sql -> src/datasource/astronomy.year.sqlite.ts   （表 astronomy_year）
                             src/datasource/astronomy.month.sqlite.ts  （表 astronomy_month）

单表模块的文件名不变，仍是 `src/datasource/<module>.sqlite.ts`（表名与模块名相同）。
文件名里的表名去掉模块前缀：`astronomy_year` -> `year`、`synodic_calendar_year` -> `calendar_year`。

每个文件导出一个按表命名的大驼峰类（`astronomy_month` -> `AstronomyMonthSqlite`），
构造参数是驱动接缝 `StatementRunner`，缺省用 `runnerOf("<module>")`；
数据库文件固定为 `src/sqlite/<module>.sqlite`，所以类名按表、而 `name` 仍是模块名。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQL_DIR = ROOT / "src" / "sql"
OUT_DIR = ROOT / "src" / "datasource"

SECTION = re.compile(r"^-- 表 (\w+)$")
NAME = re.compile(r"^-- name: (\w+)$")

#: 语句名 -> 一句中文说明
DESCRIPTIONS: dict[str, str] = {
    "count": "全表行数",
    "countBy": "按 Example 条件统计行数",
    "existsByIdentity": "主键是否存在",
    "existsBy": "按 Example 条件判断是否存在",
    "findAll": "按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）",
    "findAllByIdentities": "按主键集合查询（json_each）",
    "findByIdentity": "按主键查询",
    "findBy": "按 Example 分页查询",
    "findFirstBy": "按 Example 取首行",
    "findOne": "按 Example 取唯一行（LIMIT 2 用于探测多行）",
    "selectByIdentity": "按主键投影（:projection 由 repository 白名单校验后拼接）",
    "selectBy": "按 Example 投影（:projection 由 repository 白名单校验后拼接）",
}

#: 实体模块 -> 主表实体类型名；本表同时充当「本脚本负责哪些模块」的登记表
#: （person 与 event 共用 event.ts）
ENTITY_TYPES: dict[str, str] = {
    "temporal": "Temporal",
    "phenology": "Phenology",
    "phase": "Phase",
    "part": "Part",
    "week": "Week",
    "synodic": "SynodicMonth",
    "primary": "Primary",
    "encounter": "Encounter",
    "perform": "Perform",
    "epoch": "Epoch",
    "dynasty": "Dynasty",
    "era": "Era",
    "person": "Person",
    "event": "Event",
    "chronology": "Chronology",
    "astronomy": "AstronomyMonth",
    # 模块 climate 的三张表同属一个库：主表是气候表 `climate`（Climate），
    # 节气纪年的 `climate_year` / `climate_month` 是同一模块里的另外两张表
    "climate": "Climate",
    "gregory": "GregoryMonth",
    "jupiter": "JupiterMonth",
    "natural": "NaturalMonth",
    "tree": "TreeMonth",
    "tropical": "TropicalMonth",
    "astronomy.calendar": "AstronomyMonth",
    "gregory.calendar": "GregoryMonth",
    "jupiter.calendar": "JupiterMonth",
    "natural.calendar": "NaturalMonth",
    "tree.calendar": "TreeMonth",
    "tropical.calendar": "TropicalMonth",
}

#: 模块 -> 实体所在文件；默认与模块同名。模块 `climate` 的三张表
#: （`climate` 气候 + `climate_year` / `climate_month` 节气纪年）都由 `climate.ts` 声明，
#: 与 `person` / `event` 共用 `event.ts` 同一套写法。
ENTITY_FILES_OVERRIDE: dict[str, str] = {
    "person": "event.ts",
    "event": "event.ts",
    "climate": "climate.ts",
}

ENTITY_FILES: dict[str, str] = {
    module: ENTITY_FILES_OVERRIDE.get(module, f"{module.replace('_', '-')}.ts")
    for module in ENTITY_TYPES
}

#: 表 -> 实体类型名；未登记的表按表名转大驼峰（`astronomy_year` -> `AstronomyYear`）
TABLE_TYPES: dict[str, str] = {
    "synodic_calendar_year": "SynodicYear",
}


def split_statements(text: str) -> list[tuple[str, list[tuple[str, str]]]]:
    """按 `-- 表 <name>` 分节取出 `-- name: xxx` 标记的语句，保持源文件顺序。

    @param text `src/sql/<entity>.sql` 全文。
    @returns `[(表名, [(语句名, SQL), ...]), ...]`。
    """
    sections: list[tuple[str, list[tuple[str, str]]]] = []
    current: str | None = None
    buffer: list[str] = []

    def take() -> None:
        nonlocal current
        if current is not None and buffer and sections:
            sections[-1][1].append((current, "\n".join(buffer).strip().rstrip(";")))
        current = None
        buffer.clear()

    for line in text.splitlines():
        stripped = line.strip()
        matched = SECTION.match(stripped)
        if matched:
            take()
            sections.append((matched.group(1), []))
            continue
        matched = NAME.match(stripped)
        if matched:
            take()
            current = matched.group(1)
            continue
        if current is None or stripped.startswith("--"):
            continue
        buffer.append(line)
    take()
    return sections


def pascal(name: str) -> str:
    """`astronomy_month` -> `AstronomyMonth`。

    点也是分隔符：模块名带点时（`astronomy.calendar`）要按段转大驼峰，
    `Astronomy.Calendar` 不是合法标识符。
    """
    text = name.replace(".", "_")
    return "".join(part.capitalize() for part in text.split("_"))


def stem_of(module: str, table: str) -> str:
    """表 -> 数据访问层文件名主干。一张表一个文件，名字必须唯一。

    规则（模块名里的点在下划线意义上参与前缀比较）：

    - 表名去掉"模块名前缀"后仍有余下部分：`<模块主干>.<余下>`，
      例如 `synodic` + `synodic_month` -> `synodic.month`、
      `astronomy.calendar` + `astronomy_year` -> `astronomy.year`。
    - 表名等于模块主干，或表名就是模块最后一段：直接用模块主干，
      例如 `temporal` -> `temporal`、`climate` + `climate` -> `climate`。
    - 模块名带点、且去掉前缀后还有余下部分时，余下部分用下划线连接
      （`x.table` + `x_weeks` -> `x.table_weeks`），
      避免出现 `x.table.weeks` 这种读不出层级的名字。
    """
    module_stem = module[: -len(".calendar")] if module.endswith(".calendar") else module
    if table == module_stem or table == module_stem.replace(".", "_"):
        return module_stem
    flat = module_stem.replace(".", "_")
    if table.startswith(f"{flat}_"):
        rest = table[len(flat) + 1 :]
        # 模块名带点时，余下部分用下划线连接，避免出现 `climate.table.weeks` 这种歧义
        return f"{module_stem}_{rest}" if "." in module_stem else f"{module_stem}.{rest}"
    prefix = f"{module_stem}_"
    if table.startswith(prefix):
        return f"{module_stem}.{table[len(prefix):]}"
    return f"{module_stem}.{table}"


def type_of(table: str) -> str:
    """表对应的实体类型名。"""
    return TABLE_TYPES.get(table, pascal(table))


def render(module: str, table: str, tables: list[str], statements: list[tuple[str, str]]) -> str:
    """渲染一个表的 `.sqlite.ts` 文件。

    @param module 实体模块名（数据库文件名、`runnerOf` / `injectRunner` 的键）。
    @param table 本文件镜像的表。
    @param tables 本模块的全部表，用于在表头指出同模块的其它文件。
    @param statements 本表的语句。
    """
    stem = stem_of(module, table)
    entity_file = ENTITY_FILES[module]
    entity_type = type_of(table)
    # 类名按"文件名主干"转大驼峰，与 repository 的 import 对齐：
    # astronomy.year -> AstronomyYearSqlite、climate.month -> ClimateMonthSqlite。
    class_name = f"{pascal(stem)}Sqlite"
    others = [other for other in tables if other != table]

    lines = [
        "/**",
        f" * Sqlite 数据访问层：{stem}",
        f" * 数据源：src/sqlite/{module}.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）",
        f" * 实体：src/entity/{entity_file}（{entity_type}）",
        f" * 表：{table}",
        f" * 语句镜像：src/sql/{module}.sql —— SQL 文本逐字复制，语句名一一对应。",
        f" * 建表语句：database/sql/{module}/table.sql；数据初始化：database/sql/{module}/data.sql。",
        " *",
        " * 本层只提供「语句文本 + 驱动」，不做实体映射（见 "
        f"src/repository/{module}.repository.ts）。",
    ]
    for other in others:
        lines.append(
            f" * 一表一个文件：表 {other} 见 src/datasource/{stem_of(module, other)}.sqlite.ts"
        )
    if others:
        lines.append(" * （12 条语句在每张表下同名，同处一个文件即重名导出，故按表拆分。）")
    lines.extend(
        [
            " * 由 scripts/generate_datasource.py 生成，请勿手改。",
            " */",
            'import type { Sqlite, StatementRunner } from "./sqlite";',
            'import { AbstractSqlite, runnerOf } from "./sqlite";',
            "",
        ]
    )
    for name, sql in statements:
        description = DESCRIPTIONS.get(name, name)
        lines.append(f"/** 语句 {name}：{description}。 */")
        lines.append(f"export const {name}: string = `{sql};`;")
        lines.append("")

    lines.extend(
        [
            "/**",
            f" * {stem} 的数据访问对象。",
            f" * 数据源：src/sqlite/{module}.sqlite（表 {table}）。",
            " */",
            f"export class {class_name} extends AbstractSqlite implements Sqlite {{",
            "",
            "    /**",
            "     * 构造。",
            f'     * @param runner 驱动接缝；缺省用 runnerOf("{module}")，'
            "由 injectRunner 注入后即可工作。",
            "     */",
            f'    public constructor(runner: StatementRunner = runnerOf("{module}")) {{',
            f'        super("{module}", ["{table}"], runner);',
            "    }",
            "}",
            "",
        ]
    )
    return "\n".join(lines)


def tables_of(module: str) -> list[str]:
    """从 `database/schema.py` 读出本模块的表名，保持声明顺序（用于与 SQL 分节互校）。"""
    from database.schema import by_module

    return [table.name for table in by_module(module)]


def stale_files(produced: set[Path]) -> list[Path]:
    """本目录下不再由本脚本生成、且模块已登记的旧文件（如拆分前的 `<module>.sqlite.ts`）。"""
    stale: list[Path] = []
    for path in sorted(OUT_DIR.glob("*.sqlite.ts")):
        if path in produced or path.stem.split(".")[0] not in ENTITY_TYPES:
            continue
        stale.append(path)
    return stale


def main() -> int:
    sys.path.insert(0, str(ROOT))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    produced: set[Path] = set()
    written = 0
    for path in sorted(SQL_DIR.glob("*.sql")):
        module = path.stem
        if module not in ENTITY_TYPES:
            print(f"  跳过未登记的实体：{module}")
            continue
        sections = split_statements(path.read_text(encoding="utf-8"))
        if not sections:
            print(f"  跳过无语句的文件：{path.name}")
            continue
        tables = [table for table, _ in sections]
        declared = tables_of(module)
        if tables != declared:
            print(f"  ⚠ {module}：SQL 分节 {tables} 与 database/schema.py 的 {declared} 不一致")
        for table, statements in sections:
            stem = stem_of(module, table)
            target = OUT_DIR / f"{stem}.sqlite.ts"
            if target in produced:
                raise SystemExit(f"两份表生成了同一个文件：{target.name}")
            # newline="\n"：Windows 上 write_text 默认把 \n 翻成 \r\n，
            # 与 .editorconfig / .prettierrc 的 LF 约定冲突（lint 会报满屏 "Delete ␍"）。
            target.write_text(
                render(module, table, tables, statements), encoding="utf-8", newline="\n"
            )
            produced.add(target)
            written += 1
            print(f"  {module:<12} {table:<24} {len(statements):>2} 条语句 -> src/datasource/{target.name}")
    print(f"共生成 {written} 个文件")
    for path in stale_files(produced):
        print(f"  ⚠ 已不再生成，可删除：src/datasource/{path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
