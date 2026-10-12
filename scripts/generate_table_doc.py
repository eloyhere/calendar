#!/usr/bin/env python
"""scripts/generate_table_doc.py：遍历 `src/sqlite/*.sqlite`，生成 `docs/table.md`。

数据来源按优先级：

1. **结构与行数只认数据库本身**——`PRAGMA table_info` / `index_list` / `index_info`
   与 `COUNT(*)`，即"库里实际是什么样"；
2. **中文说明与引用关系**取自 `database/schema.py`（`Table.comment` / `Table.note`、
   `Column.note` / `Column.references`）；
3. 两边对不上时以数据库为准，差异汇总到文末的「差异」一节，不静默采信任何一边。

用法：

    python scripts/generate_table_doc.py

重新建库（`python database/build.py ...`）之后重跑本脚本，`docs/table.md` 即与
`src/sqlite/` 同步；本文件不要手改。
"""

from __future__ import annotations

import re
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from database import schema  # noqa: E402  （必须在 sys.path 之后导入）

SQLITE_DIR = ROOT / "src" / "sqlite"
ENTITY_DIR = ROOT / "src" / "entity"
OUTPUT = ROOT / "docs" / "table.md"

# SQLite 引擎自带的表不进清单：sqlite_sequence 随 AUTOINCREMENT 出现，
# sqlite_stat1 随 ANALYZE 出现。_meta 是构建元数据，单独一节说明。
_ENGINE_TABLE = re.compile(r"^sqlite_")
_META = "_meta"

# 主键渲染成 "identity" INTEGER PRIMARY KEY AUTOINCREMENT，据此判断自增。
_AUTOINCREMENT = re.compile(r'"([^"]+)"\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT', re.IGNORECASE)


@dataclass
class IndexInfo:
    """一个显式索引（`CREATE INDEX`）。"""

    name: str
    columns: list[str]
    unique: bool


@dataclass
class ColumnInfo:
    """从库里读回来的一列。"""

    name: str
    type: str
    primary: bool
    auto: bool
    key: bool
    index: bool
    comment: str
    reference: str | None


@dataclass
class TableInfo:
    """从库里读回来的一张表。"""

    name: str
    comment: str
    note: str
    columns: list[ColumnInfo]
    indexes: list[IndexInfo]
    auto_indexes: list[str]
    rows: int


@dataclass
class DatabaseInfo:
    """一个分库。"""

    name: str
    module: str
    built_at: str
    tables: list[TableInfo]
    recorded: dict[str, int]
    has_meta: bool
    meta_keys: int

    @property
    def rows(self) -> int:
        return sum(table.rows for table in self.tables)


def connect(path: Path) -> sqlite3.Connection:
    """只读打开，避免生成文档时改动任何库（含 WAL 与 journal）。

    `timeout` 是 SQLite 的 busy timeout：`database/build.py` 可能正在重建同一个库，
    等它写完再读，而不是抛 `database is locked`。
    """
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=120)


def read_meta(connection: sqlite3.Connection) -> dict[str, str]:
    """读 `_meta`；老库没有这张表时返回空字典。"""
    try:
        rows = connection.execute(f'SELECT "key", "value" FROM "{_META}"').fetchall()
    except sqlite3.Error:
        return {}
    return {str(key): str(value) for key, value in rows}


def read_table_names(connection: sqlite3.Connection) -> list[str]:
    """实体表名，按 schema.py 的声明顺序；没声明的排在其后按名字排。"""
    names = [
        str(row[0])
        for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    ]
    names = [name for name in names if not _ENGINE_TABLE.match(name) and name != _META]
    order = {table.name: index for index, table in enumerate(schema.TABLES)}
    return sorted(names, key=lambda name: (order.get(name, len(order)), name))


def read_indexes(connection: sqlite3.Connection, table: str) -> tuple[list[IndexInfo], list[str]]:
    """返回 (显式索引, 主键自带的 sqlite_autoindex 名字)。"""
    explicit: list[IndexInfo] = []
    auto: list[str] = []
    for _seq, name, unique, origin, _partial in connection.execute(
        f'PRAGMA index_list("{table}")'
    ).fetchall():
        if str(name).startswith("sqlite_autoindex"):
            auto.append(str(name))
            continue
        columns = [
            str(row[2]) for row in connection.execute(f'PRAGMA index_info("{name}")').fetchall()
        ]
        explicit.append(IndexInfo(name=str(name), columns=columns, unique=bool(unique)))
    return explicit, auto


def read_table(connection: sqlite3.Connection, name: str, declared: schema.Table | None) -> TableInfo:
    """读一张表的列、索引与行数；说明文字来自 schema.py，取不到就留空。"""
    ddl_row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
    ).fetchone()
    ddl = str(ddl_row[0]) if ddl_row and ddl_row[0] else ""
    auto_columns = set(_AUTOINCREMENT.findall(ddl))
    indexes, auto_indexes = read_indexes(connection, name)

    columns: list[ColumnInfo] = []
    for row in connection.execute(f'PRAGMA table_info("{name}")').fetchall():
        column_name = str(row[1])
        primary = bool(row[5])
        in_index = any(column_name in index.columns for index in indexes)
        leading = any(index.columns and index.columns[0] == column_name for index in indexes)
        # 主键自带唯一索引，不再重复计进 key/index，统一记 NA。
        key = in_index and not primary
        index = leading and not primary
        note = ""
        reference = None
        if declared is not None and column_name in declared.column_names:
            column = declared.column(column_name)
            note = column.note
            reference = column.references
        columns.append(
            ColumnInfo(
                name=column_name,
                type=str(row[2] or "").lower(),
                primary=primary,
                auto=column_name in auto_columns,
                key=key,
                index=index,
                comment=note,
                reference=reference,
            )
        )

    rows = int(connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0])
    return TableInfo(
        name=name,
        comment=declared.comment if declared else "",
        note=declared.note if declared else "",
        columns=columns,
        indexes=indexes,
        auto_indexes=auto_indexes,
        rows=rows,
    )


def read_recorded(meta: dict[str, str]) -> dict[str, int]:
    """把 `_meta.counts` 的 `表=行数, 表=行数` 解析成字典。"""
    recorded: dict[str, int] = {}
    for item in meta.get("counts", "").split(","):
        name, _, value = item.strip().partition("=")
        if name and value.strip().lstrip("-").isdigit():
            recorded[name] = int(value)
    return recorded


def read_database(path: Path) -> DatabaseInfo:
    """把一个 `.sqlite` 读成结构描述。"""
    declared = {table.name: table for table in schema.TABLES}
    connection = connect(path)
    try:
        meta = read_meta(connection)
        tables = [
            read_table(connection, name, declared.get(name))
            for name in read_table_names(connection)
        ]
    finally:
        connection.close()
    return DatabaseInfo(
        name=path.name,
        module=meta.get("module", path.stem),
        built_at=meta.get("built_at", "—"),
        tables=tables,
        recorded=read_recorded(meta),
        has_meta=bool(meta),
        meta_keys=len(meta),
    )


def flag(value: bool) -> str:
    return "yes" if value else "no"


def markdown_row(cells: list[str], spaced: bool = False) -> str:
    """一行 markdown 表格。逐表清单沿用 `|a|b|` 的紧凑写法，总览用宽松写法。"""
    values = [cell.replace("|", "\\|") for cell in cells]
    if spaced:
        return "| " + " | ".join(values) + " |"
    return "|" + "|".join(values) + "|"


def render_table(table: TableInfo) -> list[str]:
    """一张表：`- 表名` + 7 列清单 + 表说明 / 索引 / 引用 / 备注。"""
    lines = [f"- {table.name}", ""]
    lines.append(markdown_row(["name", "type", "primary key", "auto increment", "key", "index", "comment"]))
    lines.append("|---|---|---|---|---|---|---|")
    for column in table.columns:
        lines.append(
            markdown_row(
                [
                    column.name,
                    column.type,
                    flag(column.primary),
                    flag(column.auto),
                    "NA" if column.primary else flag(column.key),
                    "NA" if column.primary else flag(column.index),
                    column.comment or "—",
                ]
            )
        )
    lines.append("")
    if table.comment:
        lines.append(f"表说明：{table.comment}")
    if table.indexes:
        listed = "、".join(
            f"`{index.name}`({', '.join(index.columns)})" for index in table.indexes
        )
        lines.append(f"索引：{listed}")
    elif table.auto_indexes:
        lines.append(f"索引：无显式索引；主键自带 `{table.auto_indexes[0]}`")
    else:
        lines.append("索引：无")
    references = [
        f"`{column.name}` → `{column.reference}`"
        for column in table.columns
        if column.reference
    ]
    if references:
        lines.append(
            "引用（SQLite 不施加外键约束，仅记录指向）：" + "；".join(references)
        )
    if table.note:
        lines.append(f"备注：{table.note}")
    lines.append("")
    return lines


def render_database(database: DatabaseInfo) -> list[str]:
    """一个分库一节。"""
    lines = [f"### {database.name}", ""]
    tables = "、".join(f"`{table.name}`" for table in database.tables)
    lines.append(
        f"模块 `{database.module}` · 建库 {database.built_at} · "
        f"{len(database.tables)} 张表 · {database.rows:,} 行"
    )
    lines.append("")
    if tables:
        lines.append(f"表：{tables}")
        lines.append("")
    for table in database.tables:
        lines.extend(render_table(table))
    return lines


def differences(databases: list[DatabaseInfo]) -> list[str]:
    """库与 `database/schema.py` 的差异；一致时返回空列表。

    差异分两种方向，修法不同，所以分开写：
    库里少东西 = 库是用旧声明建的，重建即可；库里多东西 = schema.py 落后，先补声明。
    """
    declared = {table.name: table for table in schema.TABLES}
    found: set[str] = set()
    problems: list[str] = []

    for database in databases:
        if not database.has_meta:
            problems.append(
                f"- `{database.name}`：库里没有 `_meta` → 建库没跑完，或这是旧版本的库"
            )
        for name in sorted(set(database.recorded) - {table.name for table in database.tables}):
            problems.append(
                f"- `{database.name}`：`_meta.counts` 记了 `{name}`，但库里没有这张表"
            )
        for table in database.tables:
            found.add(table.name)
            recorded = database.recorded.get(table.name)
            if recorded is not None and recorded != table.rows:
                problems.append(
                    f"- `{table.name}`（{database.name}）：实测 {table.rows:,} 行，"
                    f"`_meta` 记 {recorded:,} 行 → 该库正在重建或没写完"
                )
            source = declared.get(table.name)
            if source is None:
                problems.append(
                    f"- `{table.name}`（{database.name}）：库里有这张表，`schema.py` 没声明"
                    " → 补 `schema.py`"
                )
                continue

            in_db = [column.name for column in table.columns]
            in_schema = source.column_names
            missing = [name for name in in_schema if name not in in_db]
            extra = [name for name in in_db if name not in in_schema]
            if missing:
                problems.append(
                    f"- `{table.name}`（{database.name}）：库里少 "
                    f"{'、'.join(missing)}（`schema.py` 已声明）→ 重建该库"
                )
            if extra:
                problems.append(
                    f"- `{table.name}`（{database.name}）：库里多 "
                    f"{'、'.join(extra)}（`schema.py` 未声明）→ 补 `schema.py`"
                )
            if not missing and not extra and in_db != in_schema:
                problems.append(
                    f"- `{table.name}`（{database.name}）：列顺序不一致："
                    f"库 {'、'.join(in_db)}；schema.py {'、'.join(in_schema)}"
                )

            db_indexes = {index.name.removeprefix(f"idx_{table.name}_") for index in table.indexes}
            schema_indexes = {name for name, _columns in source.indexes}
            for name in sorted(schema_indexes - db_indexes):
                problems.append(
                    f"- `{table.name}`（{database.name}）：库里少索引 `idx_{table.name}_{name}`"
                    "（`schema.py` 已声明）→ 重建该库"
                )
            for name in sorted(db_indexes - schema_indexes):
                problems.append(
                    f"- `{table.name}`（{database.name}）：库里多索引 `idx_{table.name}_{name}`"
                    "（`schema.py` 未声明）→ 补 `schema.py`"
                )

            for column in table.columns:
                if column.name not in in_schema:
                    continue
                expected = source.column(column.name).sqlite_type().lower()
                if column.type and column.type != expected:
                    problems.append(
                        f"- `{table.name}.{column.name}`（{database.name}）：类型不一致："
                        f"库 {column.type}；schema.py {expected}"
                    )

    for name in declared:
        if name not in found:
            problems.append(f"- `{name}`（`schema.py` 已声明）在 `src/sqlite/` 里没有对应的表")

    return problems


# --------------------------------------------------------------------------- #
# entity 侧：复数命名的属性 = ManyToMany 关联表
# --------------------------------------------------------------------------- #

#: `src/entity/*.ts` 的接口名 -> 表名；表名一律以 `database/schema.py` 为准
ENTITY_TABLE_OF: dict[str, str] = {
    "Temporal": "temporal",
    "Phenology": "phenology",
    "Part": "part",
    "Week": "week",
    "Phase": "phase",
    "SynodicYear": "synodic_calendar_year",
    "SynodicMonth": "synodic_month",
    "Epoch": "epoch",
    "Perform": "perform",
    "Encounter": "encounter",
    "Primary": "primary",
    "Dynasty": "dynasty",
    "Era": "era",
    "Person": "person",
    "Event": "event",
    "Chronology": "chronology",
}

#: `Array<X>` 的 X -> 子表名
ELEMENT_TABLE_OF: dict[str, str] = {
    "Week": "week",
    "Part": "part",
    "Phenology": "phenology",
    "Era": "era",
    "Chronology": "chronology",
    "Perform": "perform",
    "Epoch": "epoch",
}

for _calendar, _title in (
    ("astronomy", "Astronomy"),
    ("climate", "Climate"),
    ("gregory", "Gregory"),
    ("jupiter", "Jupiter"),
    ("natural", "Natural"),
    ("tree", "Tree"),
    ("tropical", "Tropical"),
):
    ENTITY_TABLE_OF[f"{_title}Year"] = f"{_calendar}_year"
    ENTITY_TABLE_OF[f"{_title}Month"] = f"{_calendar}_month"
    ELEMENT_TABLE_OF[f"{_title}Month"] = f"{_calendar}_month"


@dataclass
class EntityRelation:
    """entity 里一个复数属性要求建出来的关联表。"""

    table: str
    parent: str
    property_name: str
    child: str
    source: str


def _entity_interfaces() -> list[tuple[str, str, str]]:
    """扫 `src/entity/*.ts`，返回 (来源文件, 接口名, 接口体)。"""
    found: list[tuple[str, str, str]] = []
    for path in sorted(ENTITY_DIR.glob("*.ts")):
        text = path.read_text(encoding="utf-8")
        for name, body in re.findall(r"export interface (\w+)[^{]*\{(.*?)\n\}", text, re.S):
            found.append((path.name, name, body))
    return found


def read_entity_relations() -> list[EntityRelation]:
    """凡属性名是复数的，都要有一张 `<父表>_<属性名>` 关联表。"""
    module_of = {table.name: table.module for table in schema.TABLES}
    relations: list[EntityRelation] = []
    for file, interface, body in _entity_interfaces():
        # climate.ts 里的 `Climate`（气候表）与 `ClimateYear` / `ClimateMonth`（节气纪年）
        # 同在一个文件，都按文件归到 `climate` 表 / 历法表上
        parent = ENTITY_TABLE_OF.get(interface) or ("climate" if interface == "Climate" else None)
        if parent is None:
            continue
        module = module_of.get(parent, "")
        for name, kind in re.findall(r"^\s*(\w+)\s*:\s*([^;]+);", body, re.M):
            element = re.fullmatch(r"Array<\s*(\w+)\s*>", kind.strip())
            if not element:
                continue
            child = f"{module.split('.')[0]}_month" if name == "months" else ELEMENT_TABLE_OF.get(element.group(1))
            if child is None:
                continue
            relations.append(
                EntityRelation(
                    table=f"{parent}_{name}",
                    parent=parent,
                    property_name=name,
                    child=child,
                    source=f"src/entity/{file}",
                )
            )
    return relations


#: entity 里出现过的复数属性名；表里出现同名列即为语义冲突
PLURAL_PROPERTIES: frozenset[str] = frozenset(
    relation.property_name for relation in read_entity_relations()
)


def entity_differences() -> list[str]:
    """entity 与表结构的差异，只看复数属性这条硬规则。

    标量字段暂不对账：`phenology.ts` / `part.ts` / `week.ts` 等实体还是空接口，
    逐列比会把"entity 没写完"和"表多写了列"混在一起，等实体补齐后再纳入。
    """
    problems: list[str] = []
    expected = {relation.table: relation for relation in read_entity_relations()}
    actual = {table.name: table for table in schema.TABLES if table.relation}

    for name in sorted(set(expected) - set(actual)):
        relation = expected[name]
        problems.append(
            f"- 关联表 `{name}`：`{relation.source}` 的复数属性 `{relation.property_name}` 要求"
            "它存在，`schema.py` 里没有 → 补声明"
        )
    for name in sorted(set(actual) - set(expected)):
        problems.append(
            f"- 关联表 `{name}`：`schema.py` 里有，`src/entity/` 里找不到对应的复数属性 → 核对"
        )

    plural_scalar: dict[str, list[str]] = {}
    for table in schema.TABLES:
        if table.relation:
            continue
        names = [column.name for column in table.columns if column.name in PLURAL_PROPERTIES]
        if names:
            plural_scalar[table.name] = names
    if plural_scalar:
        total = sum(len(names) for names in plural_scalar.values())
        detail = "；".join(
            f"`{table}`: {'、'.join(names)}" for table, names in sorted(plural_scalar.items())
        )
        problems.append(
            f"- {total} 个**复数命名的标量列**：entity 的同名属性是集合（已按 §3 建关联表），"
            f"这些列却存标量计数，语义冲突 → 改名（如 `countOfWeek`）或删除：{detail}"
        )
    return problems


def render(databases: list[DatabaseInfo]) -> str:
    total_tables = sum(len(database.tables) for database in databases)
    total_rows = sum(database.rows for database in databases)
    meta_keys = max((database.meta_keys for database in databases), default=0)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    problems = differences(databases)
    entity_problems = entity_differences()
    relations = [table for table in schema.TABLES if table.relation]
    relation_names = {table.name for table in relations}

    lines: list[str] = [
        "# calendar 表结构清单",
        "",
        f"`src/sqlite/` 下每个分库一张不落地列在这里：{len(databases)} 个库、"
        f"{total_tables} 张表、{total_rows:,} 行。",
        "",
        "本文件由 `scripts/generate_table_doc.py` 遍历项目生成，**不要手改**；"
        "结构或行数变了就重跑一次：",
        "",
        "```bash",
        "python scripts/generate_table_doc.py",
        "```",
        "",
        "数据来源按优先级：",
        "",
        "1. 结构、索引与行数只认数据库本身——`PRAGMA table_info` / `index_list` / `index_info`"
        " 与 `COUNT(*)`；",
        "2. 中文说明与引用关系取自 `database/schema.py`（`Table.comment`、`Table.note`、"
        "`Column.note`、`Column.references`）；",
        "3. 两边不一致时以库为准，差异全部记在文末「§6 差异」。",
        "",
        "表分两类：**实体表**（一张表对应一个 entity 接口）与**关联表**"
        "（entity 里复数命名的属性，见 §3）。",
        "",
        f"生成时间：{now}。",
        "",
        "## 1. 列的含义",
        "",
        "| 列 | 取值 | 含义 |",
        "| --- | --- | --- |",
        "| name | 列名 | 与 `database/schema.py`、`src/sql/*.sql` 里的列名逐字一致 |",
        "| type | integer / text | SQLite 亲和类型；`bigint` 与 `boolean` 落库都是 integer"
        "（64 位整数 / 0-1） |",
        "| primary key | yes / no | 是否主键。"
        f"{total_tables} 张实体表的主键一律叫 `identity`，只有 `_meta` 是 `key` |",
        "| auto increment | yes / no | 是否 `INTEGER PRIMARY KEY AUTOINCREMENT`："
        "插入时不绑定该列，由数据库生成，删号不复用 |",
        "| key | yes / no / NA | 该列是否出现在某个显式索引里（不限位置）；"
        "主键行记 NA——主键自带的唯一索引不重复计 |",
        "| index | yes / no / NA | 是否存在以该列为**首列**的显式索引（可直接用于前缀查找）；"
        "主键行同上记 NA |",
        "| comment | 中文说明 / — | 列说明，取自 `database/schema.py` 的 `Column.note`；"
        "schema.py 里没有的列记 — |",
        "",
        "### `lengthOf*` 的口径",
        "",
        "`lengthOfX` 一律是**本区间内含有多少个 X 单位，向 0 取整**——不是秒，"
        "也不是「X 单位本身的长度」：",
        "",
        "| 列 | X | 例 |",
        "| --- | --- | --- |",
        "| `lengthOfDay` | 天 | 朔望月 29.53 天 → 29；一周 → 7 |",
        "| `lengthOfWeek` | 周（7 天） | 5 天的相 / 气候 → 0；29.53 天的月 → 4 |",
        "| `lengthOfPart` | 旬（10 天） | 5 天的相 → 0；29.53 天的月 → 2 |",
        "| `lengthOfPhenology` | 候（5 天） | 一个候 → 1；29.53 天的月 → 5 |",
        "| `lengthOfMonth` | 月 | 一年 365.2422 天 → 12 |",
        "",
        "### 模块名里的点",
        "",
        "一个模块一个 `.sqlite`。七部派生历法的年 / 月表放在 `<历法>.calendar` 模块里，"
        "用点与同名表区分（例如 `astronomy.calendar` 的年月表不与别的表撞名）。"
        "`climate` 是唯一的例外——气候表 `climate` 与节气纪年的 `climate_year` / "
        "`climate_month` 同属模块 `climate`，共用一个 `climate.sqlite`。",
        "",
        "不进清单的表：`sqlite_sequence`（有 AUTOINCREMENT 就有）、`sqlite_stat1`"
        "（ANALYZE 产物）——两者都是 SQLite 引擎自带；`_meta` 是构建元数据，见 §5。",
        "",
        "## 2. 总览",
        "",
        "| 数据库 | 模块 | 实体表 | 关联表 | 行数 | 建库时间 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for database in databases:
        entities = "、".join(
            f"`{table.name}`" for table in database.tables if table.name not in relation_names
        )
        joined = "、".join(f"`{name}`" for name in sorted(relation_names & {t.name for t in database.tables}))
        lines.append(
            markdown_row(
                [
                    database.name,
                    f"`{database.module}`",
                    entities or "—",
                    joined or "—",
                    f"{database.rows:,}",
                    database.built_at,
                ],
                spaced=True,
            )
        )
    lines.append(
        markdown_row(
            [
                "**合计**",
                f"{len(databases)} 个库",
                f"{total_tables - len(relations)} 张",
                f"{len(relations)} 张",
                f"{total_rows:,}",
                "—",
            ],
            spaced=True,
        )
    )
    lines.append("")
    lines.extend(
        [
            "## 3. 关系表（entity 的复数属性 → ManyToMany）",
            "",
            "规则：`src/entity/*.ts` 里**属性名是复数的**（`months` / `phenologies` / `weeks` /"
            " `parts` / `eras` / `chronologies` / `performs` / `epoches`）表示集合，**不是父表的列**，"
            "而是一张独立的关联表 `<父表>_<属性名>`：`identity` 自增主键 + 父端列 + 子端列，"
            "两列各建索引，与父表同库。两端常常跨库，SQLite 不施加外键约束。",
            "",
            "| 关联表 | 库（模块） | 父端 | 子端 | entity 属性 |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for table in sorted(relations, key=lambda item: item.name):
        parent, parent_column, child, child_column = table.relation
        lines.append(
            markdown_row(
                [
                    f"`{table.name}`",
                    f"`{table.module}`",
                    f"`{parent_column}` → `{parent}.identity`",
                    f"`{child_column}` → `{child}.identity`",
                    f"`{table.name[len(parent) + 1:]}`",
                ],
                spaced=True,
            )
        )
    lines.append("")
    lines.extend(
        [
            "## 4. 逐表列清单",
            "",
            "每张表先给 `- 表名`，再给逐列清单。`key` / `index` 两列只统计"
            " `CREATE INDEX` 建出来的显式索引，主键自带的唯一索引在「索引」行里单独说明。",
            "",
        ]
    )
    for database in databases:
        lines.extend(render_database(database))

    lines.extend(
        [
            "## 5. `_meta`（每个分库都有）",
            "",
            "构建元数据，由 `database/build.py` 写在每个库里，不属于任何实体，"
            "也不参与各层映射。`database/verify.py` 会拿它的 `counts` 与实际行数对账。",
            "",
            "- _meta",
            "",
            "|name|type|primary key|auto increment|key|index|comment|",
            "|---|---|---|---|---|---|---|",
            "|key|text|yes|no|NA|NA|元数据键：module / source / source_sha256 / built_at / "
            "tables / rows / counts|",
            "|value|text|no|no|NA|NA|元数据值，整数与列表都以文本存放|",
            "",
            "索引：无显式索引；主键自带 `sqlite_autoindex__meta_1`；"
            f"每个库 {meta_keys} 行。",
            "",
            "注意：`source` 一律写 `calendar.xlsx`，因为 `database/build.py` 把工作簿名"
            "无条件传给 `write_meta()`；而 `database/datafiles.py` 的 `HISTORY_MODULES`"
            "（dynasty / era / person / event）实际取自 `database/data/*.csv`。"
            "要判断某个库的真实来源，看这四个模块名，不要看 `source`。",
            "",
            "## 6. 差异",
            "",
        ]
    )
    if problems:
        lines.append(
            f"库与 `schema.py`：共 {len(problems)} 处。库里多出来的记「补 `schema.py`」，"
            "`schema.py` 声明了而库里没有的记「重建该库」。"
        )
        lines.append("")
        lines.extend(problems)
    else:
        lines.append(
            "库与 `database/schema.py` 完全一致：表名、列名与顺序、列类型、显式索引、"
            "行数归属都对得上，没有单边多出来的表或列。"
        )
    lines.append("")
    if entity_problems:
        lines.append(f"entity 与表结构：共 {len(entity_problems)} 处。")
        lines.append("")
        lines.extend(entity_problems)
    else:
        lines.append(
            "entity 与表结构一致：`src/entity/*.ts` 里每个复数属性都有对应的关联表，"
            "也没有复数命名的标量列。"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    paths = sorted(SQLITE_DIR.glob("*.sqlite"))
    if not paths:
        print(f"没有找到任何分库：{SQLITE_DIR}", file=sys.stderr)
        return 1

    databases = [read_database(path) for path in paths]
    # newline="\n"：Windows 上 write_text 默认写 CRLF，与项目统一的 LF 约定不符。
    OUTPUT.write_text(render(databases), encoding="utf-8", newline="\n")

    tables = sum(len(database.tables) for database in databases)
    rows = sum(database.rows for database in databases)
    print(f"已写出 {OUTPUT.relative_to(ROOT)}：{len(databases)} 个库、{tables} 张表、{rows:,} 行")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
