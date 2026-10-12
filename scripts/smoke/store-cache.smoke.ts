/**
 * store 层缓存烟测：验证「读穿缓存」的命中、并发合并、LRU 淘汰、失效与预取。
 *
 * 运行（Node 不能直接跑带无扩展名 import 的 TS，先用 esbuild 打成一个文件）：
 *
 *     node node_modules/esbuild/bin/esbuild scripts/smoke/store-cache.smoke.ts --bundle --platform=node --format=esm --outfile=smoke.mjs
 *     node smoke.mjs
 *
 * 全部断言通过时退出码为 0；失败会列出具体断言名并以 1 退出。
 * 假 service 只统计回源次数，不碰 src/sqlite，因此可脱离 Electron 与数据库单独跑。
 */
import { createPinia, setActivePinia } from "pinia";

import { defineEntityStore } from "../../src/store/store";
import type { CrudService, Page, Query } from "../../src/service/service";
import { queryOf } from "../../src/service/service";

interface Row {
    identity: bigint;
    name: string;
    value: bigint;
}

interface Calls {
    list: number;
    get: number;
    select: number;
    count: number;
    byIds: number;
}

const data = new Map<string, Row>();
for (let index = 1; index <= 5; index += 1) {
    data.set(String(index), {
        identity: BigInt(index),
        name: `row-${index}`,
        value: BigInt(index * 10)
    });
}

const delay = async (milliseconds: number): Promise<void> =>
    await new Promise((resolve) => setTimeout(resolve, milliseconds));

/** 每个 store 用一份独立的假 service，回源次数各记各的。 */
const makeService = (): { service: CrudService<bigint, Row>; calls: Calls } => {
    const calls: Calls = { list: 0, get: 0, select: 0, count: 0, byIds: 0 };
    const service: CrudService<bigint, Row> = {
        async count(): Promise<bigint> {
            calls.count += 1;
            return BigInt(data.size);
        },
        async countBy(): Promise<bigint> {
            return 0n;
        },
        async exists(identity: bigint): Promise<boolean> {
            return data.has(String(identity));
        },
        async existsBy(): Promise<boolean> {
            return false;
        },
        async list(query: Query<bigint, Row>): Promise<Page<bigint, Row>> {
            calls.list += 1;
            const all = [...data.values()];
            const start = Number(query.index * query.size);
            const content = all.slice(start, start + Number(query.size));
            return {
                sort: query.sort ?? { orders: [] },
                content: content,
                index: query.index,
                size: query.size,
                empty: content.length === 0,
                pages: BigInt(Math.ceil(all.length / Number(query.size))),
                elements: BigInt(all.length)
            };
        },
        async listByIdentities(identities: Array<bigint>): Promise<Array<Row>> {
            calls.byIds += 1;
            return identities
                .map((identity: bigint): Row | undefined => data.get(String(identity)))
                .filter((row: Row | undefined): row is Row => row !== undefined);
        },
        async get(identity: bigint): Promise<Row> {
            calls.get += 1;
            if (identity === 5n) {
                await delay(30);
            }
            const found = data.get(String(identity));
            if (found === undefined) {
                throw new Error(`not found: ${identity}`);
            }
            return found;
        },
        async find(query): Promise<Page<bigint, Row>> {
            return await service.list(query);
        },
        async first(): Promise<never> {
            throw new Error("未使用");
        },
        async one(): Promise<never> {
            throw new Error("未使用");
        },
        async select<K extends keyof Row>(
            identity: bigint,
            fields: Array<K>
        ): Promise<Pick<Row, K>> {
            calls.select += 1;
            const found = data.get(String(identity));
            if (found === undefined) {
                throw new Error(`not found: ${identity}`);
            }
            const picked: Partial<Row> = {};
            for (const field of fields) {
                picked[field] = found[field];
            }
            return picked as Pick<Row, K>;
        },
        async selectBy(): Promise<Array<never>> {
            return [];
        }
    };
    return { service, calls };
};

const failures: Array<string> = [];
const check = (label: string, condition: boolean, detail?: string): void => {
    if (!condition) {
        failures.push(label);
    }
    console.log(`${condition ? "  ✓" : "  ✗"} ${label}${detail === undefined ? "" : `  ${detail}`}`);
};

const main = async (): Promise<void> => {
    setActivePinia(createPinia());

    console.log("— 分页缓存 + 总数缓存 —");
    {
        const { service, calls } = makeService();
        const store = defineEntityStore<bigint, Row>("smoke-page", service, { pages: 2 })();
        const first = queryOf<bigint, Row>(0n, 2n);
        await store.load(first);
        check("首次 load 回源一次", calls.list === 1, `list=${calls.list}`);
        check(
            "items 两行、page.elements 是总数",
            store.items.length === 2 && store.page.elements === "5"
        );
        await store.load(queryOf<bigint, Row>(0n, 2n));
        check("同查询第二次命中，不回源", calls.list === 1, `list=${calls.list}`);
        check("分页命中计数 +1", store.stats().pageHits === 1);
        await store.load(queryOf<bigint, Row>(1n, 2n));
        check("换一页是新指纹，回源", calls.list === 2, `list=${calls.list}`);
        const firstTotal = await store.count();
        const secondTotal = await store.count();
        check("count 回源一次后命中", calls.count === 1, `count=${calls.count}`);
        check("两次总数一致且为 5", firstTotal === 5n && secondTotal === 5n);
        check("总数命中计数 +1", store.stats().totalHits === 1);
    }

    console.log("— 行缓存 + 投影 —");
    {
        const { service, calls } = makeService();
        const store = defineEntityStore<bigint, Row>("smoke-row", service)();
        await store.loadByIdentity(1n);
        check("首次按主键取行回源一次", calls.get === 1, `get=${calls.get}`);
        await store.loadByIdentity(1n);
        check("第二次命中行缓存，不回源", calls.get === 1, `get=${calls.get}`);
        const projected = await store.select(1n, ["name"]);
        check("缓存行上取投影不回源（连 SQL 都不发）", calls.select === 0, `select=${calls.select}`);
        check("投影值正确", projected?.name === "row-1", JSON.stringify(projected));
        await store.select(4n, ["name"]);
        check("未缓存的行取投影才回源", calls.select === 1, `select=${calls.select}`);
        const before = calls.get;
        await Promise.all([store.loadByIdentity(5n), store.loadByIdentity(5n)]);
        check(
            "同一主键并发只回源一次（合并 Promise）",
            calls.get - before === 1,
            `get +${calls.get - before}`
        );
    }

    console.log("— LRU 淘汰与分页自愈 —");
    {
        const { service, calls } = makeService();
        const store = defineEntityStore<bigint, Row>("smoke-lru", service, {
            rows: 2,
            pages: 2
        })();
        await store.load(queryOf<bigint, Row>(0n, 2n));
        check("分页加载把整页写进行缓存", store.hasRow(1n) && store.hasRow(2n));
        await store.loadByIdentity(3n);
        check("行缓存不超过容量 2", store.stats().rows === 2, `rows=${store.stats().rows}`);
        check("最久未用的行 1 被淘汰", !store.hasRow(1n) && store.hasRow(3n));
        const listBefore = calls.list;
        await store.load(queryOf<bigint, Row>(0n, 2n));
        check(
            "行被淘汰后该页自动回源重建",
            calls.list === listBefore + 1,
            `list +${calls.list - listBefore}`
        );
        check("重建后行 1 回到缓存", store.hasRow(1n));
    }

    console.log("— 本地写入 / 失效 / 重置 —");
    {
        const { service, calls } = makeService();
        const store = defineEntityStore<bigint, Row>("smoke-write", service)();
        await store.load(queryOf<bigint, Row>(0n, 2n));
        await store.count();
        check("写入前：分页缓存 1 页、总数已缓存", store.stats().pages === 1 && store.stats().total);
        store.create({ identity: 9n, name: "new", value: 0n });
        check("新行写穿行缓存", store.hasRow(9n));
        check("新主键使分页缓存整体失效", store.stats().pages === 0);
        check("新主键使总数缓存失效", store.stats().total === false);
        await store.count();
        check("失效后 count 重新回源", calls.count === 2, `count=${calls.count}`);
        store.reset();
        check("reset 清视图状态", store.items.length === 0 && store.current === null);
        check("reset 不动缓存", store.stats().rows > 0);
        store.replace({ identity: 1n, name: "row-1-fixed", value: 1n });
        check("replace 写穿行缓存", store.cachedRow(1n)?.name === "row-1-fixed");
        await store.loadByIdentity(1n);
        check("replace 后按主键读不再回源", calls.get === 0, `get=${calls.get}`);
        store.invalidate(1n);
        check("invalidate 丢单行", !store.hasRow(1n));
        store.invalidateAll();
        check(
            "invalidateAll 清空全部缓存",
            store.stats().rows === 0 && store.stats().pages === 0 && !store.stats().total
        );
    }

    console.log("— 预取 —");
    {
        const { service, calls } = makeService();
        const store = defineEntityStore<bigint, Row>("smoke-prefetch", service)();
        const fetched = await store.prefetch([1n, 2n, 3n]);
        check("预取 3 个缺失主键，回源一次", fetched === 3 && calls.byIds === 1, `fetched=${fetched}`);
        check("已缓存的主键不再回源", (await store.prefetch([1n, 2n])) === 0 && calls.byIds === 1);
        check("部分缺失时只取缺失的那个", (await store.prefetch([3n, 4n])) === 1 && calls.byIds === 2);
        await store.loadByIdentity(1n);
        check("预取过的行按主键读命中（get 不发）", calls.get === 0, `get=${calls.get}`);
    }

    console.log("");
    if (failures.length > 0) {
        console.log(`失败 ${failures.length} 项：\n  - ${failures.join("\n  - ")}`);
        process.exitCode = 1;
        return;
    }
    console.log("全部通过：缓存命中、并发合并、LRU、失效、预取均按预期工作");
};

await main();
