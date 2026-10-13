<script setup lang="ts" generic="T">
/**
 * 虚拟列表：只渲染可视区里的若干行，每行长什么样由 `#item` 插槽决定。
 *
 * ## 为什么需要它
 *
 * `calendar` 的分库动辄上百万行（`temporal` 694 万、`moon_phase` 116 万，
 * 见 `docs/design.md` §3），数据页按 50 行一页取。用户往下滚上十几屏，DOM 里
 * 就会攒下几千个节点，布局与重绘开始拖住滚动条。虚拟列表只保留「看得见的那几行
 * 加上下各几行缓冲」，其余用一个撑高的占位元素顶住滚动条——DOM 行数与数据量脱钩，
 * 滚到第 1 行和第 900 万行一样快。
 *
 * ## 三条契约
 *
 * 1. **行高固定**：`itemHeight` 是多少像素，行就多高。虚拟化靠
 *    `scrollTop / itemHeight` 直接算出下标，不测量、不抖动。变高的行会把后面
 *    所有行顶偏，本组件不做——那要给每行记高度、滚动时不停修正，是另一套算法。
 *    开发期若发现插槽内容比 `itemHeight` 高，会 `console.warn` 一次。
 * 2. **item 只写内容**：行容器（固定高度、`role="listitem"`）由本组件提供，
 *    插槽里只写这一行长什么样，不要再套一层带高度的盒子。
 * 3. **高度要有来源**：`height` 默认 `320px`，也可以给 `"100%"`
 *    让它撑满一个有确定高度的父容器。父容器高度不确定时视口会塌成 0，
 *    这时屏幕上一行都看不到（`ResizeObserver` 量到高度后会自己恢复）。
 *
 * ## 用法
 *
 * ```text
 * <VirtualList :items="rows" :item-height="36" height="420" @reach-end="loadMore">
 *     <template #item="{ item, index }">
 *         <div class="row">{{ index + 1 }}. {{ item.name }}</div>
 *     </template>
 *     <template #empty>
 *         <EmptyState source="朔望月" />
 *     </template>
 * </VirtualList>
 * ```
 *
 * `#item` 的作用域参数只有 `item` 与 `index`，其中 `index` 是它在 `items` 里的
 * **真实下标**（不是可视区里的第几个）：去重、跳转、`scrollToIndex()` 都直接用它。
 * `#empty` 可选，数据为空时整块交给调用方——那正是 `state/EmptyState.vue` 的活。
 *
 * ## 续页
 *
 * `reach-end` 在末行进入渲染范围时触发一次：一屏没到底时不触发，到了底只触发一次，
 * 用户滚离末尾再滚回来才会再触发，因此可以直接接「取下一页」。首屏若一屏就到底
 * （数据比视口还短），挂载前就会触发一次——否则用户没有滚动条可拉，永远等不到下一页。
 *
 * ## 为什么不用 Element Plus 的 `FixedSizeList`
 *
 * `element-plus` 只把 `FixedSizeList` / `DynamicSizeList` 作为普通导出给出，
 * 没有随 `app.use(ElementPlus)` 注册成全局组件；要用就得在业务代码里写裸包名
 * `import { FixedSizeList } from "element-plus"`，与 `src/plugin/README.md`
 * 的「依赖只从 `src/plugin` 进」冲突，模板里也拿不到 `El` 前缀的写法。
 * 本组件只用原生滚动容器，依赖为零。
 *
 * ## 算术在哪
 *
 * 区间计算（缓冲、夹逼、到底判定）全在 `./virtual-range.ts`：纯函数、无 DOM，
 * `scripts/smoke/virtual-list.smoke.ts` 在 Node 里把边界用例逐个核对过。
 * 本文件只负责把它接到 DOM 上并把插槽渲染出来。
 */

import { computed, onBeforeUnmount, onMounted, onUpdated, ref, watch } from "vue";
import type { CSSProperties } from "vue";

import { computeVirtualRange, scrollTopForIndex } from "./virtual-range";
import type { ScrollAlign, VirtualRange } from "./virtual-range";

interface Props {
    /** 全部数据；通常是分页取回来一页一页追加 */
    items?: readonly T[];
    /** 行高（像素）。行高固定是虚拟化的前提 */
    itemHeight?: number;
    /** 视口高度：数字按像素，字符串原样交给 CSS（`"100%"`、`"40vh"`、`calc(...)`） */
    height?: number | string;
    /** 可视区上下各多渲染的缓冲行数；给 0 会在快速滚动时露白 */
    overscan?: number;
    /** 行的 key；不传则用行下标。整页替换数据时给个稳定 key 更好 */
    itemKey?: (item: T, index: number) => string | number;
}

const props = withDefaults(defineProps<Props>(), {
    items: () => [],
    itemHeight: 36,
    height: "320px",
    overscan: 4
});

const emit = defineEmits<{
    /** 每次滚动触发一次，`scrollTop` 是当前位置（像素），用于行号提示、侧边吸附等 */
    scroll: [payload: { scrollTop: number }];
    /** 末行进入渲染范围；用于追加下一页，见文件头「续页」 */
    "reach-end": [];
}>();

defineSlots<{
    /** 单行内容；行容器（固定高度）由本组件提供 */
    item?: (props: { item: T; index: number }) => unknown;
    /** 数据为空时的占位，通常是 `state/EmptyState.vue` */
    empty?: () => unknown;
}>();

/** 滚动容器；滚动位置与视口高度都从它读。 */
const viewport = ref<HTMLElement | null>(null);

/** 当前滚动位置（像素），随 `scroll` 事件更新。 */
const scrollTop = ref(0);

/** 视口高度（像素），由 `ResizeObserver` 量取；首帧与 SSR 里是 0。 */
const viewportHeight = ref(0);

/** 当前该渲染的行区间。滚动、行数、视口高度任一变化都会重算。 */
const range = computed<VirtualRange>(() =>
    computeVirtualRange({
        total: props.items.length,
        itemHeight: props.itemHeight,
        viewportHeight: viewportHeight.value,
        scrollTop: scrollTop.value,
        overscan: props.overscan
    })
);

/** 要真正渲染的一行：数据 + 它在 `items` 里的真实下标 + key。 */
interface Row {
    item: T;
    index: number;
    key: string | number;
}

/** 窗口里的行。只切出 `range` 指出的那一段，不复制数据。 */
const rows = computed<Array<Row>>(() => {
    const { start, end } = range.value;
    return props.items.slice(start, end + 1).map((item: T, offset: number): Row => {
        const index = start + offset;
        return {
            item: item,
            index: index,
            key: props.itemKey ? props.itemKey(item, index) : index
        };
    });
});

/** 占位元素高度：行数 × 行高，滚动条反映的是全部数据而不是渲染出来的那几行。 */
const spacerStyle = computed<CSSProperties>(() => ({ height: `${range.value.totalHeight}px` }));

/** 渲染窗口的偏移：整窗平移到第一行，比逐行绝对定位少写一份 offset。 */
const trackStyle = computed<CSSProperties>(() => ({
    transform: `translateY(${range.value.offset}px)`
}));

/** 行容器样式：高度按 `itemHeight` 写死，这是虚拟化的依据。 */
const rowStyle = computed<CSSProperties>(() => ({ height: `${props.itemHeight}px` }));

/** 视口高度：数字补 `px`，字符串原样交给 CSS。 */
const viewportStyle = computed<CSSProperties>(() => ({
    height: typeof props.height === "number" ? `${props.height}px` : props.height
}));

/** 视口尺寸变化（窗口缩放、父容器展开收起）时重新量高度。 */
let resizer: ResizeObserver | null = null;

/** 开发期自检是否已经报过「内容比行高」；只报一次，免得刷屏。 */
let checkedOverflow = false;

// 行高错了会一路错到底（区间按 1px 算），但界面上只是「挤成一条」，很容易被当成样式问题。
if (import.meta.env.DEV && !(props.itemHeight > 0)) {
    console.warn(`VirtualList：itemHeight 应为正数，收到 ${props.itemHeight}，已按 1px 处理。`);
}

/**
 * 滚动时只做一件事：记下新的位置。该渲染哪几行由 `range` 自动重算。
 *
 * 位置从 `viewport` 读而不是从事件对象读：滚动事件在帧内会来好几次，
 * 事件里的 `scrollTop` 与元素当前值可能已经差了一帧，而元素上的值永远是最新的。
 */
function onScroll(): void {
    scrollTop.value = viewport.value?.scrollTop ?? 0;
    emit("scroll", { scrollTop: scrollTop.value });
}

/** 滚到某个像素位置；越界值由浏览器夹回可滚范围。 */
function scrollToOffset(offset: number): void {
    const element = viewport.value;
    if (element !== null) {
        element.scrollTop = offset;
    }
}

/** 滚到某一行；`align` 决定这一行停在视口的哪一端。 */
function scrollToIndex(index: number, align: ScrollAlign = "start"): void {
    const element = viewport.value;
    if (element === null) {
        return;
    }
    scrollToOffset(
        scrollTopForIndex({
            index: index,
            align: align,
            itemHeight: props.itemHeight,
            viewportHeight: element.clientHeight,
            total: props.items.length
        })
    );
}

/** 回到顶部。 */
function scrollToTop(): void {
    scrollToOffset(0);
}

/** 滚到底部；末行对齐视口底边。 */
function scrollToBottom(): void {
    scrollToOffset(range.value.totalHeight);
}

defineExpose({ scrollToIndex, scrollToTop, scrollToBottom, scrollToOffset });

watch(
    (): boolean => range.value.atEnd,
    (atEnd: boolean): void => {
        if (atEnd) {
            emit("reach-end");
        }
    },
    // 看的是布尔值的**跳变**：停在末尾期间连续追加几页只会触发一次，
    // 否则会变成「到底一次、请求一次」的连环请求。
    //
    // immediate 是为了覆盖「一屏就到底」：此时没有滚动条可拉，用户滚不动，
    // 不主动触发一次就永远等不到下一页。setup 阶段的视口高度还是 0，
    // 所以长列表不会在这里误触发，等 `ResizeObserver` 量到高度后再判一次。
    { immediate: true }
);

onMounted((): void => {
    const element = viewport.value;
    if (element === null) {
        return;
    }

    viewportHeight.value = element.clientHeight;

    // 只观察视口自身：行容器是绝对定位的，改不了视口高度，不会自激。
    resizer = new ResizeObserver((): void => {
        viewportHeight.value = element.clientHeight;
    });
    resizer.observe(element);
});

onBeforeUnmount((): void => {
    resizer?.disconnect();
    resizer = null;
});

/**
 * 开发期自检：插槽内容比 `itemHeight` 高时，多出来的部分会盖住下一行。
 *
 * 这种错在界面上只是「有点挤」，很难一眼看出来；这里量一次并指名道姓地说清楚。
 * 只跑到报出第一次为止——此后每次更新都直接返回。
 */
onUpdated((): void => {
    if (!import.meta.env.DEV || checkedOverflow) {
        return;
    }

    const rendered = viewport.value?.querySelectorAll<HTMLElement>(".virtual-list__row");
    if (rendered === undefined) {
        return;
    }

    let tallest = 0;
    for (const row of rendered) {
        const content = row.firstElementChild;
        if (content === null) {
            continue;
        }
        const contentHeight = content.getBoundingClientRect().height;
        if (contentHeight > tallest) {
            tallest = contentHeight;
        }
    }

    if (tallest > props.itemHeight + 1) {
        checkedOverflow = true;
        console.warn(
            `VirtualList：插槽内容高 ${Math.round(tallest)}px，超过 itemHeight=${props.itemHeight}px，` +
                "多出来的部分会被下一行盖住。请调大 itemHeight，或把每行的内容压到行高以内。"
        );
    }
});
</script>

<template>
    <div ref="viewport" class="virtual-list" :style="viewportStyle" role="list" @scroll="onScroll">
        <div class="virtual-list__spacer" :style="spacerStyle">
            <div class="virtual-list__track" :style="trackStyle" role="presentation">
                <div
                    v-for="row in rows"
                    :key="row.key"
                    class="virtual-list__row"
                    :style="rowStyle"
                    role="listitem"
                    :aria-posinset="row.index + 1"
                    :aria-setsize="props.items.length">
                    <slot name="item" :item="row.item" :index="row.index" />
                </div>
            </div>
        </div>

        <!-- 空态：没有数据时不占高度，整块交给调用方 -->
        <div v-if="range.count === 0" class="virtual-list__empty">
            <slot name="empty" />
        </div>
    </div>
</template>

<style scoped>
.virtual-list {
    overflow-anchor: none;
    overflow-x: hidden;
    overflow-y: auto;
    position: relative;
    width: 100%;
}

/* 滚动条与 .el-main / .el-scrollbar__wrap 保持一个粗细（见 src/assets/main.css） */
.virtual-list::-webkit-scrollbar {
    height: 8px;
    width: 8px;
}

.virtual-list::-webkit-scrollbar-thumb {
    background: var(--el-border-color-darker);
    border-radius: 4px;
}

.virtual-list__spacer {
    position: relative;
    width: 100%;
}

/**
 * 渲染窗口：绝对定位 + 整体平移。
 *
 * `left/right` 撑满宽度，`top` 归零——纵向位置只由 `translateY` 决定，
 * 这样浏览器只做合成，不重排版面。
 */
.virtual-list__track {
    left: 0;
    position: absolute;
    right: 0;
    top: 0;
    will-change: transform;
}

.virtual-list__row {
    box-sizing: border-box;
    width: 100%;
}

/* 空态：在视口里居中，短空态不会缩在顶上 */
.virtual-list__empty {
    align-items: center;
    display: flex;
    justify-content: center;
    min-height: 100%;
}
</style>
