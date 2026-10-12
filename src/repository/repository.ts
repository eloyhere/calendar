import type { Entity } from "../entity/entity";
import type { Optional } from "../share/optional";
import type { KeyOf, MaybeInvalid } from "../share/type";

type RangeOf<E, K extends keyof E> = { [P in K]?: [MaybeInvalid<E[P]>, MaybeInvalid<E[P]>] }; //[start, end). Compare with less than as start is null or undefined. Compare with greater than as end is null or undefined. Compare with equals as start === end.
type LikeOf<E, K extends keyof E> = { [P in K]?: E[P] };

export type Example<
    PK extends string | number | bigint,
    E extends Entity<PK>,
    K extends KeyOf<E> = KeyOf<E>
> = Partial<Pick<E, K>> & {
    range: RangeOf<E, K>;
    like: LikeOf<E, K>;
};

export const exampleOf: <
    PK extends string | number | bigint,
    E extends Entity<PK>,
    K extends KeyOf<E> = KeyOf<E>
>(
    range?: RangeOf<E, K>,
    like?: LikeOf<E, K>
) => Example<PK, E> = <
    PK extends string | number | bigint,
    E extends Entity<PK>,
    K extends KeyOf<E> = KeyOf<E>
>(
    range?: RangeOf<E, K>,
    like?: LikeOf<E, K>
): Example<PK, E> => {
    return {
        range: range,
        like: like
    } as Example<PK, E>;
};

export const Ascend: "Ascend" = "Ascend" as const;
export const Descend: "Descend" = "Descend" as const;
export type Direction = typeof Ascend | typeof Descend;

export interface Order<E> {
    by: KeyOf<E>;
    direction: Direction;
}
export interface Sort<E> {
    orders: Array<Order<E>>;
}

export interface Query<PK extends string | number | bigint, E extends Entity<PK>> {
    example?: Example<PK, E>;
    sort?: Sort<E>;
    index: bigint;
    size: bigint;
}

export interface Page<PK extends string | number | bigint, E extends Entity<PK>> {
    sort: Sort<E>;
    content: Array<E>;
    index: bigint;
    size: bigint;
    empty: boolean;
    pages: bigint;
    elements: bigint;
}

export interface Repository<PK extends string | number | bigint, E extends Entity<PK>> {
    name: string;

    count(): bigint;

    countBy(example: Example<PK, E>): bigint;

    existsByIdentity(identity: PK): boolean;

    existsBy(example: Example<PK, E>): boolean;

    findAll(query: Query<PK, E>): Page<PK, E>;

    findAll(query: Query<PK, E>): Page<PK, E>;

    findAllByIdentities(identitys: Array<PK>): Array<E>;

    findByIdentity(identity: PK): Optional<E>;

    findBy(example: Example<PK, E>): Page<PK, E>;

    findFirstBy(example: Example<PK, E>, sort?: Sort<E>): Optional<E>;

    findOne(example: Example<PK, E>): Optional<E>;

    selectByIdentity<K extends KeyOf<E>>(identity: PK, fields: Array<K>): Optional<Pick<E, K>>;

    selectBy<K extends KeyOf<E>>(example: Example<PK, E>, fields: Array<K>): Array<Pick<E, K>>;
}
