/**
 * 虚拟列表算术烟测：把 `computeVirtualRange()` 与 `scrollTopForIndex()` 的边界钉住。
 *
 * 运行（Node 24 能直接跑 `.ts`，靠类型擦除；**导入必须带 `.ts` 后缀**）：
 *
 *     node scripts/smoke/virtual-list.smoke.ts
 *
 * 旧版 Node 不认识 `.ts`，先打包再跑，效果一样：
 *
 *     node node_modules/esbuild/bin/esbuild scripts/smoke/virtual-list.smoke.ts --bundle --platform=node --format=esm --outfile=virtual-list.smoke.mjs
 *     node virtual-list.smoke.mjs
 *
 * 全部断言通过时退出码为 0；失败会列出具体断言名并以 1 退出。
 * 被测的是纯函数（不碰 DOM、不碰 Vue、不碰数据库），因此可脱离 Electron 单独跑。
 *
 * Node 会打一条 `MODULE_TYPELESS_PACKAGE_JSON` 提示（`.ts` 里写了 `import`，它按 ESM
 * 重新解析一次），不影响结果，也不必为此给 `package.json` 加 `"type": "module"`。
 *
 * 为什么值得单独测：虚拟列表出错的样子是「偶尔露白」「滚到底少一行」
 * 「数据变短后一片空白」——都能忍，所以都不会被发现。这里把每种情形写成一条断言，
 * 让它们变成会失败的测试。
 */
import {
    computeVirtualRange,
    scrollTopForIndex
} from "../../src/component/list/virtual/virtual-range.ts";
import type {
    ScrollAlign,
    VirtualRange,
    VirtualRangeInput
} from "../../src/component/list/virtual/virtual-range.ts";

/** 常用输入：1000 行、行高 36px、视口 360px（正好 10 行）、上下各 4 行缓冲。 */
const Base: VirtualRangeInput = {
    total: 1000,
    itemHeight: 36,
    viewportHeight: 360,
    scrollTop: 0,
    overscan: 4
};

/** 内容总高度：1000 × 36。 */
const ContentHeight = 36000;

/** 可滚的最大位置：内容高度减视口高度。 */
const MaxScrollTop = ContentHeight - Base.viewportHeight;

/** 一屏能看到几行。 */
const VisibleRows = Math.ceil(Base.viewportHeight / Base.itemHeight);

const failures: Array<string> = [];

const check = (label: string, condition: boolean, detail?: string): void => {
    if (!condition) {
        failures.push(label);
    }
    console.log(
        `${condition ? "  ✓" : "  ✗"} ${label}${detail === undefined ? "" : `  ${detail}`}`
    );
};

/**
 * 窗口是否完整盖住可视区。
 *
 * 缓冲可以多渲染，但**不能少**：少一行就是滚动时的一道白。这里按纯函数的同一套
 * 夹逼规则独立算一遍可视行区间，再和结果对照——不是把实现抄一遍，
 * 而是「实现在任何滚动位置都不许漏掉可视行」这条不变量。
 */
const coversViewport = (range: VirtualRange, input: VirtualRangeInput): boolean => {
    const limit = Math.max(0, range.totalHeight - input.viewportHeight);
    const scrollTop = Math.min(Math.max(0, input.scrollTop), limit);
    const first = Math.floor(scrollTop / input.itemHeight);
    const visible = Math.max(1, Math.ceil(input.viewportHeight / input.itemHeight));
    const lastVisible = Math.min(input.total - 1, first + visible - 1);
    return range.start <= first && range.end >= lastVisible;
};

const main = (): void => {
    console.log("— 顶部与窗口大小 —");
    {
        const range = computeVirtualRange(Base);
        check("首屏从第 0 行开始", range.start === 0 && range.offset === 0);
        check("首屏渲染一屏 + 下缓冲", range.end === VisibleRows - 1 + 4 && range.count === 14);
        check("总高度 = 行数 × 行高", range.totalHeight === ContentHeight, `${range.totalHeight}`);
        check("首屏没到底", range.atEnd === false);
        check("窗口覆盖可视区", coversViewport(range, Base));
    }

    console.log("— 中部滚动 —");
    {
        const middle: VirtualRangeInput = { ...Base, scrollTop: 50 * 36 };
        const range = computeVirtualRange(middle);
        check("首个可视行是 50，上缓冲吃掉 4 行", range.start === 46, `start=${range.start}`);
        check("末行 = 首行 + 一屏 - 1 + 下缓冲", range.end === 63, `end=${range.end}`);
        check("窗口偏移 = start × 行高", range.offset === 46 * 36, `offset=${range.offset}`);
        check("中部没到底", range.atEnd === false);
        check("窗口覆盖可视区", coversViewport(range, middle));

        const scrolled = computeVirtualRange({ ...middle, scrollTop: 51 * 36 });
        check("再滚一行，窗口整体下移一行", scrolled.start === range.start + 1);
    }

    console.log("— 到底与越界 —");
    {
        const bottom = computeVirtualRange({ ...Base, scrollTop: MaxScrollTop });
        check("到底时末行在窗口里", bottom.end === 999, `end=${bottom.end}`);
        check("到底标记为真", bottom.atEnd === true);
        check("窗口覆盖可视区", coversViewport(bottom, { ...Base, scrollTop: MaxScrollTop }));

        const beyond = computeVirtualRange({ ...Base, scrollTop: 999999 });
        check("滚过头与到底结果一致", JSON.stringify(beyond) === JSON.stringify(bottom));

        const negative = computeVirtualRange({ ...Base, scrollTop: -500 });
        check(
            "负的滚动位置夹回 0",
            JSON.stringify(negative) === JSON.stringify(computeVirtualRange(Base))
        );
    }

    console.log("— 数据比视口还短 —");
    {
        const short: VirtualRangeInput = { ...Base, total: 3 };
        const range = computeVirtualRange(short);
        check("三行全部渲染", range.start === 0 && range.end === 2 && range.count === 3);
        check("总高度只有三行", range.totalHeight === 108, `${range.totalHeight}`);
        check("已经到底（续页的依据）", range.atEnd === true);
        check("窗口覆盖可视区", coversViewport(range, short));
    }

    console.log("— 视口还没量到 —");
    {
        const unmeasured = computeVirtualRange({ ...Base, viewportHeight: 0 });
        check(
            "没量到视口时渲染首行 + 下缓冲共 5 行",
            unmeasured.start === 0 && unmeasured.end === 4 && unmeasured.count === 5,
            `end=${unmeasured.end}`
        );
        check("没量到时不算到底", unmeasured.atEnd === false);

        const shortUnmeasured = computeVirtualRange({ ...Base, total: 3, viewportHeight: 0 });
        check("短列表没量到也算到底", shortUnmeasured.atEnd === true);
    }

    console.log("— 缓冲为 0 —");
    {
        const tight: VirtualRangeInput = { ...Base, overscan: 0 };
        const top = computeVirtualRange(tight);
        check("顶部：正好一屏", top.start === 0 && top.end === VisibleRows - 1, `end=${top.end}`);

        const middle = computeVirtualRange({ ...tight, scrollTop: 50 * 36 });
        check("中部：正好一屏", middle.start === 50 && middle.end === 59, `start=${middle.start}`);
        check("窗口覆盖可视区", coversViewport(middle, { ...tight, scrollTop: 50 * 36 }));
    }

    console.log("— 输入兜底 —");
    {
        const zeroHeight = computeVirtualRange({ ...Base, itemHeight: 0 });
        check("行高 0 按 1px 处理", zeroHeight.totalHeight === 1000, `${zeroHeight.totalHeight}`);
        check(
            "行高 0 不产生 NaN",
            Number.isFinite(zeroHeight.start) && Number.isFinite(zeroHeight.end)
        );

        const nanHeight = computeVirtualRange({ ...Base, itemHeight: Number.NaN });
        check("行高 NaN 按 1px 处理", nanHeight.totalHeight === 1000);

        const empty = computeVirtualRange({ ...Base, total: 0 });
        check(
            "空列表是空区间",
            empty.count === 0 &&
                empty.end === -1 &&
                empty.totalHeight === 0 &&
                empty.atEnd === false
        );

        const negativeTotal = computeVirtualRange({ ...Base, total: -5 });
        check("负数行数按 0 处理", negativeTotal.count === 0 && negativeTotal.totalHeight === 0);

        const fractional = computeVirtualRange({ ...Base, total: 2.9 });
        check("小数行数向下取整", fractional.totalHeight === 72 && fractional.end === 1);

        const nanOverscan = computeVirtualRange({ ...Base, overscan: Number.NaN });
        const zeroOverscan = computeVirtualRange({ ...Base, overscan: 0 });
        check("缓冲 NaN 按 0 处理", JSON.stringify(nanOverscan) === JSON.stringify(zeroOverscan));

        const nanViewport = computeVirtualRange({ ...Base, viewportHeight: Number.NaN });
        const zeroViewport = computeVirtualRange({ ...Base, viewportHeight: 0 });
        check("视口 NaN 按 0 处理", JSON.stringify(nanViewport) === JSON.stringify(zeroViewport));

        const nanScroll = computeVirtualRange({ ...Base, scrollTop: Number.NaN });
        check(
            "滚动位置 NaN 按 0 处理",
            JSON.stringify(nanScroll) === JSON.stringify(computeVirtualRange(Base))
        );
    }

    console.log("— 把所有滚动位置扫一遍 —");
    {
        let previousStart = -1;
        let monotonic = true;
        let covers = true;
        let bounded = true;

        for (let position = -200; position <= ContentHeight + 200; position += 7) {
            const input: VirtualRangeInput = { ...Base, scrollTop: position };
            const range = computeVirtualRange(input);

            const insideTotal = range.start >= 0 && range.end <= Base.total - 1;
            const ordered = range.start <= range.end;
            const countMatches = range.count === range.end - range.start + 1;
            const offsetMatches = range.offset === range.start * Base.itemHeight;
            const heightMatches = range.totalHeight === ContentHeight;
            const endMatches = range.atEnd === range.end >= Base.total - 1;
            const notTooMany = range.count <= VisibleRows + 2 * Base.overscan + 1;

            if (!(insideTotal && ordered && countMatches && offsetMatches && heightMatches)) {
                bounded = false;
            }
            if (!(endMatches && notTooMany)) {
                bounded = false;
            }
            if (!coversViewport(range, input)) {
                covers = false;
            }
            if (range.start < previousStart) {
                monotonic = false;
            }
            previousStart = range.start;
        }

        check("每个位置的区间都自洽、不越界、行数有上限", bounded);
        check("每个位置的窗口都盖住可视区", covers);
        check("滚动位置增大时首行不倒退", monotonic);
    }

    console.log("— scrollToIndex 的对齐 —");
    {
        const target = (index: number, align: ScrollAlign): number =>
            scrollTopForIndex({
                index: index,
                align: align,
                itemHeight: Base.itemHeight,
                viewportHeight: Base.viewportHeight,
                total: Base.total
            });

        check(
            "顶对齐：目标行贴视口顶",
            target(500, "start") === 500 * 36,
            `${target(500, "start")}`
        );
        check("居中：上下各留一半", target(500, "center") === 500 * 36 - (360 - 36) / 2);
        check("底对齐：目标行贴视口底", target(500, "end") === 500 * 36 - 360 + 36);
        check("首行底对齐不会滚出负值", target(0, "end") === 0);
        check("末行顶对齐夹到最大滚动位置", target(999, "start") === MaxScrollTop);
        check("越界下标夹到末行", target(99999, "start") === MaxScrollTop);
        check("负数下标夹到首行", target(-5, "start") === 0);
        check("下标 NaN 按 0 处理", target(Number.NaN, "center") === 0);

        const emptyList = scrollTopForIndex({
            index: 10,
            align: "start",
            itemHeight: 36,
            viewportHeight: 360,
            total: 0
        });
        check("空列表恒为 0", emptyList === 0);

        const tallViewport = scrollTopForIndex({
            index: 900,
            align: "start",
            itemHeight: 36,
            viewportHeight: 99999,
            total: 1000
        });
        check("视口比内容还高时恒为 0", tallViewport === 0);

        let alwaysVisible = true;
        for (let index = 0; index < Base.total; index += 37) {
            for (const align of ["start", "center", "end"] as const) {
                const top = target(index, align);
                const rowTop = index * Base.itemHeight;
                const rowBottom = rowTop + Base.itemHeight;
                if (!(rowTop < top + Base.viewportHeight && rowBottom > top)) {
                    alwaysVisible = false;
                }
            }
        }
        check("任何对齐方式下目标行都落在视口里", alwaysVisible);
    }

    console.log("— 行高不同只是窗口更密 —");
    {
        const dense: VirtualRangeInput = { ...Base, itemHeight: 24 };
        const range = computeVirtualRange(dense);
        check("24px 行高：一屏 15 行 + 4 行缓冲", range.end === 18, `end=${range.end}`);
        check("总高度跟着行高走", range.totalHeight === 24000, `${range.totalHeight}`);
        check("窗口覆盖可视区", coversViewport(range, dense));
    }

    console.log("");
    if (failures.length > 0) {
        console.log(`失败 ${failures.length} 项：\n  - ${failures.join("\n  - ")}`);
        process.exitCode = 1;
        return;
    }
    console.log("全部通过：窗口计算、边界夹逼、到底判定与滚动定位均按预期工作");
};

main();
