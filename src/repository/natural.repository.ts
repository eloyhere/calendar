/**
 * 仓库层：natural
 * 数据源：src/sqlite/natural.sqlite（一个实体一个 SQLite 文件，只访问本文件内的表，不跨库 JOIN）
 * 实体：src/entity/natural.ts
 * 表：natural_year, natural_month（主表 natural_month 实现 AsyncRepository，年表方法见 countYears / findYearByIdentity 等）
 * 语句：src/datasource/natural.month.sqlite.ts（主表 natural_month）
 *     + src/datasource/natural.year.sqlite.ts（年表 natural_year）（镜像 src/sql/natural.sql）
 *
 * 契约说明：repository.ts 的 Repository 是同步契约，而数据访问层的驱动是异步的
 * （Sqlite.query 返回 Promise），二者无法同时满足，故本层实现同形的异步接口
 * AsyncRepository：方法名、参数、返回类型与 Repository 一一对应，只把返回值包成 Promise。
 *
 * 一个模块一个类：主表 natural_month 的 12 条语句 + 年表 natural_year 的 12 条语句都在本类里，
 * 语句文本按表拆到 src/datasource/natural.month.sqlite.ts 与 natural.year.sqlite.ts。
 * natural_year：轩辕纪年/黄帝纪年的年。以建元 -2696-03-11 01:45:49 起算。
 *   建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。
 * natural_month：轩辕纪年/黄帝纪年的月。以建元 -2696-03-11 01:45:49 起算。
 *   建表与实体完整对应；行数据待生成。
 */
import type { Entity } from "../entity/entity";
import type { NaturalMonth, NaturalYear } from "../entity/natural";
import { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
// 注意：src/sqlite/<entity>.sqlite 是数据库文件本体，与同名的 TS 模块冲突，
// 不带扩展名的说明符会被打包器解析成数据库文件，故这里必须显式写 .ts。
// 12 条语句在每张表下同名，故数据访问层按表拆成两个文件，各自导出一套语句。
import * as year from "../datasource/natural.year.sqlite.ts";
import * as month from "../datasource/natural.month.sqlite.ts";
import { NaturalMonthSqlite } from "../datasource/natural.month.sqlite.ts";
import type { Bindings, Ordering, Row, Sqlite, StatementRunner } from "../datasource/sqlite";
import { NaturalMonthPartsAssociation } from "./natural/natural.month_parts.association";
import { NaturalMonthPhenologiesAssociation } from "./natural/natural.month_phenologies.association";
import { NaturalMonthWeeksAssociation } from "./natural/natural.month_weeks.association";
import { NaturalYearMonthsAssociation } from "./natural/natural.year_months.association";
import { NaturalYearPartsAssociation } from "./natural/natural.year_parts.association";
import { NaturalYearPhenologiesAssociation } from "./natural/natural.year_phenologies.association";
import { NaturalYearWeeksAssociation } from "./natural/natural.year_weeks.association";
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

/** 主表名：natural_month，identity 即主键（temporal.absolute 的绝对时间序列）。 */
const Table: string = "natural_month";

/** 年表名：natural_year，identity 即主键。 */
const YearTable: string = "natural_year";

/**
 * natural 的仓库实现。
 */
export class NaturalRepository implements AsyncRepository<bigint, NaturalMonth> {

    /** 关联表 natural_month_parts（natural_year × natural_month）。 */
    public readonly natural_month_parts: NaturalMonthPartsAssociation = new NaturalMonthPartsAssociation();

    /** 关联表 natural_month_phenologies（natural_year × phenology）。 */
    public readonly natural_month_phenologies: NaturalMonthPhenologiesAssociation = new NaturalMonthPhenologiesAssociation();

    /** 关联表 natural_month_weeks（natural_year × week）。 */
    public readonly natural_month_weeks: NaturalMonthWeeksAssociation = new NaturalMonthWeeksAssociation();

    /** 关联表 natural_year_months（natural_year × part）。 */
    public readonly natural_year_months: NaturalYearMonthsAssociation = new NaturalYearMonthsAssociation();

    /** 关联表 natural_year_parts（natural_month × phenology）。 */
    public readonly natural_year_parts: NaturalYearPartsAssociation = new NaturalYearPartsAssociation();

    /** 关联表 natural_year_phenologies（natural_month × week）。 */
    public readonly natural_year_phenologies: NaturalYearPhenologiesAssociation = new NaturalYearPhenologiesAssociation();

    /** 关联表 natural_year_weeks（natural_month × part）。 */
    public readonly natural_year_weeks: NaturalYearWeeksAssociation = new NaturalYearWeeksAssociation();
    /** 仓库名，等于实体模块名；store 层按名装配。 */

    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用（供装配根 new <X>Repository()）。
     *
     * - 不给参数：用同实体的缺省 Sqlite，驱动取 sqlite.ts 的 runnerOf("natural")，
     *   由 Electron 主进程 injectRunner(runner, "natural") 注入后即可工作；未注入时查询抛中文错误。
     * - 给 Sqlite：直接使用。
     * - 给裸的 StatementRunner：自动包成同实体的 Sqlite（驱动须绑定本实体的 .sqlite 文件）。
     *
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new NaturalMonthSqlite()) {
        this.sqlite = isSqlite(source) ? source : new NaturalMonthSqlite(source);
        this.name = this.sqlite.name;
    }

    /** 全表行数（对应生成 SQL 的 -- name: count）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countBy(
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>
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
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.existsBy,
            bindExample(Table, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAll(query: Query<bigint, NaturalMonth>): Promise<Page<bigint, NaturalMonth>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>> = query.example ??
        exampleOf<bigint, NaturalMonth>();
        const sort: Sort<NaturalMonth> = this.sortOf<NaturalMonth>(Table, query.sort);
        const text: string = month.findAll;
        const parameters: Bindings = this.bindings<NaturalMonth>(
            text,
            Table,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<NaturalMonth> = rows.map((row: Row): NaturalMonth =>
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
    public async findAllByIdentities(identities: Array<bigint>): Promise<Array<NaturalMonth>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(month.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): NaturalMonth => this.hydrate(row));
    }

    /** 按主键查询。 */
    public async findByIdentity(identity: bigint): Promise<Optional<NaturalMonth>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.findByIdentity, {
            identity: identity
        });
        return row === undefined ? Optional.empty<NaturalMonth>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findBy(
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>
    ): Promise<Page<bigint, NaturalMonth>> {
        const sort: Sort<NaturalMonth> = this.sortOf<NaturalMonth>(Table, undefined);
        const text: string = month.findBy;
        const parameters: Bindings = this.bindings<NaturalMonth>(
            text,
            Table,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<NaturalMonth> = rows.map((row: Row): NaturalMonth =>
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
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>,
        sort?: Sort<NaturalMonth>
    ): Promise<Optional<NaturalMonth>> {
        const ordering: Sort<NaturalMonth> = this.sortOf<NaturalMonth>(Table, sort);
        const text: string = month.findFirstBy;
        const parameters: Bindings = this.bindings<NaturalMonth>(text, Table, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<NaturalMonth>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOne(
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>
    ): Promise<Optional<NaturalMonth>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            month.findOne,
            bindExample(Table, example)
        );
        if (rows.length === 0) {
            return Optional.empty<NaturalMonth>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 natural_month 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<NaturalMonth>() : Optional.of(this.hydrate(row));
    }

    /** 按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectByIdentity<K extends KeyOf<NaturalMonth>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<NaturalMonth, K>>> {
        const text: string = interpolate(
            month.selectByIdentity,
            ":projection",
            projectionOf(Table, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<NaturalMonth, K>>()
            : Optional.of(pickOf<Pick<NaturalMonth, K>>(Table, fields, row));
    }

    /** 按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectBy<K extends KeyOf<NaturalMonth>>(
        example: Example<bigint, NaturalMonth, KeyOf<NaturalMonth>>,
        fields: Array<K>
    ): Promise<Array<Pick<NaturalMonth, K>>> {
        const text: string = interpolate(
            month.selectBy,
            ":projection",
            projectionOf(Table, fields)
        );
        const parameters: Bindings = this.bindings<NaturalMonth>(
            text,
            Table,
            example,
            this.sortOf<NaturalMonth>(Table, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<NaturalMonth, K> =>
            pickOf<Pick<NaturalMonth, K>>(Table, fields, row)
        );
    }

    /** 年表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async countYears(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 年表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countYearsBy(
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>
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
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            year.existsBy,
            bindExample(YearTable, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 年表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAllYears(
        query: Query<bigint, NaturalYear>
    ): Promise<Page<bigint, NaturalYear>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, NaturalYear, KeyOf<NaturalYear>> = query.example ??
        exampleOf<bigint, NaturalYear>();
        const sort: Sort<NaturalYear> = this.sortOf<NaturalYear>(YearTable, query.sort);
        const text: string = year.findAll;
        const parameters: Bindings = this.bindings<NaturalYear>(
            text,
            YearTable,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<NaturalYear> = rows.map((row: Row): NaturalYear =>
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
    public async findAllYearsByIdentities(identities: Array<bigint>): Promise<Array<NaturalYear>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(year.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): NaturalYear => this.hydrateYear(row));
    }

    /** 年表按主键查询。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<NaturalYear>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<NaturalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findYearsBy(
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>
    ): Promise<Page<bigint, NaturalYear>> {
        const sort: Sort<NaturalYear> = this.sortOf<NaturalYear>(YearTable, undefined);
        const text: string = year.findBy;
        const parameters: Bindings = this.bindings<NaturalYear>(
            text,
            YearTable,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<NaturalYear> = rows.map((row: Row): NaturalYear =>
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
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>,
        sort?: Sort<NaturalYear>
    ): Promise<Optional<NaturalYear>> {
        const ordering: Sort<NaturalYear> = this.sortOf<NaturalYear>(YearTable, sort);
        const text: string = year.findFirstBy;
        const parameters: Bindings = this.bindings<NaturalYear>(text, YearTable, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<NaturalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOneYear(
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>
    ): Promise<Optional<NaturalYear>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            year.findOne,
            bindExample(YearTable, example)
        );
        if (rows.length === 0) {
            return Optional.empty<NaturalYear>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 natural_year 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<NaturalYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /** 年表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectYearByIdentity<K extends KeyOf<NaturalYear>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<NaturalYear, K>>> {
        const text: string = interpolate(
            year.selectByIdentity,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<NaturalYear, K>>()
            : Optional.of(pickOf<Pick<NaturalYear, K>>(YearTable, fields, row));
    }

    /** 年表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectYearsBy<K extends KeyOf<NaturalYear>>(
        example: Example<bigint, NaturalYear, KeyOf<NaturalYear>>,
        fields: Array<K>
    ): Promise<Array<Pick<NaturalYear, K>>> {
        const text: string = interpolate(
            year.selectBy,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const parameters: Bindings = this.bindings<NaturalYear>(
            text,
            YearTable,
            example,
            this.sortOf<NaturalYear>(YearTable, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<NaturalYear, K> =>
            pickOf<Pick<NaturalYear, K>>(YearTable, fields, row)
        );
    }

    /**
     * 行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrate(row: Row): NaturalMonth {
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
        } as unknown as NaturalMonth;
    }

    /**
     * 年表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrateYear(row: Row): NaturalYear {
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
        } as unknown as NaturalYear;
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
