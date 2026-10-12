/**
 * 仓库层：tropical
 * 数据源：src/sqlite/tropical.sqlite（一个实体一个 SQLite 文件，只访问本文件内的表，不跨库 JOIN）
 * 实体：src/entity/tropical.ts
 * 表：tropical_year, tropical_month（主表 tropical_month 实现 AsyncRepository，年表方法见 countYears / findYearByIdentity 等）
 * 语句：src/datasource/tropical.month.sqlite.ts（主表 tropical_month）
 *     + src/datasource/tropical.year.sqlite.ts（年表 tropical_year）（镜像 src/sql/tropical.sql）
 *
 * 契约说明：repository.ts 的 Repository 是同步契约，而数据访问层的驱动是异步的
 * （Sqlite.query 返回 Promise），二者无法同时满足，故本层实现同形的异步接口
 * AsyncRepository：方法名、参数、返回类型与 Repository 一一对应，只把返回值包成 Promise。
 *
 * 一个模块一个类：主表 tropical_month 的 12 条语句 + 年表 tropical_year 的 12 条语句都在本类里，
 * 语句文本按表拆到 src/datasource/tropical.month.sqlite.ts 与 tropical.year.sqlite.ts。
 * tropical_year：回归年的年。以回归年为年长。
 *   建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。
 * tropical_month：回归年的月。以回归年为年长。
 *   建表与实体完整对应；行数据待生成。
 */
import type { Entity } from "../entity/entity";
import type { TropicalMonth, TropicalYear } from "../entity/tropical";
import { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
// 注意：src/sqlite/<entity>.sqlite 是数据库文件本体，与同名的 TS 模块冲突，
// 不带扩展名的说明符会被打包器解析成数据库文件，故这里必须显式写 .ts。
// 12 条语句在每张表下同名，故数据访问层按表拆成两个文件，各自导出一套语句。
import * as year from "../datasource/tropical.year.sqlite.ts";
import * as month from "../datasource/tropical.month.sqlite.ts";
import { TropicalMonthSqlite } from "../datasource/tropical.month.sqlite.ts";
import type { Bindings, Ordering, Row, Sqlite, StatementRunner } from "../datasource/sqlite";
import { TropicalMonthPartsAssociation } from "./tropical/tropical.month_parts.association";
import { TropicalMonthPhenologiesAssociation } from "./tropical/tropical.month_phenologies.association";
import { TropicalMonthWeeksAssociation } from "./tropical/tropical.month_weeks.association";
import { TropicalYearMonthsAssociation } from "./tropical/tropical.year_months.association";
import { TropicalYearPartsAssociation } from "./tropical/tropical.year_parts.association";
import { TropicalYearPhenologiesAssociation } from "./tropical/tropical.year_phenologies.association";
import { TropicalYearWeeksAssociation } from "./tropical/tropical.year_weeks.association";
import {
    Unlimited,
    bigOf,
    bindExample,
    booleanOf,
    declares,
    identityParameter,
    interpolate,
    isSqlite,
    orderOf,
    pageCount,
    pickOf,
    projectionOf,
    textOf
} from "../datasource/sqlite";
import type { AsyncRepository } from "./async.repository";
import { Ascend, Descend, exampleOf } from "./repository";
import type { Example, Page, Query, Sort } from "./repository";

/** 主表名：tropical_month，identity 即主键（temporal.absolute 的绝对时间序列）。 */
const Table: string = "tropical_month";

/** 年表名：tropical_year，identity 即主键。 */
const YearTable: string = "tropical_year";

/**
 * tropical 的仓库实现。
 */
export class TropicalRepository implements AsyncRepository<bigint, TropicalMonth> {

    /** 关联表 tropical_month_parts（tropical_year × tropical_month）。 */
    public readonly tropical_month_parts: TropicalMonthPartsAssociation = new TropicalMonthPartsAssociation();

    /** 关联表 tropical_month_phenologies（tropical_year × phenology）。 */
    public readonly tropical_month_phenologies: TropicalMonthPhenologiesAssociation = new TropicalMonthPhenologiesAssociation();

    /** 关联表 tropical_month_weeks（tropical_year × week）。 */
    public readonly tropical_month_weeks: TropicalMonthWeeksAssociation = new TropicalMonthWeeksAssociation();

    /** 关联表 tropical_year_months（tropical_year × part）。 */
    public readonly tropical_year_months: TropicalYearMonthsAssociation = new TropicalYearMonthsAssociation();

    /** 关联表 tropical_year_parts（tropical_month × phenology）。 */
    public readonly tropical_year_parts: TropicalYearPartsAssociation = new TropicalYearPartsAssociation();

    /** 关联表 tropical_year_phenologies（tropical_month × week）。 */
    public readonly tropical_year_phenologies: TropicalYearPhenologiesAssociation = new TropicalYearPhenologiesAssociation();

    /** 关联表 tropical_year_weeks（tropical_month × part）。 */
    public readonly tropical_year_weeks: TropicalYearWeeksAssociation = new TropicalYearWeeksAssociation();
    /** 仓库名，等于实体模块名；store 层按名装配。 */

    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用（供装配根 new <X>Repository()）。
     *
     * - 不给参数：用同实体的缺省 Sqlite，驱动取 sqlite.ts 的 runnerOf("tropical")，
     *   由 Electron 主进程 injectRunner(runner, "tropical") 注入后即可工作；未注入时查询抛中文错误。
     * - 给 Sqlite：直接使用。
     * - 给裸的 StatementRunner：自动包成同实体的 Sqlite（驱动须绑定本实体的 .sqlite 文件）。
     *
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new TropicalMonthSqlite()) {
        this.sqlite = isSqlite(source) ? source : new TropicalMonthSqlite(source);
        this.name = this.sqlite.name;
    }

    /** 全表行数（对应生成 SQL 的 -- name: count）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countBy(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>
    ): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.countBy,
            bindExample(Table, example)
        );
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 主键是否存在。 */
    public async existsByIdentity(identity: bigint): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.existsByIdentity, {
            identity: identity
        });
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 按 Example 条件判断是否存在。 */
    public async existsBy(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.existsBy,
            bindExample(Table, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAll(
        query: Query<bigint, TropicalMonth>
    ): Promise<Page<bigint, TropicalMonth>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>> = query.example ??
        exampleOf<bigint, TropicalMonth>();
        const sort: Sort<TropicalMonth> = this.sortOf<TropicalMonth>(Table, query.sort);
        const text: string = month.findAll;
        const parameters: Bindings = this.bindings<TropicalMonth>(
            text,
            Table,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<TropicalMonth> = rows.map((row: Row): TropicalMonth =>
            this.hydrate(row)
        );
        const elements: bigint = await this.countBy(example);
        return {
            sort: sort,
            content: content,
            index: query.index,
            size: query.size,
            empty: content.length === 0,
            pages: pageCount(elements, query.size),
            elements: elements
        };
    }

    /** 按主键集合查询，按 identity 升序返回；空集合直接返回空数组。 */
    public async findAllByIdentities(identities: Array<bigint>): Promise<Array<TropicalMonth>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(month.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): TropicalMonth => this.hydrate(row));
    }

    /** 按主键查询。 */
    public async findByIdentity(identity: bigint): Promise<Optional<TropicalMonth>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.findByIdentity, {
            identity: identity
        });
        return row === undefined ? Optional.empty<TropicalMonth>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findBy(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>
    ): Promise<Page<bigint, TropicalMonth>> {
        const sort: Sort<TropicalMonth> = this.sortOf<TropicalMonth>(Table, undefined);
        const text: string = month.findBy;
        const parameters: Bindings = this.bindings<TropicalMonth>(
            text,
            Table,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<TropicalMonth> = rows.map((row: Row): TropicalMonth =>
            this.hydrate(row)
        );
        const elements: bigint = BigInt(content.length);
        return {
            sort: sort,
            content: content,
            index: 0n,
            size: elements,
            empty: content.length === 0,
            pages: pageCount(elements, elements),
            elements: elements
        };
    }

    /** 按 Example 条件取首行。 */
    public async findFirstBy(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>,
        sort?: Sort<TropicalMonth>
    ): Promise<Optional<TropicalMonth>> {
        const ordering: Sort<TropicalMonth> = this.sortOf<TropicalMonth>(Table, sort);
        const text: string = month.findFirstBy;
        const parameters: Bindings = this.bindings<TropicalMonth>(text, Table, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<TropicalMonth>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOne(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>
    ): Promise<Optional<TropicalMonth>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            month.findOne,
            bindExample(Table, example)
        );
        if (rows.length === 0) {
            return Optional.empty<TropicalMonth>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 tropical_month 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<TropicalMonth>() : Optional.of(this.hydrate(row));
    }

    /** 按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectByIdentity<K extends KeyOf<TropicalMonth>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<TropicalMonth, K>>> {
        const text: string = interpolate(
            month.selectByIdentity,
            ":projection",
            projectionOf(Table, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<TropicalMonth, K>>()
            : Optional.of(pickOf<Pick<TropicalMonth, K>>(Table, fields, row));
    }

    /** 按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectBy<K extends KeyOf<TropicalMonth>>(
        example: Example<bigint, TropicalMonth, KeyOf<TropicalMonth>>,
        fields: Array<K>
    ): Promise<Array<Pick<TropicalMonth, K>>> {
        const text: string = interpolate(
            month.selectBy,
            ":projection",
            projectionOf(Table, fields)
        );
        const parameters: Bindings = this.bindings<TropicalMonth>(
            text,
            Table,
            example,
            this.sortOf<TropicalMonth>(Table, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<TropicalMonth, K> =>
            pickOf<Pick<TropicalMonth, K>>(Table, fields, row)
        );
    }

    /** 年表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async countYears(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 年表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countYearsBy(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>
    ): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            year.countBy,
            bindExample(YearTable, example)
        );
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 年表主键是否存在。 */
    public async existsYearByIdentity(identity: bigint): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.existsByIdentity, {
            identity: identity
        });
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 年表按 Example 条件判断是否存在。 */
    public async existsYearBy(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            year.existsBy,
            bindExample(YearTable, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 年表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAllYears(
        query: Query<bigint, TropicalYear>
    ): Promise<Page<bigint, TropicalYear>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, TropicalYear, KeyOf<TropicalYear>> = query.example ??
        exampleOf<bigint, TropicalYear>();
        const sort: Sort<TropicalYear> = this.sortOf<TropicalYear>(YearTable, query.sort);
        const text: string = year.findAll;
        const parameters: Bindings = this.bindings<TropicalYear>(
            text,
            YearTable,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<TropicalYear> = rows.map((row: Row): TropicalYear =>
            this.hydrateYear(row)
        );
        const elements: bigint = await this.countYearsBy(example);
        return {
            sort: sort,
            content: content,
            index: query.index,
            size: query.size,
            empty: content.length === 0,
            pages: pageCount(elements, query.size),
            elements: elements
        };
    }

    /** 年表按主键集合查询，按 identity 升序返回；空集合直接返回空数组。 */
    public async findAllYearsByIdentities(identities: Array<bigint>): Promise<Array<TropicalYear>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(year.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): TropicalYear => this.hydrateYear(row));
    }

    /** 年表按主键查询。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<TropicalYear>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<TropicalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findYearsBy(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>
    ): Promise<Page<bigint, TropicalYear>> {
        const sort: Sort<TropicalYear> = this.sortOf<TropicalYear>(YearTable, undefined);
        const text: string = year.findBy;
        const parameters: Bindings = this.bindings<TropicalYear>(
            text,
            YearTable,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<TropicalYear> = rows.map((row: Row): TropicalYear =>
            this.hydrateYear(row)
        );
        const elements: bigint = BigInt(content.length);
        return {
            sort: sort,
            content: content,
            index: 0n,
            size: elements,
            empty: content.length === 0,
            pages: pageCount(elements, elements),
            elements: elements
        };
    }

    /** 年表按 Example 条件取首行。 */
    public async findFirstYearBy(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>,
        sort?: Sort<TropicalYear>
    ): Promise<Optional<TropicalYear>> {
        const ordering: Sort<TropicalYear> = this.sortOf<TropicalYear>(YearTable, sort);
        const text: string = year.findFirstBy;
        const parameters: Bindings = this.bindings<TropicalYear>(
            text,
            YearTable,
            example,
            ordering
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<TropicalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOneYear(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>
    ): Promise<Optional<TropicalYear>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            year.findOne,
            bindExample(YearTable, example)
        );
        if (rows.length === 0) {
            return Optional.empty<TropicalYear>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 tropical_year 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<TropicalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /** 年表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectYearByIdentity<K extends KeyOf<TropicalYear>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<TropicalYear, K>>> {
        const text: string = interpolate(
            year.selectByIdentity,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<TropicalYear, K>>()
            : Optional.of(pickOf<Pick<TropicalYear, K>>(YearTable, fields, row));
    }

    /** 年表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectYearsBy<K extends KeyOf<TropicalYear>>(
        example: Example<bigint, TropicalYear, KeyOf<TropicalYear>>,
        fields: Array<K>
    ): Promise<Array<Pick<TropicalYear, K>>> {
        const text: string = interpolate(
            year.selectBy,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const parameters: Bindings = this.bindings<TropicalYear>(
            text,
            YearTable,
            example,
            this.sortOf<TropicalYear>(YearTable, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<TropicalYear, K> =>
            pickOf<Pick<TropicalYear, K>>(YearTable, fields, row)
        );
    }

    /**
     * 行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrate(row: Row): TropicalMonth {
        return {
            identity: bigOf(row.identity),
            relative: bigOf(row.relative),
            absolute: bigOf(row.absolute),
            year: bigOf(row.year),
            ordinal: bigOf(row.ordinal),
            leap: booleanOf(row.leap),
            lengthOfDay: bigOf(row.lengthOfDay),
            name: textOf(row.name),
            start: bigOf(row.start),
            end: bigOf(row.end)
        } as unknown as TropicalMonth;
    }

    /**
     * 年表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrateYear(row: Row): TropicalYear {
        return {
            identity: bigOf(row.identity),
            relative: bigOf(row.relative),
            absolute: bigOf(row.absolute),
            lengthOfMonth: bigOf(row.lengthOfMonth),
            lengthOfPhenology: bigOf(row.lengthOfPhenology),
            lengthOfWeek: bigOf(row.lengthOfWeek),
            lengthOfPart: bigOf(row.lengthOfPart),
            lengthOfDay: bigOf(row.lengthOfDay),
            leap: booleanOf(row.leap),
            start: bigOf(row.start),
            end: bigOf(row.end)
        } as unknown as TropicalYear;
    }

    /**
     * 组装绑定参数：条件走 bindExample（等值 / 区间 / 模糊），排序列走 orderOf 白名单，
     * 可选 LIMIT(:limit) / OFFSET(:offset)。只绑定语句真正声明的占位符 —— 多余的具名参数会被驱动拒绝。
     * @param text 生成 SQL 原文（用于判断语句声明了哪些占位符）。
     * @param table 表名。
     * @param example 条件。
     * @param sort 排序（只取第一个排序键，与 SQL 的单个 :sortColumn 槽位对应）。
     * @param size 可选 LIMIT，绑定到 SQL 的 :limit。
     * @param offset 可选 OFFSET。
     */
    private bindings<E extends Entity<bigint>>(
        text: string,
        table: string,
        example: Example<bigint, E, KeyOf<E>>,
        sort: Sort<E>,
        size?: bigint,
        offset?: bigint
    ): Bindings {
        const ordering: Ordering = orderOf(table, sort);
        const parameters: Bindings = {
            ...bindExample(table, example),
            sortColumn: ordering.column
        };
        if (size !== undefined) {
            parameters.limit = size;
        }
        if (offset !== undefined) {
            parameters.offset = offset;
        }
        if (declares(text, ":sortDirection")) {
            parameters.sortDirection = ordering.direction;
        }
        return parameters;
    }

    /**
     * 规范化排序：缺省 identity 升序；多键排序、未知列、未知方向都由 orderOf 抛 TypeError。
     * 返回值同时用于 SQL 绑定与 Page.sort，保证两者一致。
     * @param table 表名。
     * @param sort 调用方给的排序。
     */
    private sortOf<E extends Entity<bigint>>(table: string, sort?: Sort<E>): Sort<E> {
        const ordering: Ordering = orderOf(table, sort);
        return {
            orders: [
                {
                    by: ordering.column as KeyOf<E>,
                    direction: ordering.direction === "DESC" ? Descend : Ascend
                }
            ]
        };
    }
}
