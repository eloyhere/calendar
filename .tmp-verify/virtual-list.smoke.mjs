// src/component/list/virtual-range.ts
function safeItemHeight(itemHeight) {
  return Number.isFinite(itemHeight) && itemHeight > 0 ? itemHeight : 1;
}
function safeViewportHeight(viewportHeight) {
  return Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
}
function safeTotal(total) {
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}
function safeOverscan(overscan) {
  return Number.isFinite(overscan) && overscan > 0 ? Math.floor(overscan) : 0;
}
function computeVirtualRange(input) {
  const total = safeTotal(input.total);
  const itemHeight = safeItemHeight(input.itemHeight);
  const viewportHeight = safeViewportHeight(input.viewportHeight);
  if (total === 0) {
    return { start: 0, end: -1, count: 0, totalHeight: 0, offset: 0, atEnd: false };
  }
  const totalHeight = total * itemHeight;
  const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
  const rawScrollTop = Number.isFinite(input.scrollTop) ? input.scrollTop : 0;
  const scrollTop = Math.min(Math.max(0, rawScrollTop), maxScrollTop);
  const first = Math.floor(scrollTop / itemHeight);
  const visible = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const overscan = safeOverscan(input.overscan);
  const start = Math.max(0, first - overscan);
  const end = Math.min(total - 1, first + visible - 1 + overscan);
  return {
    start,
    end,
    count: end - start + 1,
    totalHeight,
    offset: start * itemHeight,
    // 末行在窗口里就算到底：行数不足一屏时首帧即为 true，正好触发续页。
    atEnd: end >= total - 1
  };
}
function scrollTopForIndex(input) {
  const total = safeTotal(input.total);
  if (total === 0) {
    return 0;
  }
  const itemHeight = safeItemHeight(input.itemHeight);
  const viewportHeight = safeViewportHeight(input.viewportHeight);
  const rawIndex = Number.isFinite(input.index) ? Math.floor(input.index) : 0;
  const index = Math.min(Math.max(0, rawIndex), total - 1);
  const top = index * itemHeight;
  const aligned = input.align === "center" ? top - (viewportHeight - itemHeight) / 2 : input.align === "end" ? top - viewportHeight + itemHeight : top;
  const maxScrollTop = Math.max(0, total * itemHeight - viewportHeight);
  return Math.min(Math.max(0, aligned), maxScrollTop);
}

// scripts/smoke/virtual-list.smoke.ts
var Base = {
  total: 1e3,
  itemHeight: 36,
  viewportHeight: 360,
  scrollTop: 0,
  overscan: 4
};
var ContentHeight = 36e3;
var MaxScrollTop = ContentHeight - Base.viewportHeight;
var VisibleRows = Math.ceil(Base.viewportHeight / Base.itemHeight);
var failures = [];
var check = (label, condition, detail) => {
  if (!condition) {
    failures.push(label);
  }
  console.log(
    `${condition ? "  \u2713" : "  \u2717"} ${label}${detail === void 0 ? "" : `  ${detail}`}`
  );
};
var coversViewport = (range, input) => {
  const limit = Math.max(0, range.totalHeight - input.viewportHeight);
  const scrollTop = Math.min(Math.max(0, input.scrollTop), limit);
  const first = Math.floor(scrollTop / input.itemHeight);
  const visible = Math.max(1, Math.ceil(input.viewportHeight / input.itemHeight));
  const lastVisible = Math.min(input.total - 1, first + visible - 1);
  return range.start <= first && range.end >= lastVisible;
};
var main = () => {
  console.log("\u2014 \u9876\u90E8\u4E0E\u7A97\u53E3\u5927\u5C0F \u2014");
  {
    const range = computeVirtualRange(Base);
    check("\u9996\u5C4F\u4ECE\u7B2C 0 \u884C\u5F00\u59CB", range.start === 0 && range.offset === 0);
    check("\u9996\u5C4F\u6E32\u67D3\u4E00\u5C4F + \u4E0B\u7F13\u51B2", range.end === VisibleRows - 1 + 4 && range.count === 14);
    check("\u603B\u9AD8\u5EA6 = \u884C\u6570 \xD7 \u884C\u9AD8", range.totalHeight === ContentHeight, `${range.totalHeight}`);
    check("\u9996\u5C4F\u6CA1\u5230\u5E95", range.atEnd === false);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(range, Base));
  }
  console.log("\u2014 \u4E2D\u90E8\u6EDA\u52A8 \u2014");
  {
    const middle = { ...Base, scrollTop: 50 * 36 };
    const range = computeVirtualRange(middle);
    check("\u9996\u4E2A\u53EF\u89C6\u884C\u662F 50\uFF0C\u4E0A\u7F13\u51B2\u5403\u6389 4 \u884C", range.start === 46, `start=${range.start}`);
    check("\u672B\u884C = \u9996\u884C + \u4E00\u5C4F - 1 + \u4E0B\u7F13\u51B2", range.end === 63, `end=${range.end}`);
    check("\u7A97\u53E3\u504F\u79FB = start \xD7 \u884C\u9AD8", range.offset === 46 * 36, `offset=${range.offset}`);
    check("\u4E2D\u90E8\u6CA1\u5230\u5E95", range.atEnd === false);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(range, middle));
    const scrolled = computeVirtualRange({ ...middle, scrollTop: 51 * 36 });
    check("\u518D\u6EDA\u4E00\u884C\uFF0C\u7A97\u53E3\u6574\u4F53\u4E0B\u79FB\u4E00\u884C", scrolled.start === range.start + 1);
  }
  console.log("\u2014 \u5230\u5E95\u4E0E\u8D8A\u754C \u2014");
  {
    const bottom = computeVirtualRange({ ...Base, scrollTop: MaxScrollTop });
    check("\u5230\u5E95\u65F6\u672B\u884C\u5728\u7A97\u53E3\u91CC", bottom.end === 999, `end=${bottom.end}`);
    check("\u5230\u5E95\u6807\u8BB0\u4E3A\u771F", bottom.atEnd === true);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(bottom, { ...Base, scrollTop: MaxScrollTop }));
    const beyond = computeVirtualRange({ ...Base, scrollTop: 999999 });
    check("\u6EDA\u8FC7\u5934\u4E0E\u5230\u5E95\u7ED3\u679C\u4E00\u81F4", JSON.stringify(beyond) === JSON.stringify(bottom));
    const negative = computeVirtualRange({ ...Base, scrollTop: -500 });
    check(
      "\u8D1F\u7684\u6EDA\u52A8\u4F4D\u7F6E\u5939\u56DE 0",
      JSON.stringify(negative) === JSON.stringify(computeVirtualRange(Base))
    );
  }
  console.log("\u2014 \u6570\u636E\u6BD4\u89C6\u53E3\u8FD8\u77ED \u2014");
  {
    const short = { ...Base, total: 3 };
    const range = computeVirtualRange(short);
    check("\u4E09\u884C\u5168\u90E8\u6E32\u67D3", range.start === 0 && range.end === 2 && range.count === 3);
    check("\u603B\u9AD8\u5EA6\u53EA\u6709\u4E09\u884C", range.totalHeight === 108, `${range.totalHeight}`);
    check("\u5DF2\u7ECF\u5230\u5E95\uFF08\u7EED\u9875\u7684\u4F9D\u636E\uFF09", range.atEnd === true);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(range, short));
  }
  console.log("\u2014 \u89C6\u53E3\u8FD8\u6CA1\u91CF\u5230 \u2014");
  {
    const unmeasured = computeVirtualRange({ ...Base, viewportHeight: 0 });
    check(
      "\u6CA1\u91CF\u5230\u89C6\u53E3\u65F6\u6E32\u67D3\u9996\u884C + \u4E0B\u7F13\u51B2\u5171 5 \u884C",
      unmeasured.start === 0 && unmeasured.end === 4 && unmeasured.count === 5,
      `end=${unmeasured.end}`
    );
    check("\u6CA1\u91CF\u5230\u65F6\u4E0D\u7B97\u5230\u5E95", unmeasured.atEnd === false);
    const shortUnmeasured = computeVirtualRange({ ...Base, total: 3, viewportHeight: 0 });
    check("\u77ED\u5217\u8868\u6CA1\u91CF\u5230\u4E5F\u7B97\u5230\u5E95", shortUnmeasured.atEnd === true);
  }
  console.log("\u2014 \u7F13\u51B2\u4E3A 0 \u2014");
  {
    const tight = { ...Base, overscan: 0 };
    const top = computeVirtualRange(tight);
    check("\u9876\u90E8\uFF1A\u6B63\u597D\u4E00\u5C4F", top.start === 0 && top.end === VisibleRows - 1, `end=${top.end}`);
    const middle = computeVirtualRange({ ...tight, scrollTop: 50 * 36 });
    check("\u4E2D\u90E8\uFF1A\u6B63\u597D\u4E00\u5C4F", middle.start === 50 && middle.end === 59, `start=${middle.start}`);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(middle, { ...tight, scrollTop: 50 * 36 }));
  }
  console.log("\u2014 \u8F93\u5165\u515C\u5E95 \u2014");
  {
    const zeroHeight = computeVirtualRange({ ...Base, itemHeight: 0 });
    check("\u884C\u9AD8 0 \u6309 1px \u5904\u7406", zeroHeight.totalHeight === 1e3, `${zeroHeight.totalHeight}`);
    check(
      "\u884C\u9AD8 0 \u4E0D\u4EA7\u751F NaN",
      Number.isFinite(zeroHeight.start) && Number.isFinite(zeroHeight.end)
    );
    const nanHeight = computeVirtualRange({ ...Base, itemHeight: Number.NaN });
    check("\u884C\u9AD8 NaN \u6309 1px \u5904\u7406", nanHeight.totalHeight === 1e3);
    const empty = computeVirtualRange({ ...Base, total: 0 });
    check(
      "\u7A7A\u5217\u8868\u662F\u7A7A\u533A\u95F4",
      empty.count === 0 && empty.end === -1 && empty.totalHeight === 0 && empty.atEnd === false
    );
    const negativeTotal = computeVirtualRange({ ...Base, total: -5 });
    check("\u8D1F\u6570\u884C\u6570\u6309 0 \u5904\u7406", negativeTotal.count === 0 && negativeTotal.totalHeight === 0);
    const fractional = computeVirtualRange({ ...Base, total: 2.9 });
    check("\u5C0F\u6570\u884C\u6570\u5411\u4E0B\u53D6\u6574", fractional.totalHeight === 72 && fractional.end === 1);
    const nanOverscan = computeVirtualRange({ ...Base, overscan: Number.NaN });
    const zeroOverscan = computeVirtualRange({ ...Base, overscan: 0 });
    check("\u7F13\u51B2 NaN \u6309 0 \u5904\u7406", JSON.stringify(nanOverscan) === JSON.stringify(zeroOverscan));
    const nanViewport = computeVirtualRange({ ...Base, viewportHeight: Number.NaN });
    const zeroViewport = computeVirtualRange({ ...Base, viewportHeight: 0 });
    check("\u89C6\u53E3 NaN \u6309 0 \u5904\u7406", JSON.stringify(nanViewport) === JSON.stringify(zeroViewport));
    const nanScroll = computeVirtualRange({ ...Base, scrollTop: Number.NaN });
    check(
      "\u6EDA\u52A8\u4F4D\u7F6E NaN \u6309 0 \u5904\u7406",
      JSON.stringify(nanScroll) === JSON.stringify(computeVirtualRange(Base))
    );
  }
  console.log("\u2014 \u628A\u6240\u6709\u6EDA\u52A8\u4F4D\u7F6E\u626B\u4E00\u904D \u2014");
  {
    let previousStart = -1;
    let monotonic = true;
    let covers = true;
    let bounded = true;
    for (let position = -200; position <= ContentHeight + 200; position += 7) {
      const input = { ...Base, scrollTop: position };
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
    check("\u6BCF\u4E2A\u4F4D\u7F6E\u7684\u533A\u95F4\u90FD\u81EA\u6D3D\u3001\u4E0D\u8D8A\u754C\u3001\u884C\u6570\u6709\u4E0A\u9650", bounded);
    check("\u6BCF\u4E2A\u4F4D\u7F6E\u7684\u7A97\u53E3\u90FD\u76D6\u4F4F\u53EF\u89C6\u533A", covers);
    check("\u6EDA\u52A8\u4F4D\u7F6E\u589E\u5927\u65F6\u9996\u884C\u4E0D\u5012\u9000", monotonic);
  }
  console.log("\u2014 scrollToIndex \u7684\u5BF9\u9F50 \u2014");
  {
    const target = (index, align) => scrollTopForIndex({
      index,
      align,
      itemHeight: Base.itemHeight,
      viewportHeight: Base.viewportHeight,
      total: Base.total
    });
    check(
      "\u9876\u5BF9\u9F50\uFF1A\u76EE\u6807\u884C\u8D34\u89C6\u53E3\u9876",
      target(500, "start") === 500 * 36,
      `${target(500, "start")}`
    );
    check("\u5C45\u4E2D\uFF1A\u4E0A\u4E0B\u5404\u7559\u4E00\u534A", target(500, "center") === 500 * 36 - (360 - 36) / 2);
    check("\u5E95\u5BF9\u9F50\uFF1A\u76EE\u6807\u884C\u8D34\u89C6\u53E3\u5E95", target(500, "end") === 500 * 36 - 360 + 36);
    check("\u9996\u884C\u5E95\u5BF9\u9F50\u4E0D\u4F1A\u6EDA\u51FA\u8D1F\u503C", target(0, "end") === 0);
    check("\u672B\u884C\u9876\u5BF9\u9F50\u5939\u5230\u6700\u5927\u6EDA\u52A8\u4F4D\u7F6E", target(999, "start") === MaxScrollTop);
    check("\u8D8A\u754C\u4E0B\u6807\u5939\u5230\u672B\u884C", target(99999, "start") === MaxScrollTop);
    check("\u8D1F\u6570\u4E0B\u6807\u5939\u5230\u9996\u884C", target(-5, "start") === 0);
    check("\u4E0B\u6807 NaN \u6309 0 \u5904\u7406", target(Number.NaN, "center") === 0);
    const emptyList = scrollTopForIndex({
      index: 10,
      align: "start",
      itemHeight: 36,
      viewportHeight: 360,
      total: 0
    });
    check("\u7A7A\u5217\u8868\u6052\u4E3A 0", emptyList === 0);
    const tallViewport = scrollTopForIndex({
      index: 900,
      align: "start",
      itemHeight: 36,
      viewportHeight: 99999,
      total: 1e3
    });
    check("\u89C6\u53E3\u6BD4\u5185\u5BB9\u8FD8\u9AD8\u65F6\u6052\u4E3A 0", tallViewport === 0);
    let alwaysVisible = true;
    for (let index = 0; index < Base.total; index += 37) {
      for (const align of ["start", "center", "end"]) {
        const top = target(index, align);
        const rowTop = index * Base.itemHeight;
        const rowBottom = rowTop + Base.itemHeight;
        if (!(rowTop < top + Base.viewportHeight && rowBottom > top)) {
          alwaysVisible = false;
        }
      }
    }
    check("\u4EFB\u4F55\u5BF9\u9F50\u65B9\u5F0F\u4E0B\u76EE\u6807\u884C\u90FD\u843D\u5728\u89C6\u53E3\u91CC", alwaysVisible);
  }
  console.log("\u2014 \u884C\u9AD8\u4E0D\u540C\u53EA\u662F\u7A97\u53E3\u66F4\u5BC6 \u2014");
  {
    const dense = { ...Base, itemHeight: 24 };
    const range = computeVirtualRange(dense);
    check("24px \u884C\u9AD8\uFF1A\u4E00\u5C4F 15 \u884C + 4 \u884C\u7F13\u51B2", range.end === 18, `end=${range.end}`);
    check("\u603B\u9AD8\u5EA6\u8DDF\u7740\u884C\u9AD8\u8D70", range.totalHeight === 24e3, `${range.totalHeight}`);
    check("\u7A97\u53E3\u8986\u76D6\u53EF\u89C6\u533A", coversViewport(range, dense));
  }
  console.log("");
  if (failures.length > 0) {
    console.log(`\u5931\u8D25 ${failures.length} \u9879\uFF1A
  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("\u5168\u90E8\u901A\u8FC7\uFF1A\u7A97\u53E3\u8BA1\u7B97\u3001\u8FB9\u754C\u5939\u903C\u3001\u5230\u5E95\u5224\u5B9A\u4E0E\u6EDA\u52A8\u5B9A\u4F4D\u5747\u6309\u9884\u671F\u5DE5\u4F5C");
};
main();
