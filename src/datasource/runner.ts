/**
 * 渲染进程侧的 SQLite 驱动接缝实现。
 *
 * `src/datasource/sqlite.ts` 的 `StatementRunner` 是驱动无关的：只要有人提供
 * `all` / `get` / `run` 三个方法，110 个生成的数据访问层文件、22 个 repository、
 * 全部 service 与 store 就都能工作。
 *
 * 本文件就是那个提供者，把三个方法接到主进程的 `node:sqlite` 只读连接上
 * （契约见 `shared/calendar-api.ts`）。
 *
 * ## 装配点只有一个
 *
 * `installCalendarRunner()` 在 `src/main.ts` 里调用一次，它做两件事：
 *
 * 1. 给每个实体模块注入一个**按模块分派**的 runner（`injectRunner(runner, name)`），
 *    这样一个 `runnerOf("synodic")` 就只会打到 `synodic.sqlite`；
 * 2. 同时注册为**全局兜底** runner，这样 `defaultRunner` 也能用——有些代码路径
 *    直接用了它而没有按模块注入。
 *
 * 分派靠 `shared/database-registry.ts` 的分库登记表：模块名不在表里时**直接报错**，
 * 而不是回落到别的库。回落是危险的——`synodic` 的查询打到 `gregory.sqlite` 会
 * 得到"表不存在"，而真正的原因（模块名拼错）会被这条报错盖住。
 */

import { injectRunner } from "../datasource/sqlite";
import type { Bindings, Row, StatementRunner } from "../datasource/sqlite";
import { MODULE_BY_NAME } from "../../shared/database-registry";

/**
 * 把 `Bindings` 收成主进程契约接受的值。
 *
 * 两处转换，都是**为了在跨进程之前暴露调用错误**，而不是让 SQLite 驱动去报：
 *
 * - `undefined` → `null`：与 `sqlite.ts` 的契约一致（两者都按 SQL NULL 绑定）；
 * - `boolean` → `1` / `0`：`node:sqlite` 的绑定值不接受 JS 布尔值，而 SQLite 里
 *   布尔本来就是 INTEGER 0/1（`sqlite.ts` 的 `booleanOf` 也是这么读回来的）。
 *   生成的语句里确实有布尔参数（`:"leap" = :leap`），所以这里必须转，
 *   不能让调用方在每个使用点记得写 `1`。
 */
const asParameters = (parameters: Bindings | undefined): Record<string, bigint | number | string | null> => {
    const out: Record<string, bigint | number | string | null> = {};
    for (const [name, value] of Object.entries(parameters ?? {})) {
        if (value === undefined || value === null) {
            out[name] = null;
        } else if (typeof value === "boolean") {
            out[name] = value ? 1 : 0;
        } else {
            out[name] = value;
        }
    }
    return out;
};

/** 断言模块名已登记，否则给出可操作的报错。 */
const assertModule = (name: string): void => {
    if (!MODULE_BY_NAME.has(name)) {
        const known = [...MODULE_BY_NAME.keys()].join("、");
        throw new Error(`未登记的分库 "${name}"。已登记的有：${known}`);
    }
};

/** 造一个绑定到具体分库的 runner。 */
const runnerFor = (name: string): StatementRunner => ({
    all: async (statement: string, parameters?: Bindings): Promise<Row[]> => {
        assertModule(name);
        const result = await window.desktop.calendar.select({
            module: name,
            statement,
            parameters: asParameters(parameters)
        });
        return result.rows as Row[];
    },

    get: async (statement: string, parameters?: Bindings): Promise<Row | undefined> => {
        assertModule(name);
        const row = await window.desktop.calendar.selectOne({
            module: name,
            statement,
            parameters: asParameters(parameters)
        });
        return row === null ? undefined : (row as Row);
    },

    /**
     * 写语句。
     *
     * 本项目的数据是**构建期产物、运行期只读**（`docs/design.md` §2 的时间主键与
     * `src/store/store.ts` 的读穿缓存都建立在这条上）。所以这里直接拒绝，
     * 而不是把语句发给一个只读连接让它报 `SQLITE_READONLY`——
     * 那样错误信息会指向驱动，而真正的原因是这一层不该有写路径。
     */
    run: async (): Promise<void> => {
        throw new Error("分库是只读的：数据由 database/build.py 在构建期装入，运行期不写库");
    }
});

/** 已注入的 runner 缓存：模块名 → runner。 */
const runners: Map<string, StatementRunner> = new Map();

const runnerOfModule = (name: string): StatementRunner => {
    const cached = runners.get(name);
    if (cached !== undefined) {
        return cached;
    }
    const runner = runnerFor(name);
    runners.set(name, runner);
    return runner;
};

/**
 * 装配。
 *
 * `src/main.ts` 在挂载应用之前调用一次。重复调用是安全的（只是重新注入同一批对象）。
 */
export const installCalendarRunner = (): void => {
    for (const name of MODULE_BY_NAME.keys()) {
        injectRunner(runnerOfModule(name), name);
    }

    /**
     * 全局兜底：模块名未知时用它。
     *
     * 这里刻意**不**做分派——兜底 runner 拿不到模块名，硬猜一个库会把错误藏起来。
     * 它只负责把"没人按模块注入"这件事报清楚（`sqlite.ts` 的 `notInjected` 文案
     * 已经写了这条，这里给的更具体：模块名要在登记表里）。
     */
    injectRunner({
        all: async (): Promise<Row[]> => {
            throw new Error("查询没有指定分库：请用 injectRunner(runner, \"<模块名>\") 按模块注入");
        },
        get: async (): Promise<Row | undefined> => {
            throw new Error("查询没有指定分库：请用 injectRunner(runner, \"<模块名>\") 按模块注入");
        },
        run: async (): Promise<void> => {
            throw new Error("分库是只读的：数据由 database/build.py 在构建期装入，运行期不写库");
        }
    });
};

/* -------------------------------------------------------------------------- */
/* 直接查询（页面用）                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 直接查一个分库。
 *
 * 数据访问层的 110 个文件覆盖了 `src/sql/*.sql` 里的全部标准语句，但页面偶尔要跑
 * 一条**只为这一页写的**聚合（工作台的"各分库行数占比"、命理页的"某年四柱"）。
 * 为它们各生成一份数据访问层不划算，所以留这个直查口子——它走的是同一条只读通道，
 * 边界（白名单、只读、行数上限）一条不少。
 */
export const queryModule = async (
    module: string,
    statement: string,
    parameters?: Bindings
): Promise<Row[]> => {
    assertModule(module);
    const result = await window.desktop.calendar.select({
        module,
        statement,
        parameters: asParameters(parameters)
    });
    return result.rows as Row[];
};

/** 直查单行。 */
export const queryModuleOne = async (
    module: string,
    statement: string,
    parameters?: Bindings
): Promise<Row | null> => {
    assertModule(module);
    return (await window.desktop.calendar.selectOne({
        module,
        statement,
        parameters: asParameters(parameters)
    })) as Row | null;
};

/** 分库的实时状态（表、行数、文件是否存在）。工作台与 `/system/datasource` 用它。 */
export const readModuleStates = (): ReturnType<typeof window.desktop.calendar.modules> =>
    window.desktop.calendar.modules();

/**
 * 取一张表的列。
 *
 * 表名由主进程按分库登记表白名单校验后才拼进 `PRAGMA`（见 `main/database.ts`），
 * 所以这里传错表名会得到一条明确的拒绝，而不是一条无效 SQL。
 */
export const readTableColumns = (
    module: string,
    table: string
): ReturnType<typeof window.desktop.calendar.columns> => {
    assertModule(module);
    return window.desktop.calendar.columns({ module, table });
};
