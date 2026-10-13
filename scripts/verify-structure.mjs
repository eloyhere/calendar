/**
 * `src/share/structure/` 三个结构的**行为**校验。
 *
 * ## 为什么需要
 *
 * 上一轮把 `ArrayList` / `LinkedList` / `SkipList` / `OrderedMap` / `UnorderedMap`
 * 从空壳改成了实现。改完 `npm run build` 通过了——但那只证明**它们能编译**，
 * 不证明它们对。跳表的随机层数、`OrderedMap` 的惰性排序缓存、
 * `LinkedList` 的指针反转，这几处都是"写错了也编译得过"的典型。
 *
 * 所以这里跑真实断言。断言只覆盖**本项目会用到的语义**，不追求把
 * 标准库测一遍。
 *
 * ## 怎么加载 TypeScript
 *
 * Node 24 原生支持运行 `.ts`（类型擦除），而这几个文件没有 import，
 * 所以直接动态 import 即可，不需要 esbuild 或 ts-node。
 *
 * 用法：`node scripts/verify-structure.mjs`
 */

const { ArrayList, LinkedList, SkipList } = await import("../src/share/structure/list.ts");
const { OrderedMap, UnorderedMap } = await import("../src/share/structure/map.ts");

let failures = 0;

/** 断言。 */
const check = (label, actual, expected) => {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        console.error(`✗ ${label}\n    实际 ${a}\n    期望 ${b}`);
        failures += 1;
    }
};

/* ---------------------------------------------------------------- ArrayList */

{
    const list = new ArrayList();
    check("ArrayList 空表长度", list.size, 0);
    check("ArrayList 空表取值为 undefined", list.get(0), undefined);

    list.add("a");
    list.add("b");
    list.add("c");
    check("ArrayList 追加后长度", list.size, 3);
    check("ArrayList 按下标取", [list.get(0), list.get(1), list.get(2)], ["a", "b", "c"]);

    list.set(1, "B");
    check("ArrayList 按下标改", list.get(1), "B");

    check("ArrayList 删除返回值", list.removeAt(1), "B");
    check("ArrayList 删除后长度", list.size, 2);
    check("ArrayList 越界删除", list.removeAt(9), undefined);

    check("ArrayList indexOf 命中", list.indexOf((value) => value === "c"), 1);
    check("ArrayList indexOf 未命中", list.indexOf((value) => value === "z"), -1);

    list.clear();
    check("ArrayList 清空", list.size, 0);
}

/* --------------------------------------------------------------- LinkedList */

{
    const list = new LinkedList();
    check("LinkedList 空表 shift", list.shift(), undefined);
    check("LinkedList 空表 pop", list.pop(), undefined);

    list.push(1);
    list.push(2);
    list.push(3);
    check("LinkedList push 后顺序", list.toArray(), [1, 2, 3]);

    list.unshift(0);
    check("LinkedList unshift 后顺序", list.toArray(), [0, 1, 2, 3]);

    check("LinkedList shift", list.shift(), 0);
    check("LinkedList pop", list.pop(), 3);
    check("LinkedList 两端取出后剩余", list.toArray(), [1, 2]);

    /* 取空之后头尾都要归位——这是双向链表最容易漏的一步 */
    list.shift();
    list.shift();
    check("LinkedList 取空后长度", list.size, 0);
    check("LinkedList 取空后仍能 push", (list.push(9), list.toArray()), [9]);
    check("LinkedList 取空后再 pop", list.pop(), 9);
    check("LinkedList 再次取空", list.toArray(), []);
}

/* ----------------------------------------------------------------- SkipList */

{
    /* 比较函数用数值全序 */
    const list = new SkipList((left, right) => left - right);
    check("SkipList 空表长度", list.size, 0);
    check("SkipList 空表查找", list.find(1), undefined);
    check("SkipList 空表区间", list.range(0, 100), []);

    /* 打乱顺序插入，取出必须是升序——这才是跳表的意义 */
    const input = [50, 12, 88, 3, 71, 29, 64, 7, 95, 41, 18, 56, 33, 79, 2];
    for (const value of input) {
        list.insert(value);
    }

    check("SkipList 长度", list.size, input.length);
    check("SkipList 有序取出", list.toArray(), [...input].sort((a, b) => a - b));

    check("SkipList 命中查找", list.find(71), 71);
    check("SkipList 未命中查找", list.find(72), undefined);

    /* 区间：两端都含 */
    const inRange = list.toArray().filter((value) => value >= 29 && value <= 64);
    check("SkipList range 含端点", list.range(29, 64), inRange);

    /* 边界：完全落在数据之外 */
    check("SkipList range 全在左侧", list.range(-100, -1), []);
    check("SkipList range 全在右侧", list.range(1000, 2000), []);
    check("SkipList range 只含最小", list.range(0, 2), [2]);
    check("SkipList range 单点", list.range(50, 50), [50]);

    /* 大量插入：验证随机层数不会把结构弄坏 */
    const big = new SkipList((left, right) => left - right);
    for (let index = 0; index < 500; index += 1) {
        big.insert((index * 37) % 500);
    }
    check("SkipList 500 条去重后长度", big.size, 500);
    const sorted = big.toArray();
    check("SkipList 500 条仍然有序", sorted.every((value, index) => index === 0 || sorted[index - 1] <= value), true);
    check("SkipList 500 条区间取数正确", big.range(100, 109).length, 10);

    big.clear();
    check("SkipList 清空", big.size, 0);
    check("SkipList 清空后可再插", (big.insert(5), big.toArray()), [5]);
}

/* -------------------------------------------------------------- UnorderedMap */

{
    const map = new UnorderedMap();
    check("UnorderedMap 空表", map.size, 0);
    check("UnorderedMap 未命中", map.get("a"), undefined);

    map.set("a", 1).set("b", 2);
    check("UnorderedMap 取值", [map.get("a"), map.get("b")], [1, 2]);
    check("UnorderedMap has", [map.has("a"), map.has("z")], [true, false]);

    check("UnorderedMap 删除", map.delete("a"), true);
    check("UnorderedMap 重复删除", map.delete("a"), false);
    check("UnorderedMap 删除后长度", map.size, 1);
    check("UnorderedMap 转对象", map.toObject(), { b: 2 });
}

/* ---------------------------------------------------------------- OrderedMap */

{
    /* 键是数字，按数值排序——**不是插入顺序** */
    const map = new OrderedMap((left, right) => left - right);

    /* 故意乱序插入 */
    map.set(50, "五十").set(10, "十").set(30, "三十").set(20, "二十");

    check("OrderedMap 按键序取键", map.keys(), [10, 20, 30, 50]);
    check("OrderedMap 按键序取值", map.valuesInOrder(), ["十", "二十", "三十", "五十"]);
    check("OrderedMap 首键", map.first(), 10);
    check("OrderedMap 末键", map.last(), 50);

    /*
     * 惰性排序缓存必须被写操作置脏。
     * 先读一次（把缓存建起来），再插入一个更小的键，看顺序有没有更新——
     * 这是"缓存忘了失效"这类 bug 的典型表现。
     */
    map.keys();
    map.set(5, "五");
    check("OrderedMap 写后缓存失效", map.keys(), [5, 10, 20, 30, 50]);

    map.keys();
    map.delete(20);
    check("OrderedMap 删后缓存失效", map.keys(), [5, 10, 30, 50]);

    check("OrderedMap 区间取键值对", map.range(10, 30), [
        [10, "十"],
        [30, "三十"]
    ]);
    check("OrderedMap 区间不含端点外", map.range(11, 29), []);
    check("OrderedMap 区间全在左侧", map.range(-100, 0), []);
    check("OrderedMap 区间全在右侧", map.range(100, 200), []);

    map.clear();
    check("OrderedMap 清空", map.size, 0);
    check("OrderedMap 清空后首个键", map.first(), undefined);
}

/* -------------------------------------------------------------------------- */

if (failures > 0) {
    console.error(`\n❌ ${failures} 条断言失败`);
    process.exit(1);
}

console.log("✅ ArrayList / LinkedList / SkipList / UnorderedMap / OrderedMap 行为断言全部通过");
