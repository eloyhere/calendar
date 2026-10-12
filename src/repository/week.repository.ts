/**
 * 仓库层：week
 * 数据源：src/sqlite/week.sqlite（一个实体一个 SQLite 文件，只访问本文件内的表，不跨库 JOIN）
 * 实体：src/entity/week.ts
 * 表：week（identity 即主键，PK = bigint）
 * 语句：src/datasource/week.sqlite.ts（镜像 src/sql/week.sql）
 *
 * 契约说明：repository.ts 的 Repository 是同步契约，而数据访问层的驱动是异步的
 * （Sqlite.query 返回 Promise），二者无法同时满足，故本层实现同形的异步接口
 * AsyncRepository：方法名、参数、返回类型与 Repository 一一对应，只把返回值包成 Promise。
 * week：星期：7 天。以建元当天所在周为第 1 周。
 */
import type { Entity } from "../entity/entity";
import type { Week } from "../entity/week";
import { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
// 注意：src/sqlite/<entity>.sqlite 是数据库文件本体，与同名的 TS 模块冲突，
// 不带扩展名的说明符会被打包器解析成数据库文件，故这里必须显式写 .ts。
import * as statement from "../datasource/week.sqlite.ts";
import { WeekSqlite } from "../datasource/week.sqlite.ts";
import type { Bindings, Ordering, Row, Sqlite, StatementRunner } from "../datasource/sqlite";
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
    projectionOf
} from "../datasource/sqlite";
import type { AsyncRepository } from "./async.repository";
import { Ascend, Descend, exampleOf } from "./repository";
import type { Example, Page, Query, Sort } from "./repository";

/** 表名：week，identity 即主键（temporal.absolute 的绝对时间序列）。 */
const Table: string = "week";

/**
 * week 的仓库实现。
 */
export class WeekRepository implements AsyncRepository<bigint, Week> {
    /** 仓库名，等于实体模块名；store 层按名装配。 */
    public readonly name: string;

    /** 数据访问对象。 */
    private readonly sqlite: Sqlite;

    /**
     * 构造：零参可用（供装配根 new <X>Repository()）。
     *
     * - 不给参数：用同实体的缺省 Sqlite，驱动取 sqlite.ts 的 runnerOf("week")，
     *   由 Electron 主进程 injectRunner(runner, "week") 注入后即可工作；未注入时查询抛中文错误。
     * - 给 Sqlite：直接使用。
     * - 给裸的 StatementRunner：自动包成同实体的 Sqlite（驱动须绑定本实体的 .sqlite 文件）。
     *
     * @param source 数据访问对象或缺省驱动。
     */
    public constructor(source: Sqlite | StatementRunner = new WeekSqlite()) {
        this.sqlite = isSqlite(source) ? source : new WeekSqlite(source);
        this.name = this.sqlite.name;
    }

    /** 全表行数（对应生成 SQL 的 -- name: count）。 */
    public async count(): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.count);
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 按 Example 条件统计行数（等值 / 区间 / 模糊三组条件与生成 SQL 一一对应）。 */
    public async countBy(example: Example<bigint, Week, KeyOf<Week>>): Promise<bigint> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            statement.countBy,
            bindExample(Table, example)
        );
        return row === undefined ? 0n : bigOf(row.count);
    }

    /** 主键是否存在。 */
    public async existsByIdentity(identity: bigint): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.existsByIdentity, {
            identity: identity
        });
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 按 Example 条件判断是否存在。 */
    public async existsBy(example: Example<bigint, Week, KeyOf<Week>>): Promise<boolean> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(
            statement.existsBy,
            bindExample(Table, example)
        );
        return row === undefined ? false : booleanOf(row.exists_);
    }

    /** 分页查询：条件取 query.example，排序取 query.sort（缺省 identity 升序）。 */
    public async findAll(query: Query<bigint, Week>): Promise<Page<bigint, Week>> {
        if (query.size <= 0n) {
            throw new RangeError("分页大小 size 必须大于 0。");
        }
        if (query.index < 0n) {
            throw new RangeError("分页下标 index 不能为负。");
        }
        const example: Example<bigint, Week, KeyOf<Week>> = query.example ??
        exampleOf<bigint, Week>();
        const sort: Sort<Week> = this.sortOf<Week>(Table, query.sort);
        const text: string = statement.findAll;
        const parameters: Bindings = this.bindings<Week>(
            text,
            Table,
            example,
            sort,
            query.size,
            query.index * query.size
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<Week> = rows.map((row: Row): Week => this.hydrate(row));
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
    public async findAllByIdentities(identities: Array<bigint>): Promise<Array<Week>> {
        if (identities.length === 0) {
            return [];
        }
        const rows: Array<Row> = await this.sqlite.query<Row>(statement.findAllByIdentities, {
            identities: identityParameter(identities)
        });
        return rows.map((row: Row): Week => this.hydrate(row));
    }

    /** 按主键查询。 */
    public async findByIdentity(identity: bigint): Promise<Optional<Week>> {
        const row: Row | undefined = await this.sqlite.queryOne<Row>(statement.findByIdentity, {
            identity: identity
        });
        return row === undefined ? Optional.empty<Week>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取单页结果：一次返回全部匹配行。
     * 生成 SQL 的 LIMIT 传 -1（SQLite 里表示不限制），故 index = 0、size = 匹配行数、pages = 1（无匹配为 0）。
     */
    public async findBy(example: Example<bigint, Week, KeyOf<Week>>): Promise<Page<bigint, Week>> {
        const sort: Sort<Week> = this.sortOf<Week>(Table, undefined);
        const text: string = statement.findBy;
        const parameters: Bindings = this.bindings<Week>(text, Table, example, sort, Unlimited, 0n);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const content: Array<Week> = rows.map((row: Row): Week => this.hydrate(row));
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
        example: Example<bigint, Week, KeyOf<Week>>,
        sort?: Sort<Week>
    ): Promise<Optional<Week>> {
        const ordering: Sort<Week> = this.sortOf<Week>(Table, sort);
        const text: string = statement.findFirstBy;
        const parameters: Bindings = this.bindings<Week>(text, Table, example, ordering);
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<Week>() : Optional.of(this.hydrate(row));
    }

    /**
     * 按 Example 条件取唯一行：无匹配返回空 Optional，命中多行抛错。
     * 生成 SQL 用 LIMIT 2 探测多行，与 JPA 的 findOne 语义一致。
     */
    public async findOne(example: Example<bigint, Week, KeyOf<Week>>): Promise<Optional<Week>> {
        const rows: Array<Row> = await this.sqlite.query<Row>(
            statement.findOne,
            bindExample(Table, example)
        );
        if (rows.length === 0) {
            return Optional.empty<Week>();
        }
        if (rows.length > 1) {
            throw new Error("findOne 命中多行：Example 条件在表 week 上不唯一。");
        }
        const row: Row | undefined = rows[0];
        return row === undefined ? Optional.empty<Week>() : Optional.of(this.hydrate(row));
    }

    /** 按主键投影指定字段；fields 先过列白名单，未知列抛 TypeError、空投影抛 TypeError。 */
    public async selectByIdentity<K extends KeyOf<Week>>(
        identity: bigint,
        fields: Array<K>
    ): Promise<Optional<Pick<Week, K>>> {
        const text: string = interpolate(
            statement.selectByIdentity,
            ":projection",
            projectionOf(Table, fields)
        );
        const row: Row | undefined = await this.sqlite.queryOne<Row>(text, { identity: identity });
        return row === undefined
            ? Optional.empty<Pick<Week, K>>()
            : Optional.of(pickOf<Pick<Week, K>>(Table, fields, row));
    }

    /** 按 Example 条件投影指定字段，一次返回全部匹配行（identity 升序，LIMIT -1）。 */
    public async selectBy<K extends KeyOf<Week>>(
        example: Example<bigint, Week, KeyOf<Week>>,
        fields: Array<K>
    ): Promise<Array<Pick<Week, K>>> {
        const text: string = interpolate(
            statement.selectBy,
            ":projection",
            projectionOf(Table, fields)
        );
        const parameters: Bindings = this.bindings<Week>(
            text,
            Table,
            example,
            this.sortOf<Week>(Table, undefined),
            Unlimited,
            0n
        );
        const rows: Array<Row> = await this.sqlite.query<Row>(text, parameters);
        return rows.map((row: Row): Pick<Week, K> => pickOf<Pick<Week, K>>(Table, fields, row));
    }

    /**
     * 行 -> 实体。
     * 表里的 start / end 是 temporal.absolute 整数、子集合（如 months）是数量，
     * 而实体里声明为 Temporal 对象与对象数组，故按表的实际存储水合，再整体断言为实体类型。
     */
    private hydrate(row: Row): Week {
        return {
            identity: bigOf(row.identity),
            absolute: bigOf(row.absolute),
            month: bigOf(row.month),
            lengthOfDay: bigOf(row.lengthOfDay),
            start: bigOf(row.start),
            end: bigOf(row.end)
        } as unknown as Week;
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
