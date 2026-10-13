/**
 * 映射结构：保序映射与无序映射。
 *
 * ## 为什么这里现在有实现了
 *
 * 原先两个类是空壳（`export class OrderedMap<K, V> {}`），靠 `tsc` 的 TS6205
 * 报错标记"待实现"。那个做法的问题是 **`npm run build` 永远是失败的**
 * （`build` 带 `typecheck`），真正的失败会淹没在噪音里。
 * 现在换成最小可用实现。
 *
 * ## 与原生 `Map` 的关系
 *
 * `UnorderedMap` 就是原生 `Map` 的薄包装——它存在的意义只是给调用方一个
 * **表明"我不在乎顺序"** 的类型。这种"用类型表达意图"的写法在
 * `src/entity/temporal.ts` 的 `Identity` 符号上也用过。
 *
 * `OrderedMap` 按**键的函数值**排序。这一点必须写清楚：它不是"插入顺序"
 * （那是原生 `Map` 就有的），而是"按键排序"——历表要按 `absolute` 有序遍历，
 * 而插入顺序是随机的。
 *
 * ## 实现选择
 *
 * 有序映射用 `Map` 存值 + 一个**惰性排序的键数组**。
 * 不用每插入一次就排一次：历表是"先批量装入、再反复读"，所以把排序推迟到
 * 第一次读的时候，写放大从 O(n log n) 每次降到总共一次。
 * 任何写操作把排序标记置脏。
 */

/** 无序映射：原生 `Map` 的薄包装，用类型表明"不关心顺序"。 */
export class UnorderedMap<K, V> {
    private readonly entries = new Map<K, V>();

    public get size(): number {
        return this.entries.size;
    }

    public set(key: K, value: V): this {
        this.entries.set(key, value);
        return this;
    }

    public get(key: K): V | undefined {
        return this.entries.get(key);
    }

    public has(key: K): boolean {
        return this.entries.has(key);
    }

    public delete(key: K): boolean {
        return this.entries.delete(key);
    }

    public clear(): void {
        this.entries.clear();
    }

    public keys(): IterableIterator<K> {
        return this.entries.keys();
    }

    public values(): IterableIterator<V> {
        return this.entries.values();
    }

    /** 转成普通对象——只对字符串键有意义，其他键会被 `String()` 化。 */
    public toObject(): Record<string, V> {
        const out: Record<string, V> = {};
        for (const [key, value] of this.entries) {
            out[String(key)] = value;
        }
        return out;
    }
}

/**
 * 保序映射：按键的函数值排序（**不是插入顺序**）。
 *
 * `compare` 必须给出全序。不给的话"有序"就没有定义，
 * 所以它是构造参数而不是可选项——这一点与 `SkipList` 同理。
 */
export class OrderedMap<K, V> {
    private readonly values = new Map<K, V>();

    private readonly compare: (left: K, right: K) => number;

    /** 排好序的键缓存；写操作把它置脏 */
    private sorted: K[] | null = null;

    public constructor(compare: (left: K, right: K) => number) {
        this.compare = compare;
    }

    public get size(): number {
        return this.values.size;
    }

    public set(key: K, value: V): this {
        this.values.set(key, value);
        this.sorted = null;
        return this;
    }

    public get(key: K): V | undefined {
        return this.values.get(key);
    }

    public has(key: K): boolean {
        return this.values.has(key);
    }

    public delete(key: K): boolean {
        const removed = this.values.delete(key);
        if (removed) {
            this.sorted = null;
        }
        return removed;
    }

    public clear(): void {
        this.values.clear();
        this.sorted = null;
    }

    /** 排好序的键（惰性，第一次读时排一次）。 */
    private sortedKeys(): K[] {
        if (this.sorted === null) {
            this.sorted = [...this.values.keys()].sort(this.compare);
        }
        return this.sorted;
    }

    /** 按键序取键。 */
    public keys(): K[] {
        return this.sortedKeys();
    }

    /** 按键序取值。 */
    public valuesInOrder(): V[] {
        return this.sortedKeys().map((key) => this.values.get(key) as V);
    }

    /** 按键序取键值对。 */
    public entries(): [K, V][] {
        return this.sortedKeys().map((key) => [key, this.values.get(key) as V]);
    }

    /**
     * 取键落在 `[from, to]` 内的值（端点按 `compare` 判定，含端点）。
     *
     * 这是本项目的主要用法：历表按 `absolute` 有序，一屏只取窗口内的几十条。
     * 用二分找起点再顺取——键已经有序，不必扫全表。
     */
    public range(from: K, to: K): [K, V][] {
        const keys = this.sortedKeys();
        let low = 0;
        let high = keys.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (this.compare(keys[middle], from) < 0) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }

        const out: [K, V][] = [];
        for (let index = low; index < keys.length && this.compare(keys[index], to) <= 0; index += 1) {
            out.push([keys[index], this.values.get(keys[index]) as V]);
        }
        return out;
    }

    /** 第一个键（最小）。 */
    public first(): K | undefined {
        return this.sortedKeys()[0];
    }

    /** 最后一个键（最大）。 */
    public last(): K | undefined {
        const keys = this.sortedKeys();
        return keys[keys.length - 1];
    }
}
