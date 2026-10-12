/**
 * 关联表仓库：natural_year_parts
 * 父端：natural_year（列 `year`）
 * 目标端：part（列 `part`）
 * 语句：src/datasource/natural.year_parts.sqlite.ts（镜像 src/sql/natural.calendar.sql 里表 natural_year_parts 的 12 条语句）
 * 由 scripts/generate_association_methods.py 生成，请勿手改。
 */
import * as statement from "../../datasource/natural.year_parts.sqlite.ts";
import { NaturalYearPartsSqlite } from "../../datasource/natural.year_parts.sqlite.ts";
import type { Bindings, Row, Sqlite, StatementRunner } from "../../datasource/sqlite";
import { Unlimited, bigOf, interpolate, isSqlite, pageCount } from "../../datasource/sqlite";
import { Ascend } from "../repository";
import type { Page, Sort } from "../repository";

/** 关联行的列白名单：`:projection` 只能拼这几列。 */
const COLUMNS: ReadonlyArray<string> = ["identity", "year", "part"];

/** 关联行。关联表只有三列，故不套用实体的类型。 */
export interface AssociationRow {
    /** 自增主键。 */
    identity: bigint;
    /** 父端 identity。 */
    year: bigint;
    /** 目标端 identity。 */
    part: bigint;
}

/**
 * natural_year_parts 的查询类。
 *
 * 关联表只有三个列（identity、year、part），
 * 因此不套用通用的 12 方法仓储，只提供关系查询真正需要的那几个。
 */
export class NaturalYearPartsAssociation {

    /** 关联表名。 */
    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用。
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new NaturalYearPartsSqlite()) {
        this.sqlite = isSqlite(source) ? source : new NaturalYearPartsSqlite();
        this.name = this.sqlite.name;
    }

    /** 关联总行数（`-- name: count`）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 某一对（父、目标）是否存在关联。 */
    public async exists(year: bigint, part: bigint): Promise<boolean> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findByIdentity,
            { identity: null, ...this.blank(), year: year, part: part }
        );
        return rows.length > 0;
    }

    /** 该父行关联到的全部目标行 identity（按 identity 升序）。 */
    public async findTargetsBy(year: bigint): Promise<Array<bigint>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("part"),
            this.conditions({ year: year })
        );
        return rows.map((row: Row): bigint => bigOf(row.part));
    }

    /** 该目标行关联到的全部父行 identity（按 identity 升序）。 */
    public async findParentsBy(part: bigint): Promise<Array<bigint>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("year"),
            this.conditions({ part: part })
        );
        return rows.map((row: Row): bigint => bigOf(row.year));
    }

    /** 按父行集合批量取目标：`父 identity -> 目标 identity 数组`。 */
    public async findTargetsByParents(years: Array<bigint>): Promise<Map<bigint, Array<bigint>>> {
        const result: Map<bigint, Array<bigint>> = new Map();
        if (years.length === 0) {
            return result;
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(
            this.projected("year, part"),
            this.conditions({})
        );
        const wanted: Set<string> = new Set(years.map((value: bigint): string => value.toString()));
        for (const row of rows) {
            const key: bigint = bigOf(row.year);
            if (!wanted.has(key.toString())) {
                continue;
            }
            const bucket: Array<bigint> = result.get(key) ?? [];
            bucket.push(bigOf(row.part));
            result.set(key, bucket);
        }
        return result;
    }

    /** 按 identity 分页取关联行。 */
    public async findAll(index: bigint = 0n, size: bigint = 20n): Promise<Page<bigint, AssociationRow>> {
        if (size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        const sort: Sort<AssociationRow> = { orders: [{ by: "identity", direction: Ascend }] };
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findAll,
            {
                ...this.blank(),
                sortColumn: "identity",
                limit: size,
                offset: index * size
            }
        );
        const content: Array<AssociationRow> = rows.map(
            (row: Row): AssociationRow => ({
                identity: bigOf(row.identity),
                year: bigOf(row.year),
                part: bigOf(row.part)
            })
        );
        const elements: bigint = await this.count();
        return {
            sort: sort,
            content: content,
            index: index,
            size: size,
            empty: content.length === 0,
            pages: pageCount(elements, size),
            elements: elements
        };
    }

    /** 把 `SELECT :projection` 换成受控列名：先过白名单，再替换。 */
    private projected(columns: string): string {
        const names: Array<string> = columns.split(",").map((name: string): string => name.trim());
        for (const name of names) {
            if (!COLUMNS.includes(name)) {
                throw new TypeError(`${this.name} 没有列 ${name}`);
            }
        }
        const literal: string = names.map((name: string): string => `"${name}"`).join(", ");
        return interpolate(statement.selectBy, ":projection", literal);
    }

    /** 条件全空 + 固定排序与不分页上限的绑定参数包。 */
    private conditions(equal: Bindings): Bindings {
        return {
            ...this.blank(),
            ...equal,
            sortColumn: "identity",
            limit: Unlimited,
            offset: 0n
        };
    }

    /** 全部可空列的 NULL 参数包：SQL 写成 `:col IS NULL OR ...`，故全 NULL 即不加条件。 */
    private blank(): Bindings {
        return {
            identity: null,
            year: null,
            part: null
        };
    }
}
