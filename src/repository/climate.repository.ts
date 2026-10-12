/**
 * 仓库层：climate
 * 数据源：src/sqlite/climate.sqlite（一个实体一个 SQLite 文件，只访问本文件内的表，不跨库 JOIN）
 * 实体：src/entity/climate.ts
 * 表：climate, climate_year, climate_month（主表 climate 实现 AsyncRepository，年表方法见 countYears / findYearByIdentity 等，月表方法见 countMonths / findMonthByIdentity 等）
 * 语句：src/datasource/climate.sqlite.ts（主表 climate）
 *     + src/datasource/climate.year.sqlite.ts（年表 climate_year）
 *     + src/datasource/climate.month.sqlite.ts（月表 climate_month）（三者同镜像 src/sql/climate.sql）
 *
 * 契约说明：repository.ts 的 Repository 是同步契约，而数据访问层的驱动是异步的
 * （Sqlite.query 返回 Promise），二者无法同时满足，故本层实现同形的异步接口
 * AsyncRepository：方法名、参数、返回类型与 Repository 一一对应，只把返回值包成 Promise。
 *
 * 一个模块一个类：模块 climate 的三张表合并在本类里 —— 主表 climate 的 12 条语句、
 * 年表 climate_year 的 12 条语句、月表 climate_month 的 12 条语句，
 * 语句文本按表拆到 src/datasource/climate.sqlite.ts、climate.year.sqlite.ts 与 climate.month.sqlite.ts。
 *
 * 三张表的关系与主表：
 * - climate：气候。长度 5 天的单位，每个朔望月自月首起每 5 天一个，末段按月末截断。
 *   本模块唯一有行数据的表，故定为**主表**，本类对它实现 AsyncRepository。
 * - climate_year：节气纪年的年。按月相规则定建元。
 *   建表与实体完整对应；行数据需由朔望月 / 回归年换算生成，暂不物化。
 * - climate_month：节气纪年的月。按月相规则定建元。
 *   建表与实体完整对应；行数据待生成。
 */
import type { Entity } from "../entity/entity";
import type { Climate, ClimateMonth, ClimateYear } from "../entity/climate";
import { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
// 注意：src/sqlite/<entity>.sqlite 是数据库文件本体，与同名的 TS 模块冲突，
// 不带扩展名的说明符会被打包器解析成数据库文件，故这里必须显式写 .ts。
// 12 条语句在每张表下同名，故数据访问层按表拆成三个文件，各自导出一套语句。
import * as statement from "../datasource/climate.sqlite.ts";
import { ClimateSqlite } from "../datasource/climate.sqlite.ts";
import * as year from "../datasource/climate.year.sqlite.ts";
import * as month from "../datasource/climate.month.sqlite.ts";
import type { Bindings, Ordering, Row, Sqlite, StatementRunner } from "../datasource/sqlite";
import { ClimateMonthPartsAssociation } from "./climate/climate.month_parts.association";
import { ClimateMonthPhenologiesAssociation } from "./climate/climate.month_phenologies.association";
import { ClimateMonthWeeksAssociation } from "./climate/climate.month_weeks.association";
import { ClimatePartsAssociation } from "./climate/climate.parts.association";
import { ClimateWeeksAssociation } from "./climate/climate.weeks.association";
import { ClimateYearMonthsAssociation } from "./climate/climate.year_months.association";
import { ClimateYearPartsAssociation } from "./climate/climate.year_parts.association";
import { ClimateYearPhenologiesAssociation } from "./climate/climate.year_phenologies.association";
import { ClimateYearWeeksAssociation } from "./climate/climate.year_weeks.association";
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

/** 主表名：climate，identity 即主键（temporal.absolute 的绝对时间序列）。 */
const Table: string = "climate";

/** 年表名：climate_year，identity 即主键。 */
const YearTable: string = "climate_year";

/** 月表名：climate_month，identity 即主键。 */
const MonthTable: string = "climate_month";

/**
 * climate（气候 + 节气纪年）的仓库实现：主表 climate，年表 climate_year 与月表 climate_month 的方法组同在本类。
 */
export class ClimateRepository implements AsyncRepository<bigint, Climate> {

    /** 关联表 climate_month_parts（climate_year × climate_month）。 */
    public readonly climate_month_parts: ClimateMonthPartsAssociation = new ClimateMonthPartsAssociation();

    /** 关联表 climate_month_phenologies（climate_year × phenology）。 */
    public readonly climate_month_phenologies: ClimateMonthPhenologiesAssociation = new ClimateMonthPhenologiesAssociation();

    /** 关联表 climate_month_weeks（climate_year × week）。 */
    public readonly climate_month_weeks: ClimateMonthWeeksAssociation = new ClimateMonthWeeksAssociation();

    /** 关联表 climate_parts（climate_year × part）。 */
    public readonly climate_parts: ClimatePartsAssociation = new ClimatePartsAssociation();

    /** 关联表 climate_weeks（climate_month × phenology）。 */
    public readonly climate_weeks: ClimateWeeksAssociation = new ClimateWeeksAssociation();

    /** 关联表 climate_year_months（climate_month × week）。 */
    public readonly climate_year_months: ClimateYearMonthsAssociation = new ClimateYearMonthsAssociation();

    /** 关联表 climate_year_parts（climate_month × part）。 */
    public readonly climate_year_parts: ClimateYearPartsAssociation = new ClimateYearPartsAssociation();

    /** 关联表 climate_year_phenologies（climate × week）。 */
    public readonly climate_year_phenologies: ClimateYearPhenologiesAssociation = new ClimateYearPhenologiesAssociation();

    /** 关联表 climate_year_weeks（climate × part）。 */
    public readonly climate_year_weeks: ClimateYearWeeksAssociation = new ClimateYearWeeksAssociation();
    /** 仓库名，等于实体模块名；store 层按名装配。 */

    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用（供装配根 new <X>Repository()）。
     *
     * - 不给参数：用同实体的缺省 Sqlite，驱动取 sqlite.ts 的 runnerOf("climate")，
     *   由 Electron 主进程 injectRunner(runner, "climate") 注入后即可工作；未注入时查询抛中文错误。
     * - 给 Sqlite：直接使用。
     * - 给裸的 StatementRunner：自动包成同实体的 Sqlite（驱动须绑定本实体的 .sqlite 文件）。
     *
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new ClimateSqlite()) {
        this.sqlite = isSqlite(source) ? source : new ClimateSqlite(source);
        this.name = this.sqlite.name;
    }

    /** 主表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 主表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countBy(example: Example<bigint, Climate, KeyOf<Climate>>): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            statement.countBy,
            bindExample(Table, example)
        );
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 主表主键是否存在。 */
    public async existsByIdentity(identity: bigint): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.existsByIdentity, {
            identity: identity
        });
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 主表按 Example 条件判断是否存在。 */
    public async existsBy(example: Example<bigint, Climate, KeyOf<Climate>>): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            statement.existsBy,
            bindExample(Table, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 主表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAll(query: Query<bigint, Climate>): Promise<Page<bigint, Climate>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, Climate, KeyOf<Climate>> = query.example ??
        exampleOf<bigint, Climate>();
        const sort: Sort<Climate> = this.sortOf<Climate>(Table, query.sort);
        const text: string = statement.findAll;
        const parameters: Bindings = this.bindings<Climate>(
            text,
            Table,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<Climate> = rows.map((row: Row): Climate => this.hydrate(row));
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

    /** 主表按主键集合查询，按 identity 升序返回；空集合直接返回空数组。 */
    public async findAllByIdentities(identities: Array<bigint>): Promise<Array<Climate>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(statement.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): Climate => this.hydrate(row));
    }

    /** 主表按主键查询。 */
    public async findByIdentity(identity: bigint): Promise<Optional<Climate>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.findByIdentity, {
            identity: identity
        });
        return row === undefined ? Optional.empty<Climate>() : Optional.of(this.hydrate(row));
    }

    /**
     * 主表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findBy(
        example: Example<bigint, Climate, KeyOf<Climate>>
    ): Promise<Page<bigint, Climate>> {
        const sort: Sort<Climate> = this.sortOf<Climate>(Table, undefined);
        const text: string = statement.findBy;
        const parameters: Bindings = this.bindings<Climate>(
            text,
            Table,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<Climate> = rows.map((row: Row): Climate => this.hydrate(row));
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

    /** 主表按 Example 条件取首行。 */
    public async findFirstBy(
        example: Example<bigint, Climate, KeyOf<Climate>>,
        sort?: Sort<Climate>
    ): Promise<Optional<Climate>> {
        const ordering: Sort<Climate> = this.sortOf<Climate>(Table, sort);
        const text: string = statement.findFirstBy;
        const parameters: Bindings = this.bindings<Climate>(text, Table, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<Climate>() : Optional.of(this.hydrate(row));
    }

    /**
     * 主表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOne(
        example: Example<bigint, Climate, KeyOf<Climate>>
    ): Promise<Optional<Climate>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findOne,
            bindExample(Table, example)
        );
        if (rows.length === 0) {
            return Optional.empty<Climate>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 climate 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<Climate>() : Optional.of(this.hydrate(row));
    }

    /** 主表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectByIdentity<K extends KeyOf<Climate>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<Climate, K>>> {
        const text: string = interpolate(
            statement.selectByIdentity,
            ":projection",
            projectionOf(Table, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<Climate, K>>()
            : Optional.of(pickOf<Pick<Climate, K>>(Table, fields, row));
    }

    /** 主表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectBy<K extends KeyOf<Climate>>(
        example: Example<bigint, Climate, KeyOf<Climate>>,
        fields: Array<K>
    ): Promise<Array<Pick<Climate, K>>> {
        const text: string = interpolate(
            statement.selectBy,
            ":projection",
            projectionOf(Table, fields)
        );
        const parameters: Bindings = this.bindings<Climate>(
            text,
            Table,
            example,
            this.sortOf<Climate>(Table, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<Climate, K> =>
            pickOf<Pick<Climate, K>>(Table, fields, row)
        );
    }

    /** 年表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async countYears(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 年表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countYearsBy(
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>
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
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            year.existsBy,
            bindExample(YearTable, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 年表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAllYears(
        query: Query<bigint, ClimateYear>
    ): Promise<Page<bigint, ClimateYear>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, ClimateYear, KeyOf<ClimateYear>> = query.example ??
        exampleOf<bigint, ClimateYear>();
        const sort: Sort<ClimateYear> = this.sortOf<ClimateYear>(YearTable, query.sort);
        const text: string = year.findAll;
        const parameters: Bindings = this.bindings<ClimateYear>(
            text,
            YearTable,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<ClimateYear> = rows.map((row: Row): ClimateYear =>
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
    public async findAllYearsByIdentities(identities: Array<bigint>): Promise<Array<ClimateYear>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(year.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): ClimateYear => this.hydrateYear(row));
    }

    /** 年表按主键查询。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<ClimateYear>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(year.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<ClimateYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findYearsBy(
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>
    ): Promise<Page<bigint, ClimateYear>> {
        const sort: Sort<ClimateYear> = this.sortOf<ClimateYear>(YearTable, undefined);
        const text: string = year.findBy;
        const parameters: Bindings = this.bindings<ClimateYear>(
            text,
            YearTable,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<ClimateYear> = rows.map((row: Row): ClimateYear =>
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
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>,
        sort?: Sort<ClimateYear>
    ): Promise<Optional<ClimateYear>> {
        const ordering: Sort<ClimateYear> = this.sortOf<ClimateYear>(YearTable, sort);
        const text: string = year.findFirstBy;
        const parameters: Bindings = this.bindings<ClimateYear>(text, YearTable, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<ClimateYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /**
     * 年表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOneYear(
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>
    ): Promise<Optional<ClimateYear>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            year.findOne,
            bindExample(YearTable, example)
        );
        if (rows.length === 0) {
            return Optional.empty<ClimateYear>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 climate_year 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<ClimateYear>()
            : Optional.of(this.hydrateYear(row));
    }

    /** 年表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectYearByIdentity<K extends KeyOf<ClimateYear>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<ClimateYear, K>>> {
        const text: string = interpolate(
            year.selectByIdentity,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<ClimateYear, K>>()
            : Optional.of(pickOf<Pick<ClimateYear, K>>(YearTable, fields, row));
    }

    /** 年表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectYearsBy<K extends KeyOf<ClimateYear>>(
        example: Example<bigint, ClimateYear, KeyOf<ClimateYear>>,
        fields: Array<K>
    ): Promise<Array<Pick<ClimateYear, K>>> {
        const text: string = interpolate(
            year.selectBy,
            ":projection",
            projectionOf(YearTable, fields)
        );
        const parameters: Bindings = this.bindings<ClimateYear>(
            text,
            YearTable,
            example,
            this.sortOf<ClimateYear>(YearTable, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<ClimateYear, K> =>
            pickOf<Pick<ClimateYear, K>>(YearTable, fields, row)
        );
    }

    /** 月表全表行数（对应生成 SQL 的 -- name: count）。 */
    public async countMonths(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 月表按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countMonthsBy(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>
    ): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.countBy,
            bindExample(MonthTable, example)
        );
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 月表主键是否存在。 */
    public async existsMonthByIdentity(identity: bigint): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.existsByIdentity, {
            identity: identity
        });
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 月表按 Example 条件判断是否存在。 */
    public async existsMonthBy(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>
    ): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            month.existsBy,
            bindExample(MonthTable, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 月表分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAllMonths(
        query: Query<bigint, ClimateMonth>
    ): Promise<Page<bigint, ClimateMonth>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>> = query.example ??
        exampleOf<bigint, ClimateMonth>();
        const sort: Sort<ClimateMonth> = this.sortOf<ClimateMonth>(MonthTable, query.sort);
        const text: string = month.findAll;
        const parameters: Bindings = this.bindings<ClimateMonth>(
            text,
            MonthTable,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<ClimateMonth> = rows.map((row: Row): ClimateMonth =>
            this.hydrateMonth(row)
        );
        const elements: bigint = await this.countMonthsBy(example);
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

    /** 月表按主键集合查询，按 identity 升序返回；空集合直接返回空数组。 */
    public async findAllMonthsByIdentities(
        identities: Array<bigint>
    ): Promise<Array<ClimateMonth>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(month.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): ClimateMonth => this.hydrateMonth(row));
    }

    /** 月表按主键查询。 */
    public async findMonthByIdentity(identity: bigint): Promise<Optional<ClimateMonth>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(month.findByIdentity, {
            identity: identity
        });
        return row === undefined
            ? Optional.empty<ClimateMonth>()
            : Optional.of(this.hydrateMonth(row));
    }

    /**
     * 月表按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findMonthsBy(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>
    ): Promise<Page<bigint, ClimateMonth>> {
        const sort: Sort<ClimateMonth> = this.sortOf<ClimateMonth>(MonthTable, undefined);
        const text: string = month.findBy;
        const parameters: Bindings = this.bindings<ClimateMonth>(
            text,
            MonthTable,
            example,
            sort,
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<ClimateMonth> = rows.map((row: Row): ClimateMonth =>
            this.hydrateMonth(row)
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

    /** 月表按 Example 条件取首行。 */
    public async findFirstMonthBy(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>,
        sort?: Sort<ClimateMonth>
    ): Promise<Optional<ClimateMonth>> {
        const ordering: Sort<ClimateMonth> = this.sortOf<ClimateMonth>(MonthTable, sort);
        const text: string = month.findFirstBy;
        const parameters: Bindings = this.bindings<ClimateMonth>(
            text,
            MonthTable,
            example,
            ordering
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<ClimateMonth>()
            : Optional.of(this.hydrateMonth(row));
    }

    /**
     * 月表按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOneMonth(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>
    ): Promise<Optional<ClimateMonth>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            month.findOne,
            bindExample(MonthTable, example)
        );
        if (rows.length === 0) {
            return Optional.empty<ClimateMonth>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 climate_month 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined
            ? Optional.empty<ClimateMonth>()
            : Optional.of(this.hydrateMonth(row));
    }

    /** 月表按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectMonthByIdentity<K extends KeyOf<ClimateMonth>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<ClimateMonth, K>>> {
        const text: string = interpolate(
            month.selectByIdentity,
            ":projection",
            projectionOf(MonthTable, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<ClimateMonth, K>>()
            : Optional.of(pickOf<Pick<ClimateMonth, K>>(MonthTable, fields, row));
    }

    /** 月表按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectMonthsBy<K extends KeyOf<ClimateMonth>>(
        example: Example<bigint, ClimateMonth, KeyOf<ClimateMonth>>,
        fields: Array<K>
    ): Promise<Array<Pick<ClimateMonth, K>>> {
        const text: string = interpolate(
            month.selectBy,
            ":projection",
            projectionOf(MonthTable, fields)
        );
        const parameters: Bindings = this.bindings<ClimateMonth>(
            text,
            MonthTable,
            example,
            this.sortOf<ClimateMonth>(MonthTable, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<ClimateMonth, K> =>
            pickOf<Pick<ClimateMonth, K>>(MonthTable, fields, row)
        );
    }

    /**
     * 主表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 weeks）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrate(row: Row): Climate {
        return {
            identity: bigOf(row.identity),
            absolute: bigOf(row.absolute),
            relative: bigOf(row.relative),
            name: textOf(row.name),
            lengthOfDay: bigOf(row.lengthOfDay),
            lengthOfWeek: bigOf(row.lengthOfWeek),
            leap: booleanOf(row.leap),
            month: bigOf(row.month),
            start: bigOf(row.start),
            end: bigOf(row.end)
        } as unknown as Climate;
    }

    /**
     * 年表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrateYear(row: Row): ClimateYear {
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
        } as unknown as ClimateYear;
    }

    /**
     * 月表行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrateMonth(row: Row): ClimateMonth {
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
        } as unknown as ClimateMonth;
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
 * 兼容旧名字：本模块现在只有一个仓库类 ClimateRepository（主表 climate，
 * 年表语句由 countYears / findYearByIdentity 等方法承担，月表语句由 countMonths / findMonthByIdentity 等方法承担）。
 * 保留 ClimateYearRepository 这个值导出，new ClimateYearRepository() 仍然可用。
 */
export const ClimateYearRepository: typeof ClimateRepository = ClimateRepository;

/** 兼容旧名字的类型别名。 */
export type ClimateYearRepository = ClimateRepository;
