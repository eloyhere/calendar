/**
 * 仓库层：astronomy
 * 数据源：src/sqlite/astronomy.sqlite（一个实体一个 SQLite 文件，只访问本文件内的表，不跨库 JOIN）
 * 实体：src/entity/astronomy.ts
 * 表：astronomy_year, astronomy_month（主表 astronomy_month 实现 AsyncRepository，年表方法见 countYears / findYearByIdentity 等）
 * 语句：src/datasource/astronomy.month.sqlite.ts（主表 astronomy_month）
 *     + src/datasource/astronomy.year.sqlite.ts（年表 astronomy_year）（镜像 src/sql/astronomy.sql）
 *
 * 契约说明：repository.ts 的 Repository 是同步契约，而数据访问层的驱动是异步的
 * （Sqlite.query 返回 Promise），二者无法同时满足，故本层实现同形的异步接口
 * AsyncRepository：方法名、参数、返回类型与 Repository 一一对应，只把返回值包成 Promise。
 *
 * 一个模块一个类：主表 astronomy_month 的 12 条语句 + 年表 astronomy_year 的 12 条语句都在本类里，
 * 语句文本按表拆到 src/datasource/astronomy.month.sqlite.ts 与 astronomy.year.sqlite.ts。
 * astronomy_year：天文纪年的年。按月相规则定建元。
 *   建表与实体完整对应；行数据需由朔望月/回归年换算生成，暂不物化。
 * astronomy_month：天文纪年的月。按月相规则定建元。
 *   建表与实体完整对应；行数据待生成。
 */
import type { Entity } from "../entity/entity";
import type { AstronomyMonth, AstronomyYear } from "../entity/astronomy";
import { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
// 注意：src/sqlite/<entity>.sqlite 是数据库文件本体，与同名的 TS 模块冲突，
// 不带扩展名的说明符会被打包器解析成数据库文件，故这里必须显式写 .ts。
// 12 条语句在每张表下同名，故数据访问层按表拆成两个文件，各自导出一套语句。
import * as year from "../datasource/astronomy.year.sqlite.ts";
import * as month from "../datasource/astronomy.month.sqlite.ts";
import { AstronomyMonthSqlite } from "../datasource/astronomy.month.sqlite.ts";
import type { Bindings, Ordering, Row, Sqlite, StatementRunner } from "../datasource/sqlite";
import { AstronomyMonthPartsAssociation } from "./astronomy/astronomy.month_parts.association";
import { AstronomyMonthPhenologiesAssociation } from "./astronomy/astronomy.month_phenologies.association";
import { AstronomyMonthWeeksAssociation } from "./astronomy/astronomy.month_weeks.association";
import { AstronomyYearMonthsAssociation } from "./astronomy/astronomy.year_months.association";
import { AstronomyYearPartsAssociation } from "./astronomy/astronomy.year_parts.association";
import { AstronomyYearPhenologiesAssociation } from "./astronomy/astronomy.year_phenologies.association";
import { AstronomyYearWeeksAssociation } from "./astronomy/astronomy.year_weeks.association";
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

/** 主表名：astronomy_month，identity 即主键（temporal.absolute 的绝对时间序列）。 */
const Table: string = "astronomy_month";

/** 年表名：astronomy_year，identity 即主键。 */
const YearTable: string = "astronomy_year";

/**
 * astronomy 的仓库实现。
 */
export class AstronomyRepository implements AsyncRepository<bigint, AstronomyMonth> {

    /** 关联表 astronomy_month_parts（astronomy_year × astronomy_month）。 */
    public readonly astronomy_month_parts: AstronomyMonthPartsAssociation = new AstronomyMonthPartsAssociation();

    /** 关联表 astronomy_month_phenologies（astronomy_year × phenology）。 */
    public readonly astronomy_month_phenologies: AstronomyMonthPhenologiesAssociation = new AstronomyMonthPhenologiesAssociation();

    /** 关联表 astronomy_month_weeks（astronomy_year × week）。 */
    public readonly astronomy_month_weeks: AstronomyMonthWeeksAssociation = new AstronomyMonthWeeksAssociation();

    /** 关联表 astronomy_year_months（astronomy_year × part）。 */
    public readonly astronomy_year_months: AstronomyYearMonthsAssociation = new AstronomyYearMonthsAssociation();

    /** 关联表 astronomy_year_parts（astronomy_month × phenology）。 */
    public readonly astronomy_year_parts: AstronomyYearPartsAssociation = new AstronomyYearPartsAssociation();

    /** 关联表 astronomy_year_phenologies（astronomy_month × week）。 */
    public readonly astronomy_year_phenologies: AstronomyYearPhenologiesAssociation = new AstronomyYearPhenologiesAssociation();

    /** 关联表 astronomy_year_weeks（astronomy_month × part）。 */
    public readonly astronomy_year_weeks: AstronomyYearWeeksAssociation = new AstronomyYearWeeksAssociation();
    /** 仓库名，等于实体模块名；store 层按名装配。 */

    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用（供装配根 new <X>Repository()）。
     *
     * - 不给参数：用同实体的缺省 Sqlite，驱动取 sqlite.ts 的 runnerOf("astronomy")，
     *   由 Electron 主进程 injectRunner(runner, "astronomy") 注入后即可工作；未注入时查询抛中文错误。
     * - 给 Sqlite：直接使用。
     * - 给裸的 StatementRunner：自动包成同实体的 Sqlite（驱动须绑定本实体的 .sqlite 文件）。
     *
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new AstronomyMonthSqlite()) {
        this.sqlite = isSqlite(source) ? source : new AstronomyMonthSqlite(source);
        this.name = this.sqlite.name;
    }

    /** 全表行数（对应生成 SQL 的 -- name: count）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countBy(
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>
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
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.existsBy,
            bindExample(Table, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAll(
        query: Query<bigint, AstronomyMonth>
    ): Promise<Page<bigint, AstronomyMonth>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>> = query.example ??
        exampleOf<bigint, AstronomyMonth>();
        const sort: Sort<AstronomyMonth> = this.sortOf<AstronomyMonth>(Table, query.sort);
        const text: string = month.findAll;
        const parameters: Bindings = this.bindings<AstronomyMonth>(
            text,
            Table,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<AstronomyMonth> = rows.map((row: Row): AstronomyMonth =>
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
    public async findAllByIdentities(identities: Array<bigint>): Promise<Array<AstronomyMonth>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(month.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): AstronomyMonth => this.hydrate(row));
    }

    /** 按主键查询。 */
    public async findByIdentity(identity: bigint): Promise<Optional<AstronomyMonth>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<AstronomyMonth>()
            : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findBy(
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>
    ): Promise<Page<bigint, AstronomyMonth>> {
        const sort: Sort<AstronomyMonth> = this.sortOf<AstronomyMonth>(Table, undefined);
        const text: string = month.findBy;
        const parameters: Bindings = this.bindings<AstronomyMonth>(
            text,
            Table,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<AstronomyMonth> = rows.map((row: Row): AstronomyMonth =>
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
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>,
        sort?: Sort<AstronomyMonth>
    ): Promise<Optional<AstronomyMonth>> {
        const ordering: Sort<AstronomyMonth> = this.sortOf<AstronomyMonth>(Table, sort);
        const text: string = month.findFirstBy;
        const parameters: Bindings = this.bindings<AstronomyMonth>(text, Table, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<AstronomyMonth>()
            : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOne(
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>
    ): Promise<Optional<AstronomyMonth>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            month.findOne,
            bindExample(Table, example)
        );
        if (rows.length === 0) {
            return Optional.empty<AstronomyMonth>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 astronomy_month 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<AstronomyMonth>()
            : Optional.of(this.hydrate(row));
    }

    /** 按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectByIdentity<K extends KeyOf<AstronomyMonth>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<AstronomyMonth, K>>> {
        const text: string = interpolate(
            month.selectByIdentity,
            ":projection",
            projectionOf(Table, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<AstronomyMonth, K>>()
            : Optional.of(pickOf<Pick<AstronomyMonth, K>>(Table, fields, row));
    }

    /** 按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectBy<K extends KeyOf<AstronomyMonth>>(
        example: Example<bigint, AstronomyMonth, KeyOf<AstronomyMonth>>,
        fields: Array<K>
    ): Promise<Array<Pick<AstronomyMonth, K>>> {
        const text: string = interpolate(
            month.selectBy,
            ":projection",
            projectionOf(Table, fields)
        );
        const parameters: Bindings = this.bindings<AstronomyMonth>(
            text,
            Table,
            example,
            this.sortOf<AstronomyMonth>(Table, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<AstronomyMonth, K> =>
            pickOf<Pick<AstronomyMonth, K>>(Table, fields, row)
        );
    }

    /** 年表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async countYears(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 年表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countYearsBy(
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>
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
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            year.existsBy,
            bindExample(YearTable, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 年表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAllYears(
        query: Query<bigint, AstronomyYear>
    ): Promise<Page<bigint, AstronomyYear>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>> = query.example ??
        exampleOf<bigint, AstronomyYear>();
        const sort: Sort<AstronomyYear> = this.sortOf<AstronomyYear>(YearTable, query.sort);
        const text: string = year.findAll;
        const parameters: Bindings = this.bindings<AstronomyYear>(
            text,
            YearTable,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<AstronomyYear> = rows.map((row: Row): AstronomyYear =>
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
    public async findAllYearsByIdentities(
        identities: Array<bigint>
    ): Promise<Array<AstronomyYear>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(year.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): AstronomyYear => this.hydrateYear(row));
    }

    /** 年表按主键查询。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<AstronomyYear>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<AstronomyYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findYearsBy(
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>
    ): Promise<Page<bigint, AstronomyYear>> {
        const sort: Sort<AstronomyYear> = this.sortOf<AstronomyYear>(YearTable, undefined);
        const text: string = year.findBy;
        const parameters: Bindings = this.bindings<AstronomyYear>(
            text,
            YearTable,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<AstronomyYear> = rows.map((row: Row): AstronomyYear =>
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
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>,
        sort?: Sort<AstronomyYear>
    ): Promise<Optional<AstronomyYear>> {
        const ordering: Sort<AstronomyYear> = this.sortOf<AstronomyYear>(YearTable, sort);
        const text: string = year.findFirstBy;
        const parameters: Bindings = this.bindings<AstronomyYear>(
            text,
            YearTable,
            example,
            ordering
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<AstronomyYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOneYear(
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>
    ): Promise<Optional<AstronomyYear>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            year.findOne,
            bindExample(YearTable, example)
        );
        if (rows.length === 0) {
            return Optional.empty<AstronomyYear>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 astronomy_year 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<AstronomyYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /** 年表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectYearByIdentity<K extends KeyOf<AstronomyYear>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<AstronomyYear, K>>> {
        const text: string = interpolate(
            year.selectByIdentity,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<AstronomyYear, K>>()
            : Optional.of(pickOf<Pick<AstronomyYear, K>>(YearTable, fields, row));
    }

    /** 年表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectYearsBy<K extends KeyOf<AstronomyYear>>(
        example: Example<bigint, AstronomyYear, KeyOf<AstronomyYear>>,
        fields: Array<K>
    ): Promise<Array<Pick<AstronomyYear, K>>> {
        const text: string = interpolate(
            year.selectBy,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const parameters: Bindings = this.bindings<AstronomyYear>(
            text,
            YearTable,
            example,
            this.sortOf<AstronomyYear>(YearTable, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<AstronomyYear, K> =>
            pickOf<Pick<AstronomyYear, K>>(YearTable, fields, row)
        );
    }

    /**
     * 行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrate(row: Row): AstronomyMonth {
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
        } as unknown as AstronomyMonth;
    }

    /**
     * 年表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrateYear(row: Row): AstronomyYear {
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
        } as unknown as AstronomyYear;
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

/**
 * 兼容旧名字：本模块现在只有一个仓库类 AstronomyRepository（主表 astronomy_month，
 * 年表语句由 countYears / findYearByIdentity 等方法承担）。
 * 保留 AstronomyYearRepository 这个值导出，new AstronomyYearRepository() 仍然可用。
 */
export const AstronomyYearRepository: typeof AstronomyRepository = AstronomyRepository;

/** 兼容旧名字的类型别名。 */
export type AstronomyYearRepository = AstronomyRepository;
