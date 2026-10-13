/**
 * 自绘标题栏的窗口控制契约。
 *
 * 这是主进程、preload、渲染进程三方共用的**唯一**一份约定：通道名、命令名、
 * 以及 preload 暴露给前端的 `window.desktop` 形状。三处各写一遍字符串必然会漂移，
 * 所以放在根目录 `shared/` 下，由两侧 tsconfig 同时纳入（见 tsconfig.node.json
 * 与 tsconfig.web.json 的 include）。
 *
 * 本文件**没有运行时依赖**：主进程与 preload 取常量，渲染进程只取类型。
 */

/** 主进程↔渲染进程通道名。改动这里等于同时改三处，不会再出现拼错通道名。 */
export const WindowChannels = {
    /** 窗口控制命令（渲染 → 主，单向） */
    command: "window:command",
    /** 窗口状态变化（主 → 渲染，单向） */
    state: "window:state"
} as const;

/**
 * 窗口控制命令。
 *
 * 用"一个通道 + 命令名"而不是三个通道：暴露面只有一条，新增命令（比如
 * `toggle-always-on-top`）不需要再动 preload 的白名单。
 */
export type WindowCommand = "minimize" | "toggle-maximize" | "close";

/** 命令名白名单，主进程收到消息后先过一遍，非法值直接丢弃。 */
export const WINDOW_COMMANDS: readonly WindowCommand[] = ["minimize", "toggle-maximize", "close"];

/** 类型守卫：主进程用它校验渲染进程送来的字符串。 */
export function isWindowCommand(value: unknown): value is WindowCommand {
    return typeof value === "string" && (WINDOW_COMMANDS as readonly string[]).includes(value);
}

/**
 * 窗口状态快照。
 *
 * `isMaximized` 与 `isFullScreen` 分开：最大化按钮在两种状态下的图标都要变成"还原"，
 * 但它们是两件不同的事（全屏还会藏起任务栏）。
 */
export interface WindowState {
    isMaximized: boolean;
    isFullScreen: boolean;
}

/** preload 挂到 `window.desktop.window` 上的方法集合。 */
export interface DesktopWindowApi {
    /** 最小化窗口 */
    minimize: () => void;
    /** 最大化 / 还原，二选一由主进程判断 */
    toggleMaximize: () => void;
    /** 关闭窗口（等价于用户点右上角 ×） */
    close: () => void;
    /**
     * 订阅窗口状态变化，返回取消订阅函数。
     *
     * 主进程在页面加载完成时会主动推一次当前状态，所以订阅之后不必再问一遍，
     * 也不会有"先画成未最大化、再跳一下"的闪烁。
     */
    onStateChange: (listener: (state: WindowState) => void) => () => void;
}

/** preload 挂到 `window.desktop` 上的全部能力。 */
export interface DesktopApi {
    window: DesktopWindowApi;
}
