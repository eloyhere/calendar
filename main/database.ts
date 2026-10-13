import { DatabaseSync } from "node:sqlite";
import type { StatementSync } from "node:sqlite";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

import {
    CALENDAR_ROW_LIMIT,
    isReadOnlyStatement
} from "../shared/calendar-api";
import type {
    CalendarBindings,
    CalendarColumnInfo,
    CalendarColumnsRequest,
    CalendarModuleState,
    CalendarRow,
    CalendarSelectRequest,
    CalendarSelectResult
} from "../shared/calendar-api";
import { DATABASE_MODULES, MODULE_BY_NAME } from "../shared/database-registry";

/**
 * 分库读取器。
 *
 * ## 位置
 *
 * 22 个 `.sqlite` 在 `src/sqlite/` 下（`docs/design.md` §3）。开发期项目根就是仓库目录，
 * 打包后是 asar 根，两种情况都用 `app.getAppPath()` 定位——与 `main/workflow.ts`
 * 找 `scripts/operation` 是同一个做法。
 *
 * ## 连接池
 *
 * 每个分库一个长连接，按需打开并缓存。**不主动关**：这些都是只读连接，
 * 关掉再开的代价（SQLite 要重新读 schema）比留着连接高，而 22 个只读连接
 * 的内存开销可以忽略。应用退出时统一关。
 *
 * 大头是 `temporal.sqlite`（778 MB）与 `climate.sqlite`（661 MB），
 * 只读打开不会把它们读进内存——SQLite 走页缓存。
 *
 * ## 只读是两层保证
 *
 * `readOnly: true` 是硬保证（SQLite 自己会拒绝写），`isReadOnlyStatement()`
 * 是软保证（让写语句得到一条能读懂的中文拒绝，而不是 `SQLITE_READONLY`）。
 */

/** 项目根。开发期是仓库目录，打包后是 asar 根。 */
const projectRoot: string = app.getAppPath();

/** 分库目录。 */
const databaseDirectory: string = join(projectRoot, "src", "sqlite");

/** 已打开的连接：模块名 → 连接。 */
const connections: Map<string, DatabaseSync> = new Map();

/** 语句缓存：连接 + SQL 文本 → 预编译语句。同样的 SQL 只 prepare 一次。 */
const statements: Map<string, StatementSync> = new Map();

/** 打不开的分库：模块名 → 原因。避免每次都重试一次失败的打开。 */
const failures: Map<string, string> = new Map();

/** 打开一个分库；失败时返回原因而不是抛错——界面要能把原因显示出来。 */
const open = (name: string): DatabaseSync | string => {
    const cached = connections.get(name);
    if (cached !== undefined) {
        return cached;
    }
    const known = failures.get(name);
    if (known !== undefined) {
        return known;
    }
    const descriptor = MODULE_BY_NAME.get(name);
    if (descriptor === undefined) {
        const message = `未登记的分库：${name}`;
        failures.set(name, message);
        return message;
    }

    const path = join(databaseDirectory, descriptor.file);
    if (!existsSync(path)) {
        const message = `分库文件不存在：src/sqlite/${descriptor.file}`;
        failures.set(name, message);
        return message;
    }

    try {
        const connection = new DatabaseSync(path, { readOnly: true });
        connections.set(name, connection);
        return connection;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.set(name, message);
        return message;
    }
};

/** 取预编译语句。 */
const statementOf = (connection: DatabaseSync, key: string, sql: string): StatementSync => {
    const cached = statements.get(key);
    if (cached !== undefined) {
        return cached;
    }
    const statement = connection.prepare(sql);
    statements.set(key, statement);
    return statement;
};

/**
 * 行里的整数归一。
 *
 * `node:sqlite` 对超出 `Number.MAX_SAFE_INTEGER` 的整数返回 `bigint`，其余返回 `number`。
 * 两个都留在行里（契约是 `bigint | number`），**不转字符串**：渲染进程要用它们做
 * 比较与运算（历法页按 `absolute` 定位），转成字符串会让每个使用点都要 `BigInt(...)`。
 */
const asRow = (value: unknown): CalendarRow => value as CalendarRow;

/* -------------------------------------------------------------------------- */
/* 对外                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 列出 22 个分库的实时状态。
 *
 * 行数是**现算的**（`COUNT(*)`），不是登记表里那份实测值：登记表里的数字只能说明
 * "上次构建时有多少行"，而界面要回答的是"现在有多少行"。
 * 22 次 `COUNT(*)` 在 1000 万行的 `temporal` 上走的是主键索引，实测总耗时不到一秒。
 */
export const readModuleStates = (): CalendarModuleState[] =>
    DATABASE_MODULES.map((descriptor): CalendarModuleState => {
        const connection = open(descriptor.name);
        const path = join(databaseDirectory, descriptor.file);
        const present = existsSync(path);

        if (typeof connection === "string") {
            return {
                name: descriptor.name,
                label: descriptor.label,
                file: descriptor.file,
                note: descriptor.note,
                present,
                rows: null,
                tables: [],
                problem: connection
            };
        }

        try {
            const tables = (
                connection
                    .prepare(
                        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_meta' ORDER BY name"
                    )
                    .all() as { name: string }[]
            ).map((row) => row.name);

            // 行数取这个库里**最大**的那张表：那才是"这个库有多大"的答案。
            let rows = 0;
            for (const table of tables) {
                const counted = connection
                    .prepare(`SELECT COUNT(*) AS n FROM "${table}"`)
                    .get() as { n: number | bigint };
                const value = Number(counted.n);
                if (value > rows) {
                    rows = value;
                }
            }

            return {
                name: descriptor.name,
                label: descriptor.label,
                file: descriptor.file,
                note: descriptor.note,
                present,
                rows,
                tables,
                problem: null
            };
        } catch (error) {
            return {
                name: descriptor.name,
                label: descriptor.label,
                file: descriptor.file,
                note: descriptor.note,
                present,
                rows: null,
                tables: [],
                problem: error instanceof Error ? error.message : String(error)
            };
        }
    });

/** 查询多行。 */
export const selectRows = (request: CalendarSelectRequest): CalendarSelectResult => {
    if (!isReadOnlyStatement(request.statement)) {
        throw new Error("只允许只读查询：语句必须以 SELECT / WITH / EXPLAIN / PRAGMA / VALUES 开头");
    }

    const connection = open(request.module);
    if (typeof connection === "string") {
        throw new Error(connection);
    }

    const limit = Math.min(request.limit ?? CALENDAR_ROW_LIMIT, CALENDAR_ROW_LIMIT);
    const key = `${request.module}::${request.statement}`;
    const statement = statementOf(connection, key, request.statement);

    // node:sqlite 的具名参数：不带前缀的键即可（`{ name: value }` 对应 `:name`）。
    const rows = (statement.all((request.parameters ?? {}) as CalendarBindings) as unknown[]).map(asRow);

    return { rows: rows.slice(0, limit), truncated: rows.length > limit };
};

/** 查询单行。 */
export const selectRow = (request: CalendarSelectRequest): CalendarRow | null => {
    const result = selectRows({ ...request, limit: 1 });
    return result.rows[0] ?? null;
};

/**
 * 取一张表的列（`PRAGMA table_info`）。
 *
 * 表名是**拼进 SQL** 的（`PRAGMA` 不接受绑定参数），所以这里必须自己白名单校验：
 * 先看表名在该分库登记的表清单里，再拼。只靠正则挡不住
 * `x"; DROP TABLE y; --` 这类输入，而登记表是唯一事实来源。
 */
export const readColumns = (request: CalendarColumnsRequest): CalendarColumnInfo[] => {
    const descriptor = MODULE_BY_NAME.get(request.module);
    if (descriptor === undefined) {
        throw new Error(`未登记的分库：${request.module}`);
    }
    if (!descriptor.tables.includes(request.table)) {
        throw new Error(
            `分库 ${request.module} 里没有表 ${request.table}。它有：${descriptor.tables.join("、")}`
        );
    }

    const connection = open(request.module);
    if (typeof connection === "string") {
        throw new Error(connection);
    }

    const rows = connection.prepare(`PRAGMA table_info("${request.table}")`).all() as {
        name: string;
        type: string;
        notnull: number;
        pk: number;
    }[];

    return rows.map((row) => ({
        name: row.name,
        type: row.type,
        primaryKey: row.pk > 0,
        notNull: row.notnull > 0
    }));
};

/** 关闭全部连接。应用退出时调用一次。 */
export const closeDatabases = (): void => {
    for (const connection of connections.values()) {
        try {
            connection.close();
        } catch {
            // 退出路径上关不掉就算了：进程马上就没了
        }
    }
    connections.clear();
    statements.clear();
};

/* -------------------------------------------------------------------------- */
/* 自检                                                                        */
/* -------------------------------------------------------------------------- */

/** 一个分库的自检结果，开发期日志与 `/system/datasource` 用它。 */
export interface DatabaseSelfCheck {
    /** 分库目录 */
    directory: string;
    /** 目录是否存在 */
    present: boolean;
    /** 目录下 `.sqlite` 文件数 */
    files: number;
    /** 登记的分库数 */
    registered: number;
    /** 最大单文件字节数 */
    largest: number;
}

/** 环境自检：不打开数据库，只看文件。主进程启动时打一行日志。 */
export const checkDatabaseEnvironment = (): DatabaseSelfCheck => {
    const present = existsSync(databaseDirectory);
    let files = 0;
    let largest = 0;

    if (present) {
        for (const descriptor of DATABASE_MODULES) {
            const path = join(databaseDirectory, descriptor.file);
            if (existsSync(path)) {
                files += 1;
                largest = Math.max(largest, statSync(path).size);
            }
        }
    }

    return { directory: databaseDirectory, present, files, registered: DATABASE_MODULES.length, largest };
};
