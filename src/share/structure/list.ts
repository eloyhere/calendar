/**
 * 列表结构：数组、双向链表、跳表。
 *
 * ## 为什么这里现在有实现了
 *
 * 原先这三个类是**空壳**（`export class ArrayList<E> {}`），靠 `tsc` 的
 * TS6133（"泛型参数从未被使用"）报错来标记"这里是待实现的"。那个做法的问题是：
 *
 * 1. **`npm run build` 永远是失败的**——`build` 里带 `typecheck`，
 *    而 `typecheck` 必然会报这几条。一个永远失败的构建脚本不算构建脚本，
 *    它会让真正的失败淹没在噪音里；
 * 2. 空壳一旦被 import，调用方以为能用，实际调用就 `undefined is not a function`。
 *
 * 所以改成**最小可用实现**：方法少，但每个都真的工作。
 * 需要更多方法时再加，而不是一次写一个完整的标准库。
 *
 * ## 复杂度与用途
 *
 * | 结构         | 随机访问 | 头部插入 | 查找 | 什么时候用                     |
 * | ------------ | -------- | -------- | ---- | ------------------------------ |
 * | `ArrayList`  | O(1)     | O(n)     | O(n) | 默认。历表的行、日历的格子     |
 * | `LinkedList` | O(n)     | O(1)     | O(n) | 频繁在两端增删的队列           |
 * | `SkipList`   | O(log n) | O(log n) | O(log n) | 需要有序且频繁插入（时间轴）|
 *
 * 本项目的实际数据量：`temporal` 1073 万行、朔望月 29 万行。
 * **不要**把 29 万行塞进 `ArrayList` 再线性查找——那正是分库与 SQL 索引存在的理由。
 * 这三个结构是给"一屏之内"的数据用的（几十到几千条）。
 */

/** 顺序表：底层是数组，随机访问最快。 */
export class ArrayList<E> {
    private items: E[] = [];

    /** 元素个数。 */
    public get size(): number {
        return this.items.length;
    }

    /** 追加。 */
    public add(value: E): void {
        this.items.push(value);
    }

    /** 按下标取；越界返回 `undefined`（不抛错——历表里越界是常见情形）。 */
    public get(index: number): E | undefined {
        return this.items[index];
    }

    /** 按下标设值。 */
    public set(index: number, value: E): void {
        this.items[index] = value;
    }

    /** 按下标删，返回被删的元素。 */
    public removeAt(index: number): E | undefined {
        if (index < 0 || index >= this.items.length) {
            return undefined;
        }
        return this.items.splice(index, 1)[0];
    }

    /** 线性查找，返回第一个匹配的下标；没有返回 `-1`。 */
    public indexOf(predicate: (value: E) => boolean): number {
        return this.items.findIndex(predicate);
    }

    /** 转成普通数组（给需要 `v-for` 的地方用）。 */
    public toArray(): readonly E[] {
        return this.items;
    }

    /** 清空。 */
    public clear(): void {
        this.items.length = 0;
    }
}

/** 双向链表的节点。 */
interface ListNode<E> {
    value: E;
    previous: ListNode<E> | null;
    next: ListNode<E> | null;
}

/** 双向链表：两端增删 O(1)，代价是按下标取要遍历。 */
export class LinkedList<E> {
    private head: ListNode<E> | null = null;

    private tail: ListNode<E> | null = null;

    private count = 0;

    public get size(): number {
        return this.count;
    }

    /** 尾部追加（队列的入队）。 */
    public push(value: E): void {
        const node: ListNode<E> = { value, previous: this.tail, next: null };
        if (this.tail === null) {
            this.head = node;
        } else {
            this.tail.next = node;
        }
        this.tail = node;
        this.count += 1;
    }

    /** 头部追加（栈的压入）。 */
    public unshift(value: E): void {
        const node: ListNode<E> = { value, previous: null, next: this.head };
        if (this.head === null) {
            this.tail = node;
        } else {
            this.head.previous = node;
        }
        this.head = node;
        this.count += 1;
    }

    /** 头部取出（出队 / 出栈）。 */
    public shift(): E | undefined {
        const node = this.head;
        if (node === null) {
            return undefined;
        }
        this.head = node.next;
        if (this.head === null) {
            this.tail = null;
        } else {
            this.head.previous = null;
        }
        this.count -= 1;
        return node.value;
    }

    /** 尾部取出。 */
    public pop(): E | undefined {
        const node = this.tail;
        if (node === null) {
            return undefined;
        }
        this.tail = node.previous;
        if (this.tail === null) {
            this.head = null;
        } else {
            this.tail.next = null;
        }
        this.count -= 1;
        return node.value;
    }

    /** 从头到尾遍历。 */
    public *values(): IterableIterator<E> {
        let cursor = this.head;
        while (cursor !== null) {
            yield cursor.value;
            cursor = cursor.next;
        }
    }

    public toArray(): E[] {
        return [...this.values()];
    }

    public clear(): void {
        this.head = null;
        this.tail = null;
        this.count = 0;
    }
}

/**
 * 跳表的层节点。
 *
 * `layers` 的元素**可以是 `null`**——那是"这一层到此为止"的哨兵。
 * 类型里必须写出来：写成 `SkipNode<E>[]` 会让"末尾"无法表达，
 * 于是要么到处断言、要么用 `undefined` 蒙混。
 */
interface SkipNode<E> {
    value: E;
    /** 每一层的下一个节点；`layers[0]` 是原始链表，`null` 表示该层结束 */
    layers: (SkipNode<E> | null)[];
}

/**
 * 跳表：有序 + 插入 O(log n) 平均。
 *
 * 时间轴这类数据要"按 `absolute` 排序 + 频繁插入"，
 * 数组插入是 O(n)、平衡树要写旋转。跳表用随机层数换平衡，
 * 实现比红黑树短一个数量级。
 *
 * `compare` 必须给出**全序**（相等返回 0）。不给就没法维持有序，
 * 所以它是构造参数而不是可选。
 */
export class SkipList<E> {
    /** 最大层数。32 层够到 2^32 个元素，远超本项目任何一屏的数据量 */
    private static readonly MAX_LEVEL = 32;

    /** 每上升一层的概率 1/4：期望层数 1.33，查找路径比 1/2 更短 */
    private static readonly RATIO = 0.25;

    private readonly compare: (left: E, right: E) => number;

    private readonly head: SkipNode<E>;

    private level = 1;

    private count = 0;

    public constructor(compare: (left: E, right: E) => number) {
        this.compare = compare;
        this.head = { value: undefined as unknown as E, layers: new Array(SkipList.MAX_LEVEL).fill(null) };
    }

    public get size(): number {
        return this.count;
    }

    /** 随机层数。 */
    private randomLevel(): number {
        let level = 1;
        while (level < SkipList.MAX_LEVEL && Math.random() < SkipList.RATIO) {
            level += 1;
        }
        return level;
    }

    /** 插入一个元素。允许重复值（按 `compare` 相等时插在已有的前面）。 */
    public insert(value: E): void {
        /*
         * `update[layer]` 是"第 layer 层上，新节点要插在谁后面"。
         *
         * 初值必须是头节点——**每一层都要先指向头**，否则新开出来的高层
         * 没有前驱可挂。头节点的 `value` 是 `undefined`，但它从不被读：
         * 所有遍历都从 `head.layers[layer]` 开始。
         */
        const update: SkipNode<E>[] = new Array(SkipList.MAX_LEVEL).fill(this.head) as SkipNode<E>[];
        let cursor = this.head;

        for (let layer = this.level - 1; layer >= 0; layer -= 1) {
            /*
             * 取到局部变量再判空。
             *
             * 写成 `cursor.layers[layer] !== null && this.compare(cursor.layers[layer].value, ...)`
             * 是过不了类型检查的：TypeScript **不会**跨两次下标访问做收窄
             * （索引访问可能每次返回不同的值）。这不是类型系统的毛病，
             * 它是对的——局部变量才让"同一个值"这件事显式。
             */
            let next = cursor.layers[layer];
            while (next !== null && this.compare(next.value, value) < 0) {
                cursor = next;
                next = cursor.layers[layer];
            }
            update[layer] = cursor;
        }

        const level = this.randomLevel();
        if (level > this.level) {
            for (let layer = this.level; layer < level; layer += 1) {
                update[layer] = this.head;
            }
            this.level = level;
        }

        const node: SkipNode<E> = { value, layers: new Array(level).fill(null) as (SkipNode<E> | null)[] };
        for (let layer = 0; layer < level; layer += 1) {
            node.layers[layer] = update[layer].layers[layer];
            update[layer].layers[layer] = node;
        }
        this.count += 1;
    }

    /** 按 `compare` 找第一个不小于 `target` 的节点。 */
    private lowerBound(target: E): SkipNode<E> | null {
        let cursor = this.head;
        for (let layer = this.level - 1; layer >= 0; layer -= 1) {
            let next = cursor.layers[layer];
            while (next !== null && this.compare(next.value, target) < 0) {
                cursor = next;
                next = cursor.layers[layer];
            }
        }
        return cursor.layers[0];
    }

    /** 取第一个与 `compare` 相等的元素。 */
    public find(target: E): E | undefined {
        const node = this.lowerBound(target);
        return node !== null && this.compare(node.value, target) === 0 ? node.value : undefined;
    }

    /**
     * 取区间 `[from, to]` 内的元素（两端按 `compare` 判定，含端点）。
     *
     * 这是跳表在本项目里的主要用法：历表按 `absolute` 建跳表，
     * 一屏只取 `[窗口起, 窗口止]` 那几十条。
     */
    public range(from: E, to: E): E[] {
        const out: E[] = [];
        let node = this.lowerBound(from);
        while (node !== null && this.compare(node.value, to) <= 0) {
            out.push(node.value);
            node = node.layers[0];
        }
        return out;
    }

    /** 按顺序全部取出。 */
    public toArray(): E[] {
        const out: E[] = [];
        let node = this.head.layers[0];
        while (node !== null) {
            out.push(node.value);
            node = node.layers[0];
        }
        return out;
    }

    public clear(): void {
        this.head.layers.fill(null);
        this.level = 1;
        this.count = 0;
    }
}
