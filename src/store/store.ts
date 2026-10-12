import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import type { Entity } from "../entity/entity";
import type { CrudService, Direction, Page, Query } from "../service/service";
import { DefaultSize, ServiceError, queryOf } from "../service/service";
import { asCrudService, resolveService } from "../service/factory";

/**
 * 可序列化值：store 状态里不允许出现 bigint，一律转成字符串。
 */
export type SerializedValue =
    string | number | boolean | null | Array<SerializedValue> | { [key: string]: SerializedValue };

/**
 * 序列化视图：把实体里的 bigint（identity、absolute、start、end …）全部替换为 string，
 * 其余结构保持不变，因此 store 状态可以直接持久化或跨进程传递。
 */
export type Serialized<T> = T extends bigint
    ? string
    : T extends Array<infer U>
      ? Array<Serialized<U>>
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/** 把任意值深度转换为可序列化值：bigint → 十进制字符串，数组与对象递归，undefined / 函数 / symbol 丢弃。 */
const convert = (value: unknown): SerializedValue => {
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map((item: unknown): SerializedValue => convert(item));
        }
        const result: { [key: string]: SerializedValue } = {};
        for (const [key, item] of Object.entries(value as { [key: string]: unknown })) {
            if (item === undefined || typeof item === "function" || typeof item === "symbol") {
                continue;
            }
            result[key] = convert(item);
        }
        return result;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    return null;
};

/** 深度序列化：bigint → 字符串；其余值按结构递归，保证返回值里不含 bigint。 */
export const serialize = <T>(value: T): Serialized<T> => {
    return convert(value) as unknown as Serialized<T>;
};

/** 从 store 持有的序列化行上取回 bigint 主键（state 里主键是字符串）。 */
export const identityOf = (item: unknown): bigint => {
    const identity = (item as { identity?: unknown } | null | undefined)?.identity;
    if (typeof identity === "bigint") {
        return identity;
    }
    if (typeof identity === "string" || typeof identity === "number") {
        return BigInt(identity);
    }
    throw ServiceError.invalidField("store", "行的 identity 无法转换为 bigint 主键");
};

/** 排序状态：可序列化的排序项。 */
export interface SortState {
    by: string;
    direction: Direction;
}

/** 分页状态：repository.Page 的可序列化投影，elements 是总行数。 */
export interface PagingState {
    index: string;
    size: string;
    pages: string;
    elements: string;
    empty: boolean;
}

/** 查询状态：当前查询条件的可序列化投影，供视图回显。 */
export interface QueryState {
    index: string;
    size: string;
    sort: Array<SortState>;
    example: { [key: string]: SerializedValue };
}

/** 加载 / 错误状态：每个 store 共用的请求态。 */
export interface LoadingState {
    loading: boolean;
    error: string | null;
}

/** 空分页状态。 */
export const emptyPaging = (): PagingState => {
    return { index: "0", size: "0", pages: "0", elements: "0", empty: true };
};

/** 空查询状态：第 0 页、默认每页条数、无排序无条件。 */
export const emptyQuery = (): QueryState => {
    return { index: "0", size: DefaultSize.toString(), sort: [], example: {} };
};

/** 把 repository.Page 投影为可序列化的分页状态。 */
export const pagingOf = <PK extends string | number | bigint, E extends Entity<PK>>(
    page?: Page<PK, E>
): PagingState => {
    if (page === undefined) {
        return emptyPaging();
    }
    return {
        index: page.index.toString(),
        size: page.size.toString(),
        pages: page.pages.toString(),
        elements: page.elements.toString(),
        empty: page.empty
    };
};

/** 把 repository.Query 投影为可序列化的查询状态。 */
export const queryStateOf = <PK extends string | number | bigint, E extends Entity<PK>>(
    query?: Query<PK, E>
): QueryState => {
    if (query === undefined) {
        return emptyQuery();
    }
    return {
        index: query.index.toString(),
        size: query.size.toString(),
        sort: (query.sort?.orders ?? []).map((order): SortState => {
            return { by: String(order.by), direction: order.direction };
        }),
        example: serialize(query.example ?? {}) as unknown as { [key: string]: SerializedValue }
    };
};

/** service 来源：可直接注入实例，缺省时由默认服务工厂按模块名解析。 */
export type ServiceSource<PK extends string | number | bigint, E extends Entity<PK>> =
    CrudService<PK, E> | undefined;

/** 行缓存默认容量：条数。 */
export const DefaultRowCapacity = 512;

/** 分页缓存默认容量：页数。 */
export const DefaultPageCapacity = 64;

/**
 * 缓存配置。
 *
 * 数据是**构建期产物**（`src/sqlite/*.sqlite` 由 calendar.xlsx 离线构建），
 * 运行期 repository 只有读用例，因此缓存不设 TTL：只按容量淘汰（LRU），
 * 本地写入（create / replace）时主动失效。容量 <= 0 表示关闭该类缓存。
 */
export interface CacheOptions {
    /** 行缓存容量（条），缺省 {@link DefaultRowCapacity}。 */
    rows?: number;
    /** 分页缓存容量（页），缺省 {@link DefaultPageCapacity}。 */
    pages?: number;
    /** 是否缓存总数，缺省缓存。 */
    total?: boolean;
}

/** 缓存统计：命中 / 未命中 / 当前条目数，供视图展示与排查。 */
export interface CacheStats {
    /** 行缓存当前条数。 */
    rows: number;
    /** 分页缓存当前页数。 */
    pages: number;
    /** 行缓存容量。 */
    rowCapacity: number;
    /** 分页缓存容量。 */
    pageCapacity: number;
    /** 行命中次数。 */
    rowHits: number;
    /** 行未命中次数。 */
    rowMisses: number;
    /** 分页命中次数。 */
    pageHits: number;
    /** 分页未命中次数。 */
    pageMisses: number;
    /** 总数命中次数。 */
    totalHits: number;
    /** 总数未命中次数。 */
    totalMisses: number;
    /** 进行中的回源请求数。 */
    pending: number;
    /** 总数是否已缓存。 */
    total: boolean;
}

/** 分页缓存的一页：只存主键与分页状态，行仍由行缓存持有，避免同一行存两份。 */
interface CachedPage {
    /** 该页各行的主键（十进制字符串，与行缓存的键同形）。 */
    identities: Array<string>;
    /** 该页的分页状态。 */
    paging: PagingState;
}

/** 规范化：对象键排序后序列化，保证同一个查询永远得到同一个指纹。 */
const canonical = (value: unknown): string => {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value ?? null) ?? "null";
    }
    if (Array.isArray(value)) {
        return "[" + value.map((item: unknown): string => canonical(item)).join(",") + "]";
    }
    const entries: Array<[string, unknown]> = Object.entries(value as { [key: string]: unknown })
        .filter(([, item]: [string, unknown]): boolean => item !== undefined)
        .sort(([left]: [string, unknown], [right]: [string, unknown]): number =>
            left < right ? -1 : left > right ? 1 : 0
        );
    const parts: Array<string> = entries.map(
        ([key, item]: [string, unknown]): string => JSON.stringify(key) + ":" + canonical(item)
    );
    return "{" + parts.join(",") + "}";
};

/** 查询指纹：条件 + 排序 + 页码 + 每页条数。 */
const fingerprintOf = <PK extends string | number | bigint, E extends Entity<PK>>(
    query: Query<PK, E>
): string => {
    return canonical({
        example: serialize(query.example ?? {}),
        sort: (query.sort?.orders ?? []).map((order): Array<string> => [
            String(order.by),
            order.direction
        ]),
        index: query.index.toString(),
        size: query.size.toString()
    });
};

/** 读缓存并把命中的条目移到最新端（LRU 的"用过就年轻"）。 */
const look = <V>(cache: Map<string, V>, key: string): V | undefined => {
    const found: V | undefined = cache.get(key);
    if (found !== undefined) {
        cache.delete(key);
        cache.set(key, found);
    }
    return found;
};

/** 写缓存并淘汰最久未用的条目，直到不超过容量。 */
const keep = <V>(cache: Map<string, V>, key: string, value: V, capacity: number): void => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > capacity) {
        const oldest: IteratorResult<string> = cache.keys().next();
        if (oldest.done === true) {
            break;
        }
        cache.delete(oldest.value);
    }
};

/**
 * 创建实体 store（Pinia setup store）——**它是一个读穿缓存**，不是每次穿透的请求壳。
 *
 * 缓存三样东西（容量可配，仅内存，见 {@link CacheOptions}）：
 *
 * 1. **行缓存**：`identity -> 整行`（序列化），`loadByIdentity` 命中直接返回，不回源；
 * 2. **分页缓存**：`查询指纹 -> 该页主键 + 分页状态`，`load` 命中直接从行缓存拼回整页；
 * 3. **总数缓存**：`count()` 命中直接返回，不再打库。
 *
 * 另外还有两条与缓存配套的机制：
 *
 * - **并发合并**：同一个键（同一行 / 同一页 / 同一批预取 / 总数）的并发请求合并成一个 Promise，
 *   后到的调用复用先到的结果，不会把同一份数据打多遍；
 * - **LRU 淘汰**：行与分页各自有容量上限，超出时淘汰最久未用的条目；
 *   分页缓存只存主键，行被淘汰后该页会在下次 `load` 时自动回源重建。
 *
 * 数据运行期只读，所以不设 TTL；本地写入（`create` / `replace`）时：写穿行缓存、
 * 清空分页缓存（本地改动会改变任何一页的内容）、若主键此前不在缓存里则丢弃总数缓存。
 * `reset()` 只清视图状态，**不动缓存**；要清缓存用 `invalidate()` / `invalidateAll()`。
 *
 * store 只调用 service 层，不接触 repository / sqlite 层；状态中不含 bigint
 * （items / current 是序列化行，page / query 是分页与查询状态）。
 * 返回的函数可直接当 useXStore 用：入参是可选注入的 service，
 * 省略时由 DEFAULT_SERVICE_FACTORY 惰性解析；解析失败只记录 error，不抛异常。
 */
export const defineEntityStore = <PK extends string | number | bigint, E extends Entity<PK>>(
    id: string,
    injected?: ServiceSource<PK, E>,
    options?: CacheOptions
) => {
    const rowCapacity: number = options?.rows ?? DefaultRowCapacity;
    const pageCapacity: number = options?.pages ?? DefaultPageCapacity;
    const cacheTotal: boolean = options?.total ?? true;

    return (service?: ServiceSource<PK, E>) => {
        const provided: ServiceSource<PK, E> = service ?? injected;

        return defineStore(id, () => {
            /** 已解析的 service。 */
            let instance: CrudService<PK, E> | undefined = undefined;

            /** 上一次查询条件，供 load() 无参重载；不放入响应式状态，因此不影响可序列化。 */
            let last: Query<PK, E> | undefined;

            /**
             * 当前页数据（序列化行，bigint 已转字符串）。
             * 用 shallowRef：行是纯数据、整体替换，既避免 Vue 的深层解包改写类型，
             * 也保证状态里只有可序列化的标量。
             */
            const items = shallowRef<Array<Serialized<E>>>([]);

            /** 当前单条记录（序列化行）。 */
            const current = shallowRef<Serialized<E> | null>(null);

            /** 分页状态：page.elements 是总行数。 */
            const page = ref<PagingState>(emptyPaging());

            /** 查询状态。 */
            const query = ref<QueryState>(emptyQuery());

            /** 是否正在请求。 */
            const loading = ref(false);

            /** 最近一次错误信息，无错误时为 null。 */
            const error = ref<string | null>(null);

            /** 行缓存：主键（十进制字符串）-> 整行。 */
            const rows = new Map<string, Serialized<E>>();

            /** 分页缓存：查询指纹 -> 该页主键与分页状态。 */
            const pages = new Map<string, CachedPage>();

            /** 总数缓存；undefined 表示尚未缓存或已失效。 */
            let total: bigint | undefined = undefined;

            /** 进行中的回源请求：缓存键 -> Promise，用于并发合并。 */
            const pending = new Map<string, Promise<unknown>>();

            /** 命中与未命中计数。 */
            const hits: { row: number; page: number; total: number } = {
                row: 0,
                page: 0,
                total: 0
            };
            const misses: { row: number; page: number; total: number } = {
                row: 0,
                page: 0,
                total: 0
            };

            /**
             * 取 service：优先用注入的实例，否则向默认服务工厂按模块名解析。
             * 解析失败时抛错，由 guard 统一写入中文错误信息，store 保持空状态。
             */
            const require = async (): Promise<CrudService<PK, E>> => {
                if (instance !== undefined) {
                    return instance;
                }
                if (provided !== undefined) {
                    instance = provided;
                    return instance;
                }
                const candidate: unknown = await resolveService(id);
                const resolved: CrudService<PK, E> | null = asCrudService<PK, E>(candidate);
                if (resolved === null) {
                    throw new Error(
                        `无法解析 ${id} 模块的 service：默认服务工厂未返回可用实例（src/service/${id}.service.ts 或 src/repository/${id}.repository.ts 缺失或构造失败）`
                    );
                }
                instance = resolved;
                return instance;
            };

            /**
             * 统一包装加载动作：维护 loading，把失败信息写入 error 后原样抛出，
             * 调用方既可读 store.error，也可自己 try/catch 出提示。
             */
            const guard = async <R>(task: () => Promise<R>): Promise<R> => {
                loading.value = true;
                error.value = null;
                try {
                    return await task();
                } catch (cause: unknown) {
                    error.value = cause instanceof Error ? cause.message : String(cause);
                    throw cause;
                } finally {
                    loading.value = false;
                }
            };

            /** 与 guard 相同，但把失败折叠为 null：用于返回可选值、不打断调用方的动作。 */
            const guardOrNull = async <R>(task: () => Promise<R>): Promise<R | null> => {
                try {
                    return await guard(task);
                } catch {
                    return null;
                }
            };

            /** 缓存键：主键统一转成十进制字符串（与状态里的 identity 同形）。 */
            const keyOf = (identity: PK): string => identity.toString();

            /** 并发合并：同一个键的请求共用一个 Promise，先到的负责回源。 */
            const share = <R>(key: string, task: () => Promise<R>): Promise<R> => {
                const running: Promise<R> | undefined = pending.get(key) as Promise<R> | undefined;
                if (running !== undefined) {
                    return running;
                }
                const started: Promise<R> = task().finally((): void => {
                    pending.delete(key);
                });
                pending.set(key, started);
                return started;
            };

            /** 写入行缓存（容量 <= 0 时关闭行缓存）。 */
            const remember = (identity: PK, row: Serialized<E>): void => {
                if (rowCapacity > 0) {
                    keep(rows, keyOf(identity), row, rowCapacity);
                }
            };

            /** 批量写入行缓存。 */
            const rememberAll = (batch: Array<Serialized<E>>): void => {
                for (const row of batch) {
                    remember(identityOf(row) as PK, row);
                }
            };

            /** 按主键列表拼回整页；有任何一行不在行缓存里就返回 null（调用方回源）。 */
            const hydrate = (identities: Array<string>): Array<Serialized<E>> | null => {
                const hydrated: Array<Serialized<E>> = [];
                for (const identity of identities) {
                    const row: Serialized<E> | undefined = rows.get(identity);
                    if (row === undefined) {
                        return null;
                    }
                    hydrated.push(row);
                }
                return hydrated;
            };

            /** 本地写入（create / replace）之后的缓存维护。 */
            const afterLocalWrite = (identity: PK, row: Serialized<E>): void => {
                const known: boolean = rows.has(keyOf(identity));
                remember(identity, row);
                pages.clear();
                if (!known) {
                    total = undefined;
                }
            };

            /**
             * 按查询加载一页，写入 items / page / query。
             * **命中分页缓存时直接从行缓存拼回整页，不回源**；未命中才走 service。
             * 省略入参时复用上一次查询（首次为默认查询：第 0 页、每页 DefaultSize 条）。
             * 失败时写入 error 并抛出，调用方需自行捕获或检查 error。
             */
            const load = async (input?: Query<PK, E>): Promise<void> => {
                const target: Query<PK, E> = input ?? last ?? queryOf<PK, E>();
                last = target;
                query.value = queryStateOf(target);

                const fingerprint: string = fingerprintOf(target);
                const cached: CachedPage | undefined =
                    pageCapacity > 0 ? look(pages, fingerprint) : undefined;
                if (cached !== undefined) {
                    const hydrated: Array<Serialized<E>> | null = hydrate(cached.identities);
                    if (hydrated !== null) {
                        hits.page += 1;
                        items.value = hydrated;
                        page.value = cached.paging;
                        error.value = null;
                        return;
                    }
                }
                misses.page += 1;

                await guard(async (): Promise<void> => {
                    const service: CrudService<PK, E> = await require();
                    const result: Page<PK, E> = await share(
                        `page:${fingerprint}`,
                        async (): Promise<Page<PK, E>> => await service.list(target)
                    );
                    const content: Array<Serialized<E>> = result.content.map(
                        (item: E): Serialized<E> => serialize(item)
                    );
                    items.value = content;
                    page.value = pagingOf(result);
                    rememberAll(content);
                    if (pageCapacity > 0) {
                        keep(
                            pages,
                            fingerprint,
                            {
                                identities: content.map(
                                    (item: Serialized<E>): string => keyOf(identityOf(item) as PK)
                                ),
                                paging: page.value
                            },
                            pageCapacity
                        );
                    }
                });
            };

            /**
             * 按主键加载单条记录到 current；**命中行缓存时直接返回，不回源**。
             * 未找到时 current 为 null，写入 error 并抛出（"不存在"不进入缓存，下次仍会回源）。
             */
            const loadByIdentity = async (identity: PK): Promise<void> => {
                const key: string = keyOf(identity);
                const cached: Serialized<E> | undefined =
                    rowCapacity > 0 ? look(rows, key) : undefined;
                if (cached !== undefined) {
                    hits.row += 1;
                    current.value = cached;
                    error.value = null;
                    return;
                }
                misses.row += 1;
                current.value = null;
                await guard(async (): Promise<void> => {
                    const service: CrudService<PK, E> = await require();
                    const fetched: Serialized<E> = serialize(
                        await share(`row:${key}`, async (): Promise<E> => await service.get(identity))
                    );
                    current.value = fetched;
                    remember(identity, fetched);
                });
            };

            /**
             * 新增：以 identity 为键写入 items 头部（同主键则覆盖），并设为 current。
             * repository 层只提供读用例，因此这里只更新 store 持有的行，不落库；
             * 缓存侧按 afterLocalWrite 维护（写穿行缓存、清分页缓存、必要时丢总数）。
             */
            const create = (item: E | Serialized<E>): Serialized<E> => {
                const stored: Serialized<E> = serialize(item as E);
                const identity: bigint = identityOf(stored);
                const index: number = items.value.findIndex(
                    (each: Serialized<E>): boolean => identityOf(each) === identity
                );
                if (index < 0) {
                    items.value = [stored, ...items.value];
                } else {
                    items.value = items.value.map(
                        (each: Serialized<E>, at: number): Serialized<E> =>
                            at === index ? stored : each
                    );
                }
                current.value = stored;
                afterLocalWrite(identity as PK, stored);
                return stored;
            };

            /**
             * 替换：同主键则原位替换，否则追加到 items 末尾，并设为 current。
             * 与 create 一样只更新 store 状态，不落库；缓存维护同 afterLocalWrite。
             */
            const replace = (item: E | Serialized<E>): Serialized<E> => {
                const stored: Serialized<E> = serialize(item as E);
                const identity: bigint = identityOf(stored);
                const index: number = items.value.findIndex(
                    (each: Serialized<E>): boolean => identityOf(each) === identity
                );
                if (index < 0) {
                    items.value = [...items.value, stored];
                } else {
                    items.value = items.value.map(
                        (each: Serialized<E>, at: number): Serialized<E> =>
                            at === index ? stored : each
                    );
                }
                current.value = stored;
                afterLocalWrite(identity as PK, stored);
                return stored;
            };

            /**
             * 按主键投影字段。若该行已在行缓存里，**直接在本地取字段**，连 projection SQL 都不用发；
             * 否则回源（投影不完整，故不写回行缓存）。
             * 未找到或失败时返回 null 并记录 error。
             */
            const select = async <K extends keyof E>(
                identity: PK,
                fields: Array<K>
            ): Promise<Serialized<Pick<E, K>> | null> => {
                const key: string = keyOf(identity);
                const cached: Serialized<E> | undefined =
                    rowCapacity > 0 ? look(rows, key) : undefined;
                if (cached !== undefined) {
                    hits.row += 1;
                    const source: { [key: string]: SerializedValue } = cached as unknown as {
                        [key: string]: SerializedValue;
                    };
                    const picked: { [key: string]: SerializedValue } = {};
                    for (const field of fields) {
                        picked[String(field)] = source[String(field)] ?? null;
                    }
                    return picked as unknown as Serialized<Pick<E, K>>;
                }
                misses.row += 1;
                const signature: string = `${key}:${fields.map(String).join(",")}`;
                return await guardOrNull(async (): Promise<Serialized<Pick<E, K>>> => {
                    const service: CrudService<PK, E> = await require();
                    return serialize(
                        await share(
                            `select:${signature}`,
                            async (): Promise<Pick<E, K>> => await service.select(identity, fields)
                        )
                    );
                });
            };

            /**
             * 记录总数：**命中总数缓存时直接返回**，否则回源并缓存。
             * 两种路径都会把总行数写入 page.elements；失败时返回 null 并记录 error。
             */
            const count = async (): Promise<bigint | null> => {
                if (cacheTotal && total !== undefined) {
                    hits.total += 1;
                    page.value = { ...page.value, elements: total.toString() };
                    return total;
                }
                misses.total += 1;
                const fetched: bigint | null = await guardOrNull(async (): Promise<bigint> => {
                    const service: CrudService<PK, E> = await require();
                    return await share("count", async (): Promise<bigint> => await service.count());
                });
                if (fetched === null) {
                    return null;
                }
                if (cacheTotal) {
                    total = fetched;
                }
                page.value = { ...page.value, elements: fetched.toString() };
                return fetched;
            };

            /**
             * 预取：把尚未缓存的主键一次性取回来塞进行缓存（service.listByIdentities）。
             * 返回本次真正取回的行数；全部已缓存时不发请求。
             */
            const prefetch = async (identities: Array<PK>): Promise<number> => {
                if (rowCapacity <= 0 || identities.length === 0) {
                    return 0;
                }
                const missing: Array<PK> = identities.filter(
                    (identity: PK): boolean => !rows.has(keyOf(identity))
                );
                if (missing.length === 0) {
                    return 0;
                }
                const signature: string = canonical(
                    missing.map((identity: PK): string => keyOf(identity)).sort()
                );
                const fetched: Array<E> | null = await guardOrNull(
                    async (): Promise<Array<E>> => {
                        const service: CrudService<PK, E> = await require();
                        return await share(
                            `prefetch:${signature}`,
                            async (): Promise<Array<E>> => await service.listByIdentities(missing)
                        );
                    }
                );
                if (fetched === null) {
                    return 0;
                }
                const batch: Array<Serialized<E>> = fetched.map(
                    (item: E): Serialized<E> => serialize(item)
                );
                rememberAll(batch);
                return batch.length;
            };

            /** 同步窥看行缓存：命中返回序列化行，否则 null（不发请求）。 */
            const cachedRow = (identity: PK): Serialized<E> | null => {
                const found: Serialized<E> | undefined = rows.get(keyOf(identity));
                return found ?? null;
            };

            /** 该主键是否已在行缓存里（不发请求）。 */
            const hasRow = (identity: PK): boolean => rows.has(keyOf(identity));

            /** 失效：给主键则只丢那一行，不给则清空全部缓存（行 + 分页 + 总数）。 */
            const invalidate = (identity?: PK): void => {
                if (identity === undefined) {
                    invalidateAll();
                    return;
                }
                rows.delete(keyOf(identity));
            };

            /** 清空全部缓存：行、分页、总数。进行中的请求不受影响，回来后仍会写入缓存。 */
            const invalidateAll = (): void => {
                rows.clear();
                pages.clear();
                total = undefined;
            };

            /** 缓存统计：条目数、容量、命中 / 未命中、进行中的请求数。 */
            const stats = (): CacheStats => {
                return {
                    rows: rows.size,
                    pages: pages.size,
                    rowCapacity: rowCapacity,
                    pageCapacity: pageCapacity,
                    rowHits: hits.row,
                    rowMisses: misses.row,
                    pageHits: hits.page,
                    pageMisses: misses.page,
                    totalHits: hits.total,
                    totalMisses: misses.total,
                    pending: pending.size,
                    total: total !== undefined
                };
            };

            /**
             * 重置**视图状态**：清空 items / current / page / query 与 loading / error。
             * 缓存（行 / 分页 / 总数）刻意保留 —— 它就是这个 store 存在的意义；
             * 要连缓存一起清，用 invalidateAll()。
             */
            const reset = (): void => {
                items.value = [];
                current.value = null;
                page.value = emptyPaging();
                query.value = emptyQuery();
                loading.value = false;
                error.value = null;
                last = undefined;
            };

            return {
                items,
                current,
                page,
                query,
                loading,
                error,
                load,
                loadByIdentity,
                create,
                replace,
                select,
                count,
                prefetch,
                cachedRow,
                hasRow,
                invalidate,
                invalidateAll,
                stats,
                reset,
                identityOf
            };
        })();
    };
};
