/**
 * 分库数据的页面级取数。
 *
 * ## 为什么不用 `src/store/store.ts` 的实体 store
 *
 * `defineEntityStore` 是**读穿缓存**：它假设"一个实体一套表、一组固定的 12 条查询"，
 * 适合历表那种逐行读取。而本项目的页面主要在做**聚合**——工作台要"每个分库多少行"、
 * 历法简介要"这套历法的年表头几行长什么样"、数据页要"任意一张表的前 N 行"。
 * 这些查询没有对应的实体方法，硬套实体 store 会先编一个假 service。
 *
 * 所以这一层直接走 `src/datasource/runner.ts` 的直查口子（它已经在主进程那侧
 * 保证了白名单、只读与行数上限），并把**加载状态**统一成 `PageShell` 认识的四种。
 *
 * ## 状态
 *
 * 与 `PageShell` 的 `state` 一一对应：
 *
 * | 状态      | 什么时候                                                        |
 * | --------- | --------------------------------------------------------------- |
 * | `loading` | 首次请求未返回                                                   |
 * | `empty`   | 请求成功但零行——**不是错误**（`docs/design.md` §3 有一批零行表） |
 * | `error`   | 分库打不开、语句被拒、驱动未注入                                 |
 * | `ready`   | 有行                                                             |
 *
 * 这一分法来自 `docs/research.md` §3 第 7 条（"空态与错误必须分开"）——它当时是
 * 深度研究页的一条规矩，这里是它的推广。
 */

import { computed, ref, shallowRef, watch } from "vue";
import type { ComputedRef, Ref } from "vue";

import type { Row } from "../datasource/sqlite";
import { bigOf } from "../datasource/sqlite";
import {
    queryModule,
    queryModuleOne,
    readModuleStates,
    readTableColumns
} from "../datasource/runner";
import type { CalendarColumnInfo, CalendarModuleState } from "../../shared/calendar-api";

/** `PageShell` 认识的四种状态。 */
export type LoadState = "loading" | "ready" | "empty" | "error";

/** 一次取数的结果。 */
export interface QueryResult<TRow> {
    /** 行 */
    rows: Ref<TRow[]>;
    /** 页面状态 */
    state: ComputedRef<LoadState>;
    /** 出错时的一句话 */
    error: Ref<string>;
    /** 重新取一次 */
    reload: () => void;
}

/** 把任意异常收成一句人读的说明。 */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** 语句来源：字面量、`null`，或一个 getter（跟着响应式依赖重算）。 */
export type StatementSource = string | null | (() => string | null);

/** 解出语句文本。 */
const resolveStatement = (source: StatementSource): string | null =>
    typeof source === "function" ? source() : source;

/**
 * 跑一条聚合查询。
 *
 * @param module 分库模块名（必须是登记过的 22 个之一）
 * @param statement SQL；`null` 表示这次不查（依赖还没就绪，例如 `:system` 参数非法）；
 *                  传 getter 时**依赖变化会重查**
 * @param parameters 具名参数。**返回 getter**，让它跟着响应式依赖一起重算
 */
export function useQuery<TRow extends Row = Row>(
    module: string,
    statement: StatementSource,
    parameters: () => Record<string, bigint | number | string | null> = () => ({})
): QueryResult<TRow> {
    const cell = shallowRef<TRow[]>([]) as Ref<TRow[]>;
    const error = ref("");
    const loading = ref(false);

    /** 递增的请求号：并发请求回来时只有最后一次的结果算数。 */
    let sequence = 0;

    const reload = (): void => {
        const sql = resolveStatement(statement);
        if (sql === null) {
            cell.value = [];
            error.value = "";
            return;
        }

        sequence += 1;
        const current = sequence;
        loading.value = true;

        void queryModule(module, statement, parameters())
            .then((result) => {
                // 回来的不是最新一次请求就丢掉：切体系时两条查询会并发，
                // 慢的那条后到会把新体系的数据覆盖成旧体系的。
                if (current !== sequence) {
                    return;
                }
            cell.value = result as TRow[];
                error.value = "";
            })
            .catch((cause: unknown) => {
                if (current !== sequence) {
                    return;
                }
            cell.value = [];
                error.value = messageOf(cause);
            })
            .finally(() => {
                if (current === sequence) {
                    loading.value = false;
                }
            });
    };

    /*
     * 依赖变化就重取。
     *
     * 依赖的是语句文本与参数**序列化后的字符串**：参数是一个对象字面量，
     * 每次渲染都是新引用，直接 watch 它会在每次重渲染时重查一次。
     */
    watch(
        () => [
            resolveStatement(statement),
            JSON.stringify(parameters(), (_key, value) =>
                typeof value === "bigint" ? value.toString() : value
            )
        ],
        () => reload(),
        { immediate: true }
    );

    const state = computed<LoadState>(() => {
        if (loading.value) {
            return "loading";
        }
        if (error.value.length > 0) {
            return "error";
        }
        return cell.value.length === 0 ? "empty" : "ready";
    });

    return { rows: cell, state, error, reload };
}

/** 单行版本。 */
export interface QueryOneResult<TRow> {
    row: Ref<TRow | null>;
    state: ComputedRef<LoadState>;
    error: Ref<string>;
    reload: () => void;
}

export function useQueryOne<TRow extends Row = Row>(
    module: string,
    statement: string | null,
    parameters: () => Record<string, bigint | number | string | null> = () => ({})
): QueryOneResult<TRow> {
    const cell = ref<TRow | null>(null) as Ref<TRow | null>;
    const error = ref("");
    const loading = ref(false);
    let sequence = 0;

    const reload = (): void => {
        if (statement === null) {
            cell.value = null;
            return;
        }
        sequence += 1;
        const current = sequence;
        loading.value = true;

        void queryModuleOne(module, statement, parameters())
            .then((result) => {
                if (current !== sequence) {
                    return;
                }
                cell.value = result as TRow | null;
                error.value = "";
            })
            .catch((cause: unknown) => {
                if (current !== sequence) {
                    return;
                }
                cell.value = null;
                error.value = messageOf(cause);
            })
            .finally(() => {
                if (current === sequence) {
                    loading.value = false;
                }
            });
    };

    watch(
        () => [statement, JSON.stringify(parameters(), (_key, value) => (typeof value === "bigint" ? value.toString() : value))],
        () => reload(),
        { immediate: true }
    );

    const state = computed<LoadState>(() => {
        if (loading.value) {
            return "loading";
        }
        if (error.value.length > 0) {
            return "error";
        }
        return cell.value === null ? "empty" : "ready";
    });

    return { row: cell, state, error, reload };
}

/* -------------------------------------------------------------------------- */
/* 表的列                                                                      */
/* -------------------------------------------------------------------------- */

/** 取一张表的列。表名由主进程按分库登记表白名单校验（见 `main/database.ts`）。 */
export function useTableColumns(
    module: string,
    table: () => string
): { columns: Ref<CalendarColumnInfo[]>; error: Ref<string> } {
    const columns = shallowRef<CalendarColumnInfo[]>([]);
    const error = ref("");

    watch(
        () => [module, table()] as const,
        ([currentModule, currentTable]) => {
            if (currentTable.length === 0) {
                columns.value = [];
                return;
            }
            void readTableColumns(currentModule, currentTable)
                .then((result) => {
                    columns.value = [...result];
                    error.value = "";
                })
                .catch((cause: unknown) => {
                    columns.value = [];
                    error.value = messageOf(cause);
                });
        },
        { immediate: true }
    );

    return { columns, error };
}

/* -------------------------------------------------------------------------- */
/* 分库状态                                                                    */
/* -------------------------------------------------------------------------- */

/** 分库状态的缓存：整个会话只查一次（22 次 `COUNT(*)`，不必每页重来）。 */
const moduleStates = shallowRef<CalendarModuleState[]>([]);
const moduleStatesLoaded = ref(false);
const moduleStatesError = ref("");

/** 分库状态的返回值。 */
export interface ModuleStatesApi {
    states: Ref<CalendarModuleState[]>;
    state: ComputedRef<LoadState>;
    error: Ref<string>;
    reload: () => void;
}

/**
 * 读 22 个分库的实时状态。
 *
 * 同一个会话里只真正查一次；第二次调用直接返回缓存。
 * 需要强制刷新时用返回的 `reload`（`/system/datasource` 上有刷新按钮）。
 */
export function useModuleStates(): ModuleStatesApi {
    const load = (): void => {
        moduleStatesLoaded.value = false;
        void readModuleStates()
            .then((result) => {
                moduleStates.value = [...result];
                moduleStatesError.value = "";
            })
            .catch((cause: unknown) => {
                moduleStates.value = [];
                moduleStatesError.value = messageOf(cause);
            })
            .finally(() => {
                moduleStatesLoaded.value = true;
            });
    };

    if (!moduleStatesLoaded.value && moduleStatesError.value.length === 0 && moduleStates.value.length === 0) {
        load();
    }

    const state = computed<LoadState>(() => {
        if (!moduleStatesLoaded.value) {
            return "loading";
        }
        if (moduleStatesError.value.length > 0) {
            return "error";
        }
        return moduleStates.value.length === 0 ? "empty" : "ready";
    });

    return { states: moduleStates, state, error: moduleStatesError, reload: load };
}

/* -------------------------------------------------------------------------- */
/* 值处理                                                                      */
/* -------------------------------------------------------------------------- */

/** 行里的整数列取成 `bigint`。`COUNT(*)` 之类的聚合结果用它。 */
export const countOf = (row: Row | null, column = "n"): bigint =>
    row === null ? 0n : bigOf(row[column]);

/** 行里的整数列取成 `number`（界面上显示用；超过 2^53 的值见 `bigOf` 的说明）。 */
export const numberOf = (value: Row[string] | undefined): number => Number(bigOf(value ?? null));

/** 行里的文本列。 */
export const textOf = (value: Row[string] | undefined): string =>
    value === null || value === undefined ? "" : String(value);

/** 千分位。 */
export const formatCount = (value: number | bigint): string =>
    Number(value).toLocaleString("en-US");
