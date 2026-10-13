/**
 * 虚拟列表的算术：由「滚到哪了」推出「该渲染哪几行」。
 *
 * ## 为什么单独成文件
 *
 * 列表里唯一真正容易写错的就是这段：缓冲怎么加、两端怎么夹、
 * 「到底了没有」怎么判。放在 `.vue` 里就只能靠肉眼和手点；抽成纯函数之后
 * `scripts/smoke/virtual-list.smoke.ts` 能在 Node 里把边界用例逐个钉住
 * （空列表、行数不足一屏、滚过头、行高为 0、缓冲为 0 ……），
 * `VirtualList.vue` 那边只剩「接到 DOM 上」这点胶水。
 *
 * ## 单位
 *
 * 全是像素与行号，没有 DOM、没有响应式、没有副作用：给同样的输入永远是同样的输出，
 * 因此可以在没有浏览器的地方跑。
 */

/** 把某一行对齐到视口的方式（`scrollTopForIndex()` 用）。 */
export type ScrollAlign = "start" | "center" | "end";

/** `computeVirtualRange()` 的输入。 */
export interface VirtualRangeInput {
    /** 总行数 */
    total: number;
    /** 行高（像素），必须为正数 */
    itemHeight: number;
    /** 视口高度（像素）；首帧或 SSR 里还没量到，传 0 */
    viewportHeight: number;
    /** 当前滚动位置（像素） */
    scrollTop: number;
    /** 可视区上下各多渲染的缓冲行数 */
    overscan: number;
}

/** `computeVirtualRange()` 的结果：要渲染的行区间与它该摆在哪。 */
export interface VirtualRange {
    /** 第一个要渲染的行下标（含）；没有行时为 0 */
    start: number;
    /** 最后一个要渲染的行下标（含）；没有行时为 -1（空区间） */
    end: number;
    /** 要渲染的行数，等于 `end - start + 1` */
    count: number;
    /** 内容总高度（像素）：占位元素用它撑出滚动条 */
    totalHeight: number;
    /** 渲染窗口的纵向偏移（像素）：等于 `start * itemHeight` */
    offset: number;
    /** 末行是否已在渲染范围内——`reach-end` 的判据 */
    atEnd: boolean;
}

/** `scrollTopForIndex()` 的输入。 */
export interface ScrollTargetInput {
    /** 目标行下标；越界会夹到 `[0, total - 1]` */
    index: number;
    /** 对齐方式 */
    align: ScrollAlign;
    /** 行高（像素） */
    itemHeight: number;
    /** 视口高度（像素） */
    viewportHeight: number;
    /** 总行数 */
    total: number;
}

/**
 * 行高兜底。
 *
 * 行高是除数：0 会算出 `Infinity`、负数会算出负下标、`NaN` 会让整个区间变成 `NaN`，
 * 三种都会渲染出一片空白而没有任何报错。统一按 1px 处理——错得很明显，但看得见。
 */
function safeItemHeight(itemHeight: number): number {
    return Number.isFinite(itemHeight) && itemHeight > 0 ? itemHeight : 1;
}

/** 视口高度兜底：负数、`NaN` 一律按 0（还没量到）处理。 */
function safeViewportHeight(viewportHeight: number): number {
    return Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
}

/** 行数兜底：负数、小数、`NaN` 一律归零，小数向下取整。 */
function safeTotal(total: number): number {
    return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

/** 缓冲行数兜底：负数与 `NaN` 按 0 处理，小数向下取整。 */
function safeOverscan(overscan: number): number {
    return Number.isFinite(overscan) && overscan > 0 ? Math.floor(overscan) : 0;
}

/**
 * 算出当前该渲染哪几行。
 *
 * 三步：把滚动位置夹进可滚范围 → 由 `scrollTop / itemHeight` 求首个可视行 →
 * 上下各放 `overscan` 行缓冲。缓冲是必要的：滚动事件按帧到达，若只渲染严格
 * 可视的那几行，快速滚动时窗口边缘会先露白再补上。
 */
export function computeVirtualRange(input: VirtualRangeInput): VirtualRange {
    const total = safeTotal(input.total);
    const itemHeight = safeItemHeight(input.itemHeight);
    const viewportHeight = safeViewportHeight(input.viewportHeight);

    if (total === 0) {
        return { start: 0, end: -1, count: 0, totalHeight: 0, offset: 0, atEnd: false };
    }

    const totalHeight = total * itemHeight;

    // 数据变短时 `scrollTop` 还停在旧位置，浏览器要等下一次布局才把它夹回来；
    // 这里先夹一次，免得用越界的滚动位置算出界外的下标。
    const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
    const rawScrollTop = Number.isFinite(input.scrollTop) ? input.scrollTop : 0;
    const scrollTop = Math.min(Math.max(0, rawScrollTop), maxScrollTop);

    const first = Math.floor(scrollTop / itemHeight);

    // 视口还没量到（首帧、SSR）时至少渲染一行，否则第一帧是空的。
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

/**
 * 算出「让第 `index` 行出现在视口里」需要的 `scrollTop`（像素）。
 *
 * `align` 是这一行停在视口的哪一端：`start` 顶对齐、`center` 居中、
 * `end` 底对齐。结果一律夹进 `[0, 内容高度 - 视口高度]`，
 * 因此对首尾几行调用不会滚出一片空白。
 */
export function scrollTopForIndex(input: ScrollTargetInput): number {
    const total = safeTotal(input.total);
    if (total === 0) {
        return 0;
    }

    const itemHeight = safeItemHeight(input.itemHeight);
    const viewportHeight = safeViewportHeight(input.viewportHeight);
    const rawIndex = Number.isFinite(input.index) ? Math.floor(input.index) : 0;
    const index = Math.min(Math.max(0, rawIndex), total - 1);

    const top = index * itemHeight;
    const aligned =
        input.align === "center"
            ? top - (viewportHeight - itemHeight) / 2
            : input.align === "end"
              ? top - viewportHeight + itemHeight
              : top;

    const maxScrollTop = Math.max(0, total * itemHeight - viewportHeight);
    return Math.min(Math.max(0, aligned), maxScrollTop);
}
