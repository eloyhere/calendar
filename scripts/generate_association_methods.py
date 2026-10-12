"""为关联表生成 repository 方法。

    python scripts/generate_association_methods.py

entity 里的复数集合字段（`weeks`、`parts`、`phenologies` …）都落成了关联表，
形如 `synodic_month_weeks(identity, month -> synodic_month, week -> week)`。
本脚本为每张关联表生成一个查询类，并挂到所属模块的 repository 上：

    src/repository/<模块>/<表后缀>.association.ts    一个关联表一个类
    src/repository/<模块>.repository.ts              追加 `public readonly <名> = ...`

生成四类查询（多对多关系最常用的四种）：

| 方法 | 含义 |
| --- | --- |
| `count()` | 关联总行数 |
| `exists(parent, target)` | 某一对是否存在关联 |
| `findTargetsBy(parent)` | 该父行关联到的全部目标行 identity |
| `findParentsBy(target)` | 该目标行关联到的全部父行 identity |
| `findAll(page, size)` | 按 identity 分页取关联行（走规范 SQL 的 findAll） |

类名与数据访问层的 `<Pascal>Sqlite` 同名规则一致，但加 `Association` 后缀，
避免与 `<表>Sqlite` 撞名；`_meta` 之类的构建元数据不在 schema 里，自然不会被处理。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
# 只把项目根加进 sys.path：`scripts/` 下另有一个 `database/` 包，
# 一并加进来会让 `import database` 解析到那个包，拿不到 schema。
sys.path.insert(0, str(ROOT))

from database.association import Association, associations_of  # noqa: E402
from database.schema import TABLES  # noqa: E402
from database.store import STORE_ORDER  # noqa: E402


def _load_by_path(name: str, path: Path) -> ModuleType:
    """按文件路径加载模块，避免与 scripts/ 下的同名包冲突。"""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载 {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_generator = _load_by_path("_generate_datasource", ROOT / "scripts" / "generate_datasource.py")
stem_of = _generator.stem_of

#: 表名 -> 实体类型名；未登记的按表名转大驼峰
TABLE_TYPES: dict[str, str] = {
    "synodic_calendar_year": "SynodicYear",
    "synodic_month": "SynodicMonth",
    "astronomy_year": "AstronomyYear",
    "climate_year": "ClimateYear",
    "gregory_year": "GregoryYear",
    "jupiter_year": "JupiterYear",
    "natural_year": "NaturalYear",
    "tree_year": "TreeYear",
    "tropical_year": "TropicalYear",
    "climate_month": "ClimateMonth",
}
#: 模块 -> 实体基类型（主表类型），用于 AsyncRepository 的泛型参数
MODULE_BASE_TYPE: dict[str, str] = {
    "synodic": "SynodicMonth",
    "climate": "Climate",
    "phase": "Phase",
    "primary": "Primary",
    "encounter": "Encounter",
    "perform": "Perform",
    "epoch": "Epoch",
    "dynasty": "Dynasty",
    "era": "Era",
    "astronomy.calendar": "AstronomyMonth",
    "gregory.calendar": "GregoryMonth",
    "jupiter.calendar": "JupiterMonth",
    "natural.calendar": "NaturalMonth",
    "tree.calendar": "TreeMonth",
    "tropical.calendar": "TropicalMonth",
}


def pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.replace(".", "_").split("_"))


def type_of(table_name: str) -> str:
    return TABLE_TYPES.get(table_name, pascal(table_name))


def module_type(module: str) -> str:
    return MODULE_BASE_TYPE.get(module, pascal(module))


def render(association: Association, module: str, datasource: str, class_name: str) -> str:
    table = association.table.name
    parent_field = association.parent_field
    target_field = association.target_field

    return f'''/**
 * 关联表仓库：{table}
 * 父端：{association.parent_table}（列 `{parent_field}`）
 * 目标端：{association.target_table}（列 `{target_field}`）
 * 语句：src/datasource/{datasource}（镜像 src/sql/{module}.sql 里表 {table} 的 12 条语句）
 * 由 scripts/generate_association_methods.py 生成，请勿手改。
 */
import * as statement from "../../datasource/{datasource}";
import {{ {pascal(table)}Sqlite }} from "../../datasource/{datasource}";
import type {{ Bindings, Row, Sqlite, StatementRunner }} from "../../datasource/sqlite";
import {{ Unlimited, bigOf, interpolate, isSqlite, pageCount }} from "../../datasource/sqlite";
import {{ Ascend }} from "../repository";
import type {{ Page, Sort }} from "../repository";

/** 关联行的列白名单：`:projection` 只能拼这几列。 */
const COLUMNS: ReadonlyArray<string> = ["identity", "{parent_field}", "{target_field}"];

/** 关联行。关联表只有三列，故不套用实体的类型。 */
export interface AssociationRow {{
    /** 自增主键。 */
    identity: bigint;
    /** 父端 identity。 */
    {parent_field}: bigint;
    /** 目标端 identity。 */
    {target_field}: bigint;
}}

/**
 * {table} 的查询类。
 *
 * 关联表只有三个列（identity、{parent_field}、{target_field}），
 * 因此不套用通用的 12 方法仓储，只提供关系查询真正需要的那几个。
 */
export class {class_name} {{

    /** 关联表名。 */
    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用。
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new {pascal(table)}Sqlite()) {{
        this.sqlite = isSqlite(source) ? source : new {pascal(table)}Sqlite();
        this.name = this.sqlite.name;
    }}

    /** 关联总行数（`-- name: count`）。 */
    public async count(): Promise<bigint> {{
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.count);
        return row === undefined ? 0n : bigOf(row.count);
    }}

    /** 某一对（父、目标）是否存在关联。 */
    public async exists({parent_field}: bigint, {target_field}: bigint): Promise<boolean> {{
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findByIdentity,
            {{ identity: null, ...this.blank(), {parent_field}: {parent_field}, {target_field}: {target_field} }}
        );
        return rows.length > 0;
    }}

    /** 该父行关联到的全部目标行 identity（按 identity 升序）。 */
    public async findTargetsBy({parent_field}: bigint): Promise<Array<bigint>> {{
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("{target_field}"),
            this.conditions({{ {parent_field}: {parent_field} }})
        );
        return rows.map((row: Row): bigint => bigOf(row.{target_field}));
    }}

    /** 该目标行关联到的全部父行 identity（按 identity 升序）。 */
    public async findParentsBy({target_field}: bigint): Promise<Array<bigint>> {{
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("{parent_field}"),
            this.conditions({{ {target_field}: {target_field} }})
        );
        return rows.map((row: Row): bigint => bigOf(row.{parent_field}));
    }}

    /** 按父行集合批量取目标：`父 identity -> 目标 identity 数组`。 */
    public async findTargetsByParents({parent_field}s: Array<bigint>): Promise<Map<bigint, Array<bigint>>> {{
        const result: Map<bigint, Array<bigint>> = new Map();
        if ({parent_field}s.length === 0) {{
            return result;
        }}
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("{parent_field}, {target_field}"),
            this.conditions({{}})
        );
        const wanted: Set<string> = new Set({parent_field}s.map((value: bigint): string => value.toString()));
        for (const row of rows) {{
            const key: bigint = bigOf(row.{parent_field});
            if (!wanted.has(key.toString())) {{
                continue;
            }}
            const bucket: Array<bigint> = result.get(key) ?? [];
            bucket.push(bigOf(row.{target_field}));
            result.set(key, bucket);
        }}
        return result;
    }}

    /** 按 identity 分页取关联行。 */
    public async findAll(index: bigint = 0n, size: bigint = 20n): Promise<Page<bigint, AssociationRow>> {{
        if (size <= 0n) {{
            throw new RangeError("分页大小 size 必须大于 0。");
        }}
        const sort: Sort<AssociationRow> = {{ orders: [{{ by: "identity", direction: Ascend }}] }};
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findAll,
            {{
                ...this.blank(),
                sortColumn: "identity",
                limit: size,
                offset: index * size
            }}
        );
        const content: Array<AssociationRow> = rows.map(
            (row: Row): AssociationRow => ({{
                identity: bigOf(row.identity),
                {parent_field}: bigOf(row.{parent_field}),
                {target_field}: bigOf(row.{target_field})
            }})
        );
        const elements: bigint = await this.count();
        return {{
            sort: sort,
            content: content,
            index: index,
            size: size,
            empty: content.length === 0,
            pages: pageCount(elements, size),
            elements: elements
        }};
    }}

    /** 把 `SELECT :projection` 换成受控列名：先过白名单，再替换。 */
    private projected(columns: string): string {{
        const names: Array<string> = columns.split(",").map((name: string): string => name.trim());
        for (const name of names) {{
            if (!COLUMNS.includes(name)) {{
                throw new TypeError(`${{this.name}} 没有列 ${{name}}`);
            }}
        }}
        const literal: string = names.map((name: string): string => `"${{name}}"`).join(", ");
        return interpolate(statement.selectBy, ":projection", literal);
    }}

    /** 条件全空 + 固定排序与不分页上限的绑定参数包。 */
    private conditions(equal: Bindings): Bindings {{
        return {{
            ...this.blank(),
            ...equal,
            sortColumn: "identity",
            limit: Unlimited,
            offset: 0n
        }};
    }}

    /** 全部可空列的 NULL 参数包：SQL 写成 `:col IS NULL OR ...`，故全 NULL 即不加条件。 */
    private blank(): Bindings {{
        return {{
            identity: null,
            {parent_field}: null,
            {target_field}: null
        }};
    }}
}}
'''


def field_lines(association: Association) -> str:
    """模块 repository 里暴露的属性声明。"""
    return (
        f"    /** 关联表 {association.table.name}（{association.parent_table} × "
        f"{association.target_table}）。 */\n"
        f"    public readonly {association.table.name}: {pascal(association.table.name)}Association;\n"
    )


def main() -> int:
    by_name = {table.name: table for table in TABLES}
    total = 0
    for module in STORE_ORDER:
        associations = associations_of(module)
        if not associations:
            continue
        # 模块 repository 的文件名去掉了 `.calendar` 后缀（`astronomy.repository.ts`），
        # 关联表目录名与之一致，否则会出现 `astronomy/` 与 `astronomy.calendar/` 两份。
        directory = SRC / "repository" / module.replace(".calendar", "")
        directory.mkdir(parents=True, exist_ok=True)
        entries: list[tuple[Association, str, str]] = []
        for association in associations:
            datasource = f"{stem_of(module, association.table.name)}.sqlite.ts"
            class_name = f"{pascal(association.table.name)}Association"
            path = directory / f"{datasource[: -len('.sqlite.ts')]}.association.ts"
            # newline="\n"：Windows 上 write_text 默认写 CRLF，与 .editorconfig / .prettierrc
            # 的 LF 约定冲突（lint 会为每个生成文件报上百条 "Delete ␍"）。
            path.write_text(
                render(association, module, datasource, class_name),
                encoding="utf-8",
                newline="\n",
            )
            entries.append((association, datasource, class_name))
            total += 1
        print(f"  {module:20} {len(entries):>2} 个关联表仓库 -> src/repository/{module}/")
    print(f"共生成 {total} 个关联表仓库")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
