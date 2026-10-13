/**
 * 表格页的 SQL 构造：把一个分库的一张表渲染成可筛选的表格。
 *
 * ## 为什么这几页共用一套构造
 *
 * `docs/ui-architecture.md` §6.4 里，年表的四页（建元 / 节气 / 月相 / 回归年）
 * 形状完全相同：一句口径 + 一张可筛选的表。它们之间的差异**只在数据源与列名**，
 * 而那两样写在 `ChronologyPage.vue` 的登记表里。如果把查询也一页一页复制，
 * "筛选状态要不要显示""首列放什么"这些规则就会有四份实现。
 *
 * ## 只做只读查询，且只列白名单列
 *
 * 列名是**拼进 SQL** 的（列名不能作为绑定参数），所以每个使用点都要自己保证
 * 来源可信：这里一律取 `PRAGMA table_info` 的结果（主进程按分库登记表校验过表名），
 * 再拼进语句——用户输入永远只进绑定参数。
 */

import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";

import type { TableColumn } from "../component/data/table-column";
import { isNumericType, PRIMARY_COLUMN_CANDIDATES } from "../component/data/table-column";
import type { Row } from "../datasource/sqlite";
import type { LoadState } from "../state/use-calendar-query";
import { textOf, useQuery, useTableColumns } from "../state/use-calendar-query";

/** 一页的表格状态。 */
export interface DomainTableApi {
    /** 行 */
    rows: Ref<Row[]>;
    /** 页面状态 */
    state: ComputedRef<LoadState>;
    /** 出错时的一句话 */
    error: ComputedRef<string>;
    /** 列声明 */
    columns: ComputedRef<TableColumn[]>;
    /** 打头列（人类可读的标识） */
    primaryColumns: ComputedRef<string[]>;
    /** 全表行数 */
    total: Ref<bigint | null>;
    /** 搜索串（对文本列做 LIKE） */
    search: Ref<string>;
    /** 排序方向 */
    descending: Ref<boolean>;
    /** 一页几条 */
    size: Ref<number>;
    /** 当前页（从 0 起） */
    page: Ref<number>;
    /** 页数 */
    pageCount: ComputedRef<number>;
    /** 重取 */
    reload: () => void;
}

/** 一页最多取多少条。 */
const PAGE_SIZES = [50, 100, 200, 500] as const;

/** 可选的每页条数。 */
export const PageSizes = PAGE_SIZES;

/**
 * 造一个表格页的查询。
 *
 * @param module 分库模块名
 * @param table 表名（由调用方从登记表给，主进程会再校验一次）
 * @param searchable 参与 LIKE 搜索的列名；不传则取全部文本列
 */
export function useDomainTable(
    module: string,
    table: string,
    searchable?: readonly string[]
): DomainTableApi {
    const { columns: infos, error: columnError } = useTableColumns(module, () => table);

    const search = ref("");
    const descending = ref(false);
    const size = ref<number>(100);
    const page = ref(0);

    /** 文本列：LIKE 搜索只在它们身上做。 */
    const textColumns = computed(() =>
        infos.value.filter((info) => !isNumericType(info.type)).map((info) => info.name)
    );

    /** 实际参与搜索的列。 */
    const searchColumns = computed(() => {
        const names = searchable ?? textColumns.value;
        return names.filter((name) => infos.value.some((info) => info.name === name));
    });

    /**
     * 排序键。
     *
     * 默认按 `identity`（如果有），其次按第一列。用**白名单里的列名**拼，
     * 不接用户输入——排序字段无法作为绑定参数。
     */
    const orderColumn = computed(() => {
        const names = infos.value.map((info) => info.name);
        if (names.includes("identity")) {
            return "identity";
        }
        if (names.includes("start")) {
            return "start";
        }
        return names[0] ?? "rowid";
    });

    /** 全表行数。 */
    const { rows: totalRows } = useQuery<Row>(module, `SELECT COUNT(*) AS n FROM "${table}"`);
    const total = computed<bigint | null>(() => {
        const value = totalRows.value[0]?.n;
        return value === null || value === undefined ? null : BigInt(value);
    });

    /** 列表语句。 */
    const statement = computed(() => {
        const needle = search.value.trim();
        const clauses: string[] = [];

        if (needle.length > 0 && searchColumns.value.length > 0) {
            // 值全部走绑定参数（`:q0`、`:q1`…），列名来自白名单
            clauses.push(
                `(${searchColumns.value.map((_name, index) => `"${searchColumns.value[index]}" LIKE :q${index}`).join(" OR ")})`
            );
        }

        const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
        const direction = descending.value ? "DESC" : "ASC";
        const offset = page.value * size.value;

        return (
            `SELECT * FROM "${table}"${where} ` +
            `ORDER BY "${orderColumn.value}" ${direction} ` +
            `LIMIT ${size.value} OFFSET ${offset}`
        );
    });

    /** 参数：搜索串按列铺开。 */
    const parameters = computed(() => {
        const needle = search.value.trim();
        const bag: Record<string, string> = {};
        if (needle.length > 0) {
            searchColumns.value.forEach((_name, index) => {
                bag[`q${index}`] = `%${needle}%`;
            });
        }
        return bag;
    });

    const { rows, state, error, reload } = useQuery<Row>(module, statement, () => parameters.value);

    /** 页数。 */
    const pageCount = computed(() => {
        const count = total.value;
        if (count === null || count === 0n) {
            return 1;
        }
        return Math.max(1, Math.ceil(Number(count) / size.value));
    });

    /** 界面列声明：数字列右对齐。 */
    const columns = computed<TableColumn[]>(() =>
        infos.value.map((info) => ({ name: info.name, numeric: isNumericType(info.type) }))
    );

    /** 打头列：按候选名顺序取存在的那些。 */
    const primaryColumns = computed(() => {
        const names = infos.value.map((info) => info.name);
        const heads = PRIMARY_COLUMN_CANDIDATES.filter((name) => names.includes(name));
        // 一个候选都没有时，用第一列当标识，别让 identity 打头
        return heads.length > 0 ? heads : names.slice(0, 1);
    });

    /** 状态：列查询出错算错误；搜索无结果算空态（不是错误）。 */
    const mergedState = computed<LoadState>(() => {
        if (columnError.value.length > 0) {
            return "error";
        }
        return state.value;
    });

    return {
        rows,
        state: mergedState,
        error: computed(() => columnError.value || error.value),
        columns,
        primaryColumns,
        total,
        search,
        descending,
        size,
        page,
        pageCount,
        reload
    };
}

/** 一行里最像"名字"的列，用于列表显示。 */
export const labelOf = (row: Row): string => {
    for (const key of PRIMARY_COLUMN_CANDIDATES) {
        const text = textOf(row[key]);
        if (text.length > 0) {
            return text;
        }
    }
    return textOf(row.identity);
};
