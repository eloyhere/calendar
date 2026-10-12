import type { Entity } from "../entity/entity";
import type { Optional } from "../share/optional";
import { Ascend, exampleOf } from "../repository/repository";
import type { Direction, Example, Order, Page, Query, Sort } from "../repository/repository";

/**
 * 查询契约再导出：service / store 层统一从本模块取用查询类型与方向常量，
 * 不必直接依赖 repository 层（分层见 docs/design.md §3）。
 */
export type { Direction, Example, Order, Page, Query, Sort } from "../repository/repository";
export { Ascend, Descend } from "../repository/repository";

/** 全库统一的实体主键：identity 即 absolute（docs/design.md §2）。 */
export type Identity = bigint;

/**
 * 同步或异步结果。
 * repository 既可能返回同步值（Repository，见 src/repository/repository.ts），
 * 也可能返回 Promise（AsyncRepository），因此 service 层一律按本类型声明依赖并 await。
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * 实体 repository 端口。
 * 方法名、参数与 src/repository/repository.ts 的 Repository 一一对应（docs/design.md §6），
 * 只把返回类型放宽为 MaybePromise，使 service 层同时兼容同步实现与异步实现。
 * 这是本层自己拥有的端口，不直接依赖 src/repository/ 的具体实现类。
 */
export interface EntityRepository<PK extends string | number | bigint, E extends Entity<PK>> {
    name: string;

    count(): MaybePromise<bigint>;

    countBy(example: Example<PK, E>): MaybePromise<bigint>;

    existsByIdentity(identity: PK): MaybePromise<boolean>;

    existsBy(example: Example<PK, E>): MaybePromise<boolean>;

    findAll(query: Query<PK, E>): MaybePromise<Page<PK, E>>;

    findAllByIdentities(identitys: Array<PK>): MaybePromise<Array<E>>;

    findByIdentity(identity: PK): MaybePromise<Optional<E>>;

    findBy(example: Example<PK, E>): MaybePromise<Page<PK, E>>;

    findFirstBy(example: Example<PK, E>, sort?: Sort<E>): MaybePromise<Optional<E>>;

    findOne(example: Example<PK, E>): MaybePromise<Optional<E>>;

    selectByIdentity<K extends keyof E>(
        identity: PK,
        fields: Array<K>
    ): MaybePromise<Optional<Pick<E, K>>>;

    selectBy<K extends keyof E>(
        example: Example<PK, E>,
        fields: Array<K>
    ): MaybePromise<Array<Pick<E, K>>>;
}

/**
 * 年表 repository 端口：模块内的第二张表（synodic_calendar_year、astronomy_year ……）。
 * 方法名与 src/repository/<module>.repository.ts 的 Year 系列方法一一对应，
 * 仍用 MaybePromise 放宽返回类型，因此同步 / 异步实现都成立。
 */
export interface YearRepository<E extends Entity<bigint>> {
    countYears(): MaybePromise<bigint>;

    existsYearByIdentity(identity: bigint): MaybePromise<boolean>;

    findYearByIdentity(identity: bigint): MaybePromise<Optional<E>>;

    findAllYears(query: Query<bigint, E>): MaybePromise<Page<bigint, E>>;

    findYearsBy(example: Example<bigint, E>): MaybePromise<Page<bigint, E>>;

    findFirstYearBy(example: Example<bigint, E>, sort?: Sort<E>): MaybePromise<Optional<E>>;

    findAllYearsByIdentities(identitys: Array<bigint>): MaybePromise<Array<E>>;
}

/**
 * 月表 repository 端口：模块内比主表更细的年 / 月表（climate 模块的 climate_month）。
 * 方法名与 src/repository/<module>.repository.ts 的 Month 系列方法一一对应，
 * 仍用 MaybePromise 放宽返回类型，因此同步 / 异步实现都成立。
 */
export interface MonthRepository<E extends Entity<bigint>> {
    countMonths(): MaybePromise<bigint>;

    existsMonthByIdentity(identity: bigint): MaybePromise<boolean>;

    findMonthByIdentity(identity: bigint): MaybePromise<Optional<E>>;

    findAllMonths(query: Query<bigint, E>): MaybePromise<Page<bigint, E>>;

    findMonthsBy(example: Example<bigint, E>): MaybePromise<Page<bigint, E>>;

    findFirstMonthBy(example: Example<bigint, E>, sort?: Sort<E>): MaybePromise<Optional<E>>;

    findAllMonthsByIdentities(identitys: Array<bigint>): MaybePromise<Array<E>>;
}

/** 查询条件的标量值：数据库列在条件里出现时的形态。 */
export type ColumnValue = string | number | bigint | boolean | null | undefined;
/**
 * 条件列名。
 * 实体接口与数据库列并非一一对应：部分列在实体里没有声明（如 phenology.kind、
 * week.month），部分列在实体里是嵌套对象而表里是外键标量（如 synodic_month.year）。
 * 故列名以 src/sql/<entity>.sql 为准（docs/design.md §3、§6），这里放开为字符串，
 * 同时保留实体自身字段的补全提示。
 */
export type ColumnName<E> = Extract<keyof E, string> | (string & {});

/** 等值条件：列 = 值。 */
export type ColumnExample<E> = Partial<Record<ColumnName<E>, ColumnValue>>;

/** 区间条件：[start, end)，对应 SQL 的 列 >= start AND 列 < end。 */
export type ColumnRange<E> = Partial<Record<ColumnName<E>, [ColumnValue, ColumnValue]>>;

/** 模糊条件：列 LIKE 模式，模式自带 % 通配符。 */
export type ColumnLike<E> = Partial<Record<ColumnName<E>, string>>;

/**
 * 构造查询条件。
 * 查询形状严格来自 src/repository/repository.ts：等值直接挂在 Example 上、
 * 区间走 range（[start, end)）、模糊走 like，不新增任何查询形状；
 * 仅把值统一收窄为标量，以适配"实体字段 ↔ 表列"的形状差异。
 */
export const criteriaOf = <PK extends string | number | bigint, E extends Entity<PK>>(
    equal?: ColumnExample<E>,
    range?: ColumnRange<E>,
    like?: ColumnLike<E>
): Example<PK, E> => {
    const example: Example<PK, E> = exampleOf<PK, E>();
    Object.assign(example, equal ?? {}, { range: range, like: like });
    return example;
};

/** 默认每页条数。 */
export const DefaultSize: bigint = 20n;

/** 构造排序：orders 的先后即优先级。 */
export const sortOf = <E>(...orders: Array<Order<E>>): Sort<E> => {
    return { orders: orders };
};

/** 构造排序项：by 是实体字段名，direction 取 Ascend / Descend。 */
export const orderOf = <E>(by: keyof E, direction: Direction = Ascend): Order<E> => {
    return { by: by, direction: direction };
};

/** 构造查询：index 是页码（从 0 开始），size 是每页条数。 */
export const queryOf = <PK extends string | number | bigint, E extends Entity<PK>>(
    index: bigint = 0n,
    size: bigint = DefaultSize,
    example?: Example<PK, E>,
    sort?: Sort<E>
): Query<PK, E> => {
    return { example: example, sort: sort, index: index, size: size };
};

/** 领域错误类别：未找到 / 结果过多 / 字段或参数非法。 */
export type ServiceErrorKind = "not-found" | "too-many-results" | "invalid-field";

/** 服务层领域错误。repository 的 Optional 缺失、条件不唯一、字段非法都以此抛出。 */
export class ServiceError extends Error {
    /** 错误类别。 */
    public readonly kind: ServiceErrorKind;

    /** 出错的实体（表）名。 */
    public readonly entity: string;

    /** 出错的字段名、主键或查询条件。 */
    public readonly detail: string;

    public constructor(kind: ServiceErrorKind, entity: string, detail: string, message?: string) {
        super(message ?? `[${kind}] ${entity}: ${detail}`);
        this.name = "ServiceError";
        this.kind = kind;
        this.entity = entity;
        this.detail = detail;
    }

    /** 唯一记录不存在。 */
    public static notFound(entity: string, detail: string): ServiceError {
        return new ServiceError(
            "not-found",
            entity,
            detail,
            `${entity} 中不存在指定的记录：${detail}`
        );
    }

    /** 期望唯一记录，却匹配到多条。 */
    public static tooManyResults(entity: string, detail: string): ServiceError {
        return new ServiceError(
            "too-many-results",
            entity,
            detail,
            `${entity} 中匹配到多条记录：${detail}`
        );
    }

    /** 字段名或查询参数非法。 */
    public static invalidField(entity: string, detail: string): ServiceError {
        return new ServiceError(
            "invalid-field",
            entity,
            detail,
            `${entity} 的字段或参数非法：${detail}`
        );
    }
}

/**
 * 标准用例：每个实体 service 都具备的一组读用例。
 * 与 docs/design.md §6 的查询契约一一对应，全部返回 Promise，调用方无需关心
 * repository 是同步还是异步实现。
 */
export interface CrudService<PK extends string | number | bigint, E extends Entity<PK>> {
    /** 记录总数。 */
    count(): Promise<bigint>;

    /** 按条件计数。 */
    countBy(example: Example<PK, E>): Promise<bigint>;

    /** 主键是否存在。 */
    exists(identity: PK): Promise<boolean>;

    /** 是否存在满足条件的记录。 */
    existsBy(example: Example<PK, E>): Promise<boolean>;

    /** 分页查询。 */
    list(query: Query<PK, E>): Promise<Page<PK, E>>;

    /** 按主键批量查询，缺失的主键自动跳过。 */
    listByIdentities(identitys: Array<PK>): Promise<Array<E>>;

    /** 按主键取唯一记录，缺失时抛 ServiceError(not-found)。 */
    get(identity: PK): Promise<E>;

    /** 按条件分页查询，无匹配时返回空页。 */
    find(example: Example<PK, E>): Promise<Page<PK, E>>;

    /** 按条件取首条，无匹配时返回未命中的 Optional。 */
    first(example: Example<PK, E>, sort?: Sort<E>): Promise<Optional<E>>;

    /** 按条件取唯一记录：0 条抛 not-found，2 条及以上抛 too-many-results。 */
    one(example: Example<PK, E>): Promise<E>;

    /** 按主键投影字段，缺失时抛 ServiceError(not-found)。 */
    select<K extends keyof E>(identity: PK, fields: Array<K>): Promise<Pick<E, K>>;

    /** 按条件投影字段，无匹配时返回空数组。 */
    selectBy<K extends keyof E>(
        example: Example<PK, E>,
        fields: Array<K>
    ): Promise<Array<Pick<E, K>>>;
}

/**
 * 抽象 service：在注入的 repository 端口之上实现 CrudService 的全部用例。
 * 所有方法都是 async 并显式 await，因此 repository 无论返回同步值还是 Promise 都成立；
 * 具体实体的 service 只需继承本类、补充自己的便利方法。
 */
export abstract class AbstractService<
    PK extends string | number | bigint,
    E extends Entity<PK>
> implements CrudService<PK, E> {
    /** 注入的 repository 端口。 */
    protected readonly repository: EntityRepository<PK, E>;

    protected constructor(repository: EntityRepository<PK, E>) {
        this.repository = repository;
    }

    /** repository 名称（一般是表名）。 */
    public get name(): string {
        return this.repository.name;
    }

    public async count(): Promise<bigint> {
        return await this.repository.count();
    }

    public async countBy(example: Example<PK, E>): Promise<bigint> {
        return await this.repository.countBy(example);
    }

    public async exists(identity: PK): Promise<boolean> {
        return await this.repository.existsByIdentity(identity);
    }

    public async existsBy(example: Example<PK, E>): Promise<boolean> {
        return await this.repository.existsBy(example);
    }

    public async list(query: Query<PK, E>): Promise<Page<PK, E>> {
        this.assertQuery(query);
        return await this.repository.findAll(query);
    }

    public async listByIdentities(identitys: Array<PK>): Promise<Array<E>> {
        return await this.repository.findAllByIdentities(identitys);
    }

    public async get(identity: PK): Promise<E> {
        const optional: Optional<E> = await this.repository.findByIdentity(identity);
        if (optional.isEmpty()) {
            throw ServiceError.notFound(this.name, `identity=${identity}`);
        }
        return optional.get();
    }

    public async find(example: Example<PK, E>): Promise<Page<PK, E>> {
        return await this.repository.findBy(example);
    }

    public async first(example: Example<PK, E>, sort?: Sort<E>): Promise<Optional<E>> {
        return await this.repository.findFirstBy(example, sort);
    }

    public async one(example: Example<PK, E>): Promise<E> {
        const total: bigint = await this.repository.countBy(example);
        if (total > 1n) {
            throw ServiceError.tooManyResults(this.name, "指定条件");
        }
        const optional: Optional<E> = await this.repository.findFirstBy(example);
        if (optional.isEmpty()) {
            throw ServiceError.notFound(this.name, "指定条件");
        }
        return optional.get();
    }

    public async select<K extends keyof E>(identity: PK, fields: Array<K>): Promise<Pick<E, K>> {
        this.assertFields(fields);
        const optional: Optional<Pick<E, K>> = await this.repository.selectByIdentity(
            identity,
            fields
        );
        if (optional.isEmpty()) {
            throw ServiceError.notFound(this.name, `identity=${identity}`);
        }
        return optional.get();
    }

    public async selectBy<K extends keyof E>(
        example: Example<PK, E>,
        fields: Array<K>
    ): Promise<Array<Pick<E, K>>> {
        this.assertFields(fields);
        return await this.repository.selectBy(example, fields);
    }

    /** 校验分页参数：index >= 0 且 size >= 1，否则抛 invalid-field。 */
    protected assertQuery(query: Query<PK, E>): void {
        if (query.index < 0n) {
            throw ServiceError.invalidField(this.name, `index=${query.index}`);
        }
        if (query.size <= 0n) {
            throw ServiceError.invalidField(this.name, `size=${query.size}`);
        }
    }

    /** 校验投影字段：不允许为空数组，否则抛 invalid-field。 */
    protected assertFields<K extends keyof E>(fields: Array<K>): void {
        if (fields.length === 0) {
            throw ServiceError.invalidField(this.name, "fields 不能为空");
        }
    }

    /** 构造等值条件：列 = 值。 */
    protected equal(equal: ColumnExample<E>): Example<PK, E> {
        return criteriaOf<PK, E>(equal);
    }

    /** 构造区间条件：[start, end)，对应 SQL 的 列 >= start AND 列 < end。 */
    protected range(column: ColumnName<E>, start: ColumnValue, end: ColumnValue): Example<PK, E> {
        const range: ColumnRange<E> = {};
        range[column] = [start, end];
        return criteriaOf<PK, E>(undefined, range);
    }

    /** 构造模糊条件：列 LIKE 模式，模式自带 % 通配符（如 `%正月%`）。 */
    protected like(like: ColumnLike<E>): Example<PK, E> {
        return criteriaOf<PK, E>(undefined, undefined, like);
    }
}
