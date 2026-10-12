/**
 * Sqlite 数据访问契约层（驱动无关）。
 *
 * 本文件是 `src/sqlite/` 与 `src/repository/` 之间的唯一约定：
 *
 * - `StatementRunner`：驱动接缝。Electron 主进程可以把任意 SQLite 驱动
 *   （node:sqlite / better-sqlite3 / IPC 代理）适配成 `all` / `get` / `run` 三个方法，
 *   本层不 import 任何驱动，保持驱动无关。
 * - `Sqlite`：一个实体模块（= 一个数据库文件 `src/sqlite/<entity>.sqlite`）的数据访问对象，
 *   只提供 `query` / `queryOne` / `run` / `transaction` 四个方法。
 *   每个实体一个文件，故驱动按模块名注入（`injectRunner(runner, "temporal")`），
 *   本层不做任何跨库 SQL：仓库只能引用本实体文件里的表。
 * - `SCHEMA`：全部 28 张表的列白名单，列名与 `kind` 与 `src/sqlite/<entity>.sql`
 *   （唯一来源 `database/schema.py`）逐字一致；每个文件里的 `_meta` 表是构建元数据，本层不涉及。
 * - `bindExample`：把 `Example` 拆成与生成 SQL 占位符同名的参数包。
 *   生成 SQL（`src/sql/*.sql`）原文使用的占位符一律绑定，
 *   未给条件的列绑 NULL —— SQL 已写成 `(:column IS NULL OR ...)`，故全 NULL 即“不加条件”。
 * - `projectionOf`：`:projection` 无法作为绑定参数传入（列名不是值），
 *   必须先按列白名单校验，再受控拼接；除此之外本层不拼接任何外部输入。
 * - `bigOf` / `textOf` / `booleanOf`：SQLite 的 8 字节整数会以 JS `number`
 *   或 `bigint` 回传（取决于驱动配置），故整数列一律经 `bigOf` 归一为 `bigint`。
 */
/** 行：SQLite 一行的取值。整数列可能是 bigint（驱动开启大整数）或 number（默认）。 */
export type Row = Record<string, bigint | number | string | boolean | null>;

/** 可绑定的参数值；`undefined` 与 `null` 都按 SQL NULL 绑定。 */
export type BindValue = bigint | number | string | boolean | null;

/** 具名参数包，键与生成 SQL 里的 `:name` 占位符同名。 */
export type Bindings = Record<string, BindValue>;

/**
 * 驱动接缝：本层只认这三个方法。
 * 参数缺省即空参数包；实现方需把 `Parameters` 之外的键视为调用方错误并报错
 * （node:sqlite 对多余具名参数会抛 `Unknown named parameter`）。
 */
export interface StatementRunner {
    /** 查询多行。 */
    all(statement: string, parameters?: Bindings): Promise<Row[]>;
    /** 查询单行；无结果返回 undefined。 */
    get(statement: string, parameters?: Bindings): Promise<Row | undefined>;
    /** 执行语句（含 BEGIN / COMMIT / ROLLBACK 等事务控制语句）。 */
    run(statement: string, parameters?: Bindings): Promise<void>;
}

/** 一个实体模块（= 一个数据库文件）的数据访问对象。 */
export interface Sqlite {
    /** 实体模块名，等于数据库文件名与仓库名（`store` 层按名装配）。 */
    name: string;
    /**
     * 本文件涉及的表：一表一个文件，故多表模块的每个文件只列自己那张表
     * （顺序与 `src/sql/<module>.sql` 里该表的语句顺序一致）。
     */
    tables: string[];
    /** 查询多行。 */
    query<T>(statement: string, parameters?: Bindings): Promise<T[]>;
    /** 查询单行。 */
    queryOne<T>(statement: string, parameters?: Bindings): Promise<T | undefined>;
    /** 执行写语句或事务控制语句。 */
    run(statement: string, parameters?: Bindings): Promise<void>;
    /** 事务：`work` 整体成功才提交，抛错则回滚后再抛出原错误。 */
    transaction<T>(work: () => Promise<T>): Promise<T>;
}

/** 列类型，取值与 `database/schema.py` 的 `Column.kind` 一致（boolean 在 SQLite 里是 INTEGER 0/1）。 */
export type Kind = "bigint" | "text" | "boolean";

/** 一列的声明。 */
export interface Column {
    /** 列名。 */
    readonly name: string;
    /** 列类型。 */
    readonly kind: Kind;
}

/** 声明一个整数列。 */
const n: (name: string) => Column = (name: string): Column => ({ name: name, kind: "bigint" });
/** 声明一个文本列。 */
const t: (name: string) => Column = (name: string): Column => ({ name: name, kind: "text" });
/** 声明一个布尔列（SQLite 存 0/1）。 */
const b: (name: string) => Column = (name: string): Column => ({ name: name, kind: "boolean" });

/**
 * 全部 28 张表的列白名单，与 `src/sql/schema.sql` 逐字对应。
 * 一切列名校验（投影、排序、Example 绑定）都以本表为准；表里没有的字段一律不得下推 SQL。
 */
export const SCHEMA: Readonly<Record<string, ReadonlyArray<Column>>> = {
    temporal: [
        n("identity"),
        n("absolute"),
        n("days"),
        n("seconds"),
        n("year"),
        n("month"),
        n("day"),
        n("hour"),
        n("minute"),
        n("second")
    ],
    phenology: [
        n("identity"),
        n("absolute"),
        t("name"),
        n("kind"),
        n("year"),
        n("start"),
        n("end")
    ],
    part: [n("identity"), n("absolute"), n("month"), n("day"), n("start"), n("end")],
    week: [n("identity"), n("absolute"), n("month"), n("lengthOfDay"), n("start"), n("end")],
    phase: [
        n("identity"),
        n("absolute"),
        n("relative"),
        t("name"),
        n("lengthOfDay"),
        n("lengthOfWeek"),
        b("leap"),
        n("month"),
        n("start"),
        n("end")
    ],
    climate: [
        n("identity"),
        n("absolute"),
        n("relative"),
        t("name"),
        n("lengthOfDay"),
        n("lengthOfWeek"),
        b("leap"),
        n("month"),
        n("start"),
        n("end")
    ],
    synodic_calendar_year: [n("identity"), n("relative"), n("months"), n("start"), n("end")],
    synodic_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        t("size"),
        n("lengthOfDay"),
        t("name"),
        t("label"),
        n("month_end_day"),
        n("start"),
        n("end")
    ],
    epoch: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("perform"),
        n("months"),
        n("start"),
        n("end")
    ],
    perform: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("encounter"),
        n("epoches"),
        n("start"),
        n("end")
    ],
    encounter: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("primary"),
        n("performs"),
        n("start"),
        n("end")
    ],
    primary: [n("identity"), n("relative"), n("absolute"), n("performs"), n("start"), n("end")],
    dynasty: [
        n("identity"),
        n("relative"),
        n("absolute"),
        t("name"),
        n("eras"),
        n("chronologies"),
        n("start"),
        n("end")
    ],
    era: [
        n("identity"),
        n("relative"),
        n("absolute"),
        t("name"),
        n("dynasty"),
        n("chronologies"),
        n("start"),
        n("end")
    ],
    chronology: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("epoch"),
        n("synodic"),
        n("lengthOfSynodicMonth"),
        n("start"),
        n("end")
    ],
    astronomy_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    astronomy_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    climate_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    climate_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    gregory_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    gregory_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    jupiter_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    jupiter_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    natural_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    natural_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    tree_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    tree_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ],
    tropical_year: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("months"),
        n("lengthOfMonth"),
        n("phenologies"),
        n("lengthOfPhenology"),
        n("weeks"),
        n("lengthOfWeek"),
        n("parts"),
        n("lengthOfPart"),
        n("lengthOfDay"),
        b("leap"),
        n("start"),
        n("end")
    ],
    tropical_month: [
        n("identity"),
        n("relative"),
        n("absolute"),
        n("year"),
        n("ordinal"),
        b("leap"),
        n("lengthOfDay"),
        n("phenologies"),
        n("weeks"),
        n("parts"),
        t("name"),
        n("start"),
        n("end")
    ]
};

/**
 * 取某张表的列白名单。
 * @param table 表名，必须存在于 `SCHEMA`。
 * @returns 该表的列数组（只读）。
 */
export const columnsOf: (table: string) => ReadonlyArray<Column> = (
    table: string
): ReadonlyArray<Column> => {
    const columns: ReadonlyArray<Column> | undefined = SCHEMA[table];
    if (columns === undefined) {
        throw new TypeError(`未知的表：${table}。`);
    }
    return columns;
};

/**
 * 取某张表的某一列。
 * @param table 表名。
 * @param column 列名。
 * @returns 列声明。
 */
export const columnOf: (table: string, column: string) => Column = (
    table: string,
    column: string
): Column => {
    const found: Column | undefined = columnsOf(table).find(
        (item: Column): boolean => item.name === column
    );
    if (found === undefined) {
        throw new TypeError(`表 ${table} 不存在列 ${column}。`);
    }
    return found;
};

/**
 * 列白名单校验：列不存在直接抛 `TypeError`。
 * 凡是要把列名拼进 SQL 的地方（投影、排序）都必须先过这里。
 * @param table 表名。
 * @param column 列名。
 * @returns 原列名，便于内联使用。
 */
export const assertColumn: (table: string, column: string) => string = (
    table: string,
    column: string
): string => {
    return columnOf(table, column).name;
};

/**
 * 排序方向白名单校验：接受 `repository.ts` 的 `Direction`（Ascend / Descend）
 * 与 SQL 的 `ASC` / `DESC`，返回可安全拼接的 SQL 关键字。
 * @param direction 方向。
 * @returns `"ASC"` 或 `"DESC"`。
 */
export const assertDirection: (direction: unknown) => "ASC" | "DESC" = (
    direction: unknown
): "ASC" | "DESC" => {
    switch (direction) {
        case "ASC":
        case "Ascend":
        case "ASCEND":
        case "asc":
            return "ASC";
        case "DESC":
        case "Descend":
        case "DESCEND":
        case "desc":
            return "DESC";
        default:
            throw new TypeError(`未知的排序方向：${String(direction)}。`);
    }
};

/**
 * 归一为 `bigint`。整数列经 SQLite 往返后可能是 `number`（默认）或 `bigint`。
 * @param value 行里的取值。
 * @returns bigint。
 */
export const bigOf: (value: Row[string]) => bigint = (value: Row[string]): bigint => {
    if (typeof value === "bigint") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isInteger(value)) {
            throw new TypeError(`整数列回传了非整数：${value}。`);
        }
        return BigInt(value);
    }
    if (typeof value === "boolean") {
        return value ? 1n : 0n;
    }
    if (typeof value === "string") {
        return BigInt(value);
    }
    throw new TypeError("整数列为空，无法转换为 bigint。");
};

/**
 * 归一为 `string`。TEXT 列正常回传 string，标量按需转文本。
 * @param value 行里的取值。
 * @returns string。
 */
export const textOf: (value: Row[string]) => string = (value: Row[string]): string => {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "bigint" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    throw new TypeError("文本列为空，无法转换为 string。");
};

/**
 * 归一为 `boolean`。boolean 列在 SQLite 里是 0/1；null 与 undefined 视为 false。
 * @param value 行里的取值。
 * @returns boolean。
 */
export const booleanOf: (value: Row[string] | undefined) => boolean = (
    value: Row[string] | undefined
): boolean => {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === "boolean") {
        return value;
    }
    return bigOf(value) !== 0n;
};

/** 是否给了值（null 与 undefined 都算没给）。 */
const present: (value: unknown) => boolean = (value: unknown): boolean =>
    value !== null && value !== undefined;

/** 把 unknown 当作普通对象读取（非对象 -> 空对象，避免读到原型链上的东西）。 */
const asRecord: (value: unknown) => Record<string, unknown> = (
    value: unknown
): Record<string, unknown> => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return { ...(value as Record<string, unknown>) };
};

/** 区间条件 -> [start, end)。 */
const spanOf: (value: unknown) => readonly [unknown, unknown] = (
    value: unknown
): readonly [unknown, unknown] => {
    if (!present(value)) {
        return [undefined, undefined];
    }
    if (!Array.isArray(value) || value.length !== 2) {
        throw new TypeError("区间条件必须是 [start, end) 形式的二元组。");
    }
    return [value[0], value[1]];
};

/** 单值参数 -> 可绑定值：null/undefined -> NULL，boolean -> 0/1（node:sqlite 不接受 JS 布尔）。 */
const bindable: (value: unknown) => BindValue = (value: unknown): BindValue => {
    if (!present(value)) {
        return null;
    }
    if (typeof value === "bigint" || typeof value === "number" || typeof value === "string") {
        return value;
    }
    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }
    throw new TypeError(
        `无法绑定的参数类型：${typeof value}（时间列请传 temporal.absolute 整数）。`
    );
};

/**
 * 把 `Example` 拆成与生成 SQL 占位符同名的参数包。
 *
 * 生成 SQL 的占位符约定（见 `src/sql/*.sql` 头部注释）：
 *
 * - 整数/布尔列：`:column`（等值）、`:columnStart` / `:columnEnd`（半开区间 `[start, end)`）
 * - 文本列：只有 `:columnLike`，故文本列的等值条件也落到 LIKE 位（不含通配符时等价于等值）
 *
 * 未给条件的列一律绑 NULL：SQL 已写成 `(:column IS NULL OR ...)`，全 NULL 即“不加条件”。
 * 实体里存在、表里没有的字段（如 `phenology.relative`）会被忽略，因为 SQL 里没有对应占位符。
 *
 * @param table 表名。
 * @param example `repository.ts` 的 `Example`（等值字段平铺，另有 `range` / `like` 两组）。
 * @returns 参数包。
 */
export const bindExample: (table: string, example?: unknown) => Bindings = (
    table: string,
    example?: unknown
): Bindings => {
    const source: Record<string, unknown> = asRecord(example);
    const range: Record<string, unknown> = asRecord(source["range"]);
    const like: Record<string, unknown> = asRecord(source["like"]);
    const bindings: Bindings = {};
    for (const column of columnsOf(table)) {
        // 等值与区间对所有列都绑：文本列同样支持精确匹配（例如 kind = 'era_begin'）
        bindings[column.name] = bindable(source[column.name]);
        const span: readonly [unknown, unknown] = spanOf(range[column.name]);
        bindings[`${column.name}Start`] = bindable(span[0]);
        bindings[`${column.name}End`] = bindable(span[1]);
        if (column.kind === "text") {
            // 模糊匹配只对文本列：like 优先，其次把平铺的等值当模式（无通配符即精确）
            const pattern: unknown = present(like[column.name])
                ? like[column.name]
                : source[column.name];
            bindings[`${column.name}Like`] = bindable(pattern);
        }
    }
    return bindings;
};

/** JS 安全整数下界。 */
const MinSafe: bigint = BigInt(Number.MIN_SAFE_INTEGER);
/** JS 安全整数上界。 */
const MaxSafe: bigint = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * 主键集合 -> `json_each(:identities)` 需要的 JSON 数组文本。
 * 安全整数范围内输出数字（省掉一次亲和性转换），超出范围的主键输出字符串。
 * @param identities 主键集合。
 * @returns JSON 数组文本，例如 `[1,2,3]`。
 */
export const identityParameter: (identities: ReadonlyArray<bigint>) => string = (
    identities: ReadonlyArray<bigint>
): string => {
    return JSON.stringify(
        identities.map((identity: bigint): number | string =>
            identity >= MinSafe && identity <= MaxSafe ? Number(identity) : identity.toString()
        )
    );
};

/**
 * 投影列 -> `SELECT` 列表（`"a", "b"`）。
 *
 * 生成 SQL 写作 `SELECT :projection`：列名不是值，无法作为绑定参数传入，
 * 因此必须先逐列过白名单（未知列抛 `TypeError`），再做受控拼接。
 * @param table 表名。
 * @param fields 字段列表（即列名）。
 * @returns 形如 `"identity", "name"` 的列表。
 */
export const projectionOf: (table: string, fields: ReadonlyArray<string>) => string = (
    table: string,
    fields: ReadonlyArray<string>
): string => {
    if (fields.length === 0) {
        throw new TypeError(`表 ${table} 的投影字段不能为空。`);
    }
    return fields.map((field: string): string => `"${assertColumn(table, field)}"`).join(", ");
};

/**
 * 受控插值：把生成 SQL 里无法绑定的占位符换成已校验的字面量（目前只有 `:projection`）。
 * @param statement 语句原文。
 * @param placeholder 占位符，例如 `":projection"`。
 * @param literal 已校验的字面量。
 * @returns 可执行语句。
 */
export const interpolate: (statement: string, placeholder: string, literal: string) => string = (
    statement: string,
    placeholder: string,
    literal: string
): string => {
    return statement.split(placeholder).join(literal);
};

/**
 * 语句里是否声明了某个占位符。
 *
 * 只绑定语句真正声明的参数：node:sqlite 对多余的具名参数会抛
 * `Unknown named parameter`。这也让本层在生成 SQL 以后新增
 * `:sortDirection` 之类的槽位时无需改动。
 * @param statement 语句原文。
 * @param placeholder 占位符。
 * @returns 是否声明。
 */
export const declares: (statement: string, placeholder: string) => boolean = (
    statement: string,
    placeholder: string
): boolean => {
    return statement.includes(placeholder);
};

/** 排序容器：与 `repository.ts` 的 `Sort<E>` 结构兼容（`orders` 里的 `by` 即列名）。 */
export interface SortLike {
    /** 排序键，按优先级排列。 */
    readonly orders?:
        ReadonlyArray<{ readonly by: unknown; readonly direction: unknown }> | undefined;
}

/** 生成 SQL 的排序取值：列名与方向。 */
export interface Ordering {
    /** 单列排序的列名（SQL 只有一个 `:sortColumn` 槽位，用白名单 CASE 分派）。 */
    readonly column: string;
    /** 方向文本，供 SQL 声明了 `:sortDirection` 时绑定。 */
    readonly direction: "ASC" | "DESC";
}

/**
 * 取生成 SQL 需要的排序列名与方向。
 *
 * 生成 SQL 的 `ORDER BY` 只有一个 `:sortColumn` 槽位（白名单 CASE 分派，ELSE 回落到 identity），
 * 因此只支持单键排序；多键直接抛 `TypeError`，避免静默改变调用方的排序语义。
 * 列名先过白名单校验，未给排序时返回 `identity` + `ASC`。
 * @param table 表名。
 * @param sort 排序。
 * @returns 列名与方向。
 */
export const orderOf: (table: string, sort?: SortLike) => Ordering = (
    table: string,
    sort?: SortLike
): Ordering => {
    const orders: ReadonlyArray<{ readonly by: unknown; readonly direction: unknown }> =
        sort?.orders ?? [];
    if (orders.length > 1) {
        throw new TypeError(
            `表 ${table} 的生成 SQL 只提供单个 :sortColumn 槽位，无法下推 ${orders.length} 个排序键。`
        );
    }
    const order: { readonly by: unknown; readonly direction: unknown } | undefined = orders[0];
    if (order === undefined) {
        return { column: "identity", direction: "ASC" };
    }
    return {
        column: assertColumn(table, String(order.by)),
        direction: assertDirection(order.direction)
    };
};

/**
 * 把一行按投影字段转换为投影对象：整数列转 `bigint`，文本列转 `string`，布尔列转 `boolean`。
 * `fields` 必须已通过 `projectionOf` 的白名单校验。
 * @param table 表名。
 * @param fields 投影字段。
 * @param row 行。
 * @returns 投影对象（由调用方断言为 `Pick<E, K>`）。
 */
export const pickOf: <T>(table: string, fields: ReadonlyArray<string>, row: Row) => T = <T>(
    table: string,
    fields: ReadonlyArray<string>,
    row: Row
): T => {
    const picked: Record<string, bigint | string | boolean> = {};
    for (const field of fields) {
        const column: Column = columnOf(table, field);
        if (column.kind === "text") {
            picked[field] = textOf(row[field]);
        } else if (column.kind === "boolean") {
            picked[field] = booleanOf(row[field]);
        } else {
            picked[field] = bigOf(row[field]);
        }
    }
    return picked as unknown as T;
};

/**
 * 总页数 = `ceil(elements / size)`，全程 bigint 运算。
 * @param elements 总行数。
 * @param size 每页大小。
 * @returns 页数；无行时为 0。
 */
export const pageCount: (elements: bigint, size: bigint) => bigint = (
    elements: bigint,
    size: bigint
): bigint => {
    if (elements <= 0n) {
        return 0n;
    }
    if (size <= 0n) {
        throw new RangeError("分页大小 size 必须大于 0。");
    }
    return (elements + size - 1n) / size;
};

/** 不分页：`LIMIT -1` 在 SQLite 里表示不限制行数（配合 `OFFSET 0`）。 */
export const Unlimited: bigint = -1n;

/** 未注入驱动时的报错文案。 */
const notInjected: (name: string) => string = (name: string): string =>
    `尚未注入 SQLite 驱动（StatementRunner）：请为 ${name} 实体调用 sqlite.ts 的 injectRunner(runner, "${name}")。`;

/** 未注入任何驱动时的报错文案。 */
const NotInjected: string =
    "尚未注入 SQLite 驱动（StatementRunner）：请先调用 sqlite.ts 的 injectRunner(runner)。";

/** 全局兜底驱动（单库场景才需要；分库场景按模块名注入）。 */
let fallback: StatementRunner | undefined = undefined;

/** 已注入的模块级驱动：实体模块名 -> 驱动。 */
const injected: Map<string, StatementRunner> = new Map();

/** 模块级缺省驱动的缓存。 */
const runners: Map<string, StatementRunner> = new Map();

/**
 * 注入缺省驱动。每个实体一个 SQLite 文件，故推荐按模块名注入：
 * `injectRunner(runner, "temporal")`；不传 `name` 时作为全局兜底。
 * @param runner 驱动；传 undefined 表示注销。
 * @param name 实体模块名。
 */
export const injectRunner: (runner: StatementRunner | undefined, name?: string) => void = (
    runner: StatementRunner | undefined,
    name?: string
): void => {
    if (name === undefined) {
        fallback = runner;
        return;
    }
    if (runner === undefined) {
        injected.delete(name);
        return;
    }
    injected.set(name, runner);
};

/** 取全局兜底驱动；未注入时抛中文错误。 */
const global: () => StatementRunner = (): StatementRunner => {
    if (fallback === undefined) {
        throw new Error(NotInjected);
    }
    return fallback;
};

/** 取某实体模块的驱动：模块级注入优先，其次全局兜底；都没有时抛中文错误。 */
const resolve: (name: string) => StatementRunner = (name: string): StatementRunner => {
    const runner: StatementRunner | undefined = injected.get(name) ?? fallback;
    if (runner === undefined) {
        throw new Error(notInjected(name));
    }
    return runner;
};

/**
 * 全局兜底驱动：调用时才解析已注入的驱动，故“先构造、后注入”也能工作；
 * 未注入时以清晰的中文错误拒绝，便于定位装配遗漏。
 */
export const defaultRunner: StatementRunner = {
    all: async (statement: string, parameters?: Bindings): Promise<Row[]> =>
        global().all(statement, parameters),
    get: async (statement: string, parameters?: Bindings): Promise<Row | undefined> =>
        global().get(statement, parameters),
    run: async (statement: string, parameters?: Bindings): Promise<void> =>
        global().run(statement, parameters)
};

/**
 * 取某实体模块的缺省驱动：模块级注入优先，其次全局兜底。
 * 返回的是“延迟解析”的驱动，因此 Sqlite / Repository 可以先零参构造、之后注入。
 * @param name 实体模块名。
 * @returns 驱动。
 */
export const runnerOf: (name: string) => StatementRunner = (name: string): StatementRunner => {
    const cached: StatementRunner | undefined = runners.get(name);
    if (cached !== undefined) {
        return cached;
    }
    const runner: StatementRunner = {
        all: async (statement: string, parameters?: Bindings): Promise<Row[]> =>
            resolve(name).all(statement, parameters),
        get: async (statement: string, parameters?: Bindings): Promise<Row | undefined> =>
            resolve(name).get(statement, parameters),
        run: async (statement: string, parameters?: Bindings): Promise<void> =>
            resolve(name).run(statement, parameters)
    };
    runners.set(name, runner);
    return runner;
};

/**
 * 判断注入的是完整的 `Sqlite` 还是裸的 `StatementRunner`。
 * 仓库构造函数两种都接受，便于上层只持有驱动。
 * @param source 注入对象。
 * @returns 是否为 `Sqlite`。
 */
export const isSqlite: (source: Sqlite | StatementRunner) => source is Sqlite = (
    source: Sqlite | StatementRunner
): source is Sqlite => {
    const candidate: Partial<Sqlite> = source as Partial<Sqlite>;
    return (
        typeof candidate.query === "function" &&
        typeof candidate.queryOne === "function" &&
        typeof candidate.run === "function" &&
        typeof candidate.transaction === "function" &&
        typeof candidate.name === "string" &&
        Array.isArray(candidate.tables)
    );
};

/**
 * `Sqlite` 的公共骨架：把 `StatementRunner` 适配成四个方法。
 * 各实体模块只需继承并声明自己的 `name` / `tables`，不必重复驱动逻辑。
 */
export abstract class AbstractSqlite implements Sqlite {
    /** 实体模块名，等于数据库文件名与仓库名。 */
    public readonly name: string;

    /** 本文件涉及的表：一表一个文件，故多表模块的每个文件只列自己那张表。 */
    public readonly tables: string[];

    /** 驱动接缝。 */
    protected readonly runner: StatementRunner;

    /** 嵌套事务深度：大于 0 表示已在事务内，用 SAVEPOINT 嵌套。 */
    private depth: number = 0;

    /**
     * 构造。
     * @param name 实体模块名。
     * @param tables 本文件涉及的表（一表一个文件）。
     * @param runner 驱动；缺省用本模块的 `runnerOf(name)`（injectRunner 注入后即可工作）。
     */
    protected constructor(name: string, tables: ReadonlyArray<string>, runner?: StatementRunner) {
        this.name = name;
        this.tables = tables.map((table: string): string => table);
        this.runner = runner ?? runnerOf(name);
    }

    /**
     * 查询多行。
     * @param statement 生成 SQL 原文（或已受控插值的语句）。
     * @param parameters 参数包。
     * @returns 行数组。
     */
    public async query<T>(statement: string, parameters?: Bindings): Promise<T[]> {
        const rows: Row[] = await this.runner.all(statement, parameters);
        return rows as unknown as T[];
    }

    /**
     * 查询单行。
     * @param statement 生成 SQL 原文（或已受控插值的语句）。
     * @param parameters 参数包。
     * @returns 行；无结果返回 undefined。
     */
    public async queryOne<T>(statement: string, parameters?: Bindings): Promise<T | undefined> {
        const row: Row | undefined = await this.runner.get(statement, parameters);
        return row as unknown as T | undefined;
    }

    /**
     * 执行写语句或事务控制语句。
     * @param statement 语句。
     * @param parameters 参数包。
     */
    public async run(statement: string, parameters?: Bindings): Promise<void> {
        await this.runner.run(statement, parameters);
    }

    /**
     * 事务。同一实例上的 `transaction` 必须串行使用（SQLite 单连接）；
     * 嵌套调用改用 SAVEPOINT，最内层回滚不会带走外层已完成的修改。
     * @param work 事务体。
     * @returns `work` 的返回值。
     */
    public async transaction<T>(work: () => Promise<T>): Promise<T> {
        const nested: boolean = this.depth > 0;
        const savepoint: string = `dsh_${this.depth + 1}`;
        this.depth += 1;
        await this.run(nested ? `SAVEPOINT ${savepoint}` : "BEGIN");
        try {
            const result: T = await work();
            await this.run(nested ? `RELEASE ${savepoint}` : "COMMIT");
            return result;
        } catch (error) {
            await this.run(nested ? `ROLLBACK TO ${savepoint}` : "ROLLBACK");
            if (nested) {
                await this.run(`RELEASE ${savepoint}`);
            }
            throw error;
        } finally {
            this.depth -= 1;
        }
    }
}
