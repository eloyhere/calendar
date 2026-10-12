import type { Entity } from "../entity/entity";
import type { Optional } from "../share/optional";
import type { KeyOf } from "../share/type";
import type { Example, Page, Query, Sort } from "./repository";

/**
 * 异步仓库契约。
 *
 * 与 `repository.ts` 的 `Repository<PK, E>` 同形：方法名、参数、返回类型一一对应，
 * 只把返回值整体包一层 `Promise`。之所以需要它：数据访问层（`src/sqlite`）的驱动是异步的
 * （`Sqlite.query` 返回 `Promise`），同步的 `Repository` 无法在其上实现，
 * 而两者不能同时满足同一个类型。
 *
 * `Repository` 本身未做任何改动；本接口是额外新增的镜像契约，
 * `src/repository/*.repository.ts` 全部实现本接口。
 */
export interface AsyncRepository<PK extends string | number | bigint, E extends Entity<PK>> {
    /** 仓库名，等于实体模块名（`store` 层按名装配）。 */
    name: string;

    /** 全表行数。 */
    count(): Promise<bigint>;

    /** 按 `Example` 条件统计行数。 */
    countBy(example: Example<PK, E>): Promise<bigint>;

    /** 主键是否存在。 */
    existsByIdentity(identity: PK): Promise<boolean>;

    /** 按 `Example` 条件判断是否存在。 */
    existsBy(example: Example<PK, E>): Promise<boolean>;

    /** 分页查询：条件、排序、`index` / `size` 分页。 */
    findAll(query: Query<PK, E>): Promise<Page<PK, E>>;

    /** 按主键集合查询。 */
    findAllByIdentities(identitys: Array<PK>): Promise<Array<E>>;

    /** 按主键查询。 */
    findByIdentity(identity: PK): Promise<Optional<E>>;

    /** 按 `Example` 条件返回单页结果。 */
    findBy(example: Example<PK, E>): Promise<Page<PK, E>>;

    /** 按 `Example` 条件取首行。 */
    findFirstBy(example: Example<PK, E>, sort?: Sort<E>): Promise<Optional<E>>;

    /** 按 `Example` 条件取唯一行；命中多行时抛错。 */
    findOne(example: Example<PK, E>): Promise<Optional<E>>;

    /** 按主键投影指定字段（字段先过列白名单）。 */
    selectByIdentity<K extends KeyOf<E>>(
        identity: PK,
        fields: Array<K>
    ): Promise<Optional<Pick<E, K>>>;

    /** 按 `Example` 条件投影指定字段（字段先过列白名单）。 */
    selectBy<K extends KeyOf<E>>(
        example: Example<PK, E>,
        fields: Array<K>
    ): Promise<Array<Pick<E, K>>>;
}
