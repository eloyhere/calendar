/**
 * 页面状态机：`loading -> ready | empty | error`。
 *
 * 每个页面壳都要回答同一个问题："数据还没来、来了但是空的、来的时候炸了，
 * 分别显示什么？"答案在本文件与 `src/component/state/` 三个块里，页面自己
 * 不需要各写一遍。
 *
 * ## 与数据层的关系
 *
 * 真正的数据要经 `src/store -> src/service -> src/repository` 拿（见
 * `docs/design.md`）。本文件的 `loader` 就是这个链路的接缝：现在各页面传的是
 * `createStubLoader()` 造的演示实现，等 store 写完，把 loader 换成
 * `() => store.fetchXxx()` 即可，页面与状态渲染都不用动。
 */

import { onMounted, ref } from "vue";

/** 页面当前处于哪个状态。 */
export type PageState = "loading" | "ready" | "empty" | "error";

/** 加载器返回什么：非空数组表示有数据，空数组表示"查询成功但没有结果"。 */
export type PageResult = readonly unknown[];

/** `usePageState` 的配置。 */
export interface PageStateOptions {
    /**
     * 演示用的等待时长（毫秒）。
     *
     * 真接上数据库后应当删掉——它只在占位阶段用来让骨架屏可见。
     */
    delay?: number;
    /** 是否在 `onMounted` 时自动加载，默认是。 */
    immediate?: boolean;
}

/** `usePageState` 的返回值。 */
export interface PageStateApi {
    /** 当前状态 */
    state: ReturnType<typeof ref<PageState>>;
    /** 加载失败时的错误文案；`state !== "error"` 时是空串 */
    errorText: ReturnType<typeof ref<string>>;
    /** 是否已加载过（用于判断要不要保留骨架屏动画） */
    loaded: ReturnType<typeof ref<boolean>>;
    /** 执行一次加载；失败会落到 `error` 状态而不是抛出 */
    load: () => Promise<void>;
}

/**
 * 造一个演示用的加载器。
 *
 * 占位阶段的每个页面都用它：`delay` 之后返回 `result`。
 * 传空数组就是"加载成功但库里没有数据"，用来展示 `ElEmpty`。
 *
 * @param result 要返回的行
 * @param delay 等待时长（毫秒）
 */
export function createStubLoader(result: PageResult = [], delay = 420) {
    return () =>
        new Promise<PageResult>((resolve) => {
            setTimeout(() => resolve(result), delay);
        });
}

/**
 * 造一个必定失败的加载器，用来展示错误态与重试按钮。
 *
 * @param message 失败原因
 * @param delay 等待时长（毫秒）
 */
export function createFailingLoader(message: string, delay = 420) {
    return () =>
        new Promise<PageResult>((_resolve, reject) => {
            setTimeout(() => reject(new Error(message)), delay);
        });
}

/** Promise 形态的等待，替代裸 `setTimeout`，便于 `await` 串起来。 */
function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

/**
 * 页面状态机。
 *
 * @param loader 取数据的函数；返回空数组判定为 `empty`
 * @param options 见 `PageStateOptions`
 *
 * @example
 * ```ts
 * const { state, errorText, load } = usePageState(createStubLoader([], 500));
 * ```
 */
export function usePageState(
    loader: () => Promise<PageResult>,
    options: PageStateOptions = {}
): PageStateApi {
    const { delay = 0, immediate = true } = options;

    const state = ref<PageState>("loading");
    const errorText = ref("");
    const loaded = ref(false);

    async function load(): Promise<void> {
        state.value = "loading";
        errorText.value = "";

        try {
            // 演示延时与真实 loader 并行，占位阶段骨架屏才有机会被看见
            const [result] = await Promise.all([
                loader(),
                delay > 0 ? wait(delay) : Promise.resolve()
            ]);

            state.value = result.length === 0 ? "empty" : "ready";
        } catch (error) {
            state.value = "error";
            errorText.value = error instanceof Error ? error.message : String(error);
        } finally {
            loaded.value = true;
        }
    }

    if (immediate) {
        onMounted(load);
    }

    return { state, errorText, loaded, load };
}

/** 页面在 `<KeepAlive>` 里被重新激活时，是否还处于首次加载状态。 */
export function isFirstLoad(api: Pick<PageStateApi, "loaded">): boolean {
    return !api.loaded.value;
}
