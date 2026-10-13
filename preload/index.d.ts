import type { ElectronAPI } from "@electron-toolkit/preload";

import type { DesktopApi } from "../shared/window-api";

/**
 * preload 注入到渲染进程的全局对象声明。
 *
 * 前端要拿到 `window.electron` / `window.desktop` 的类型提示，就得让本文件进入
 * 前端的 tsconfig。`tsconfig.web.json` 的 include 里已经列了它。
 *
 * `desktop` 的形状直接复用 `shared/window-api.ts` 的 `DesktopApi`：
 * 前端、preload、主进程三边共用一份定义，改一处三边同时生效。
 */
declare global {
    interface Window {
        electron: ElectronAPI;
        desktop: DesktopApi;
    }
}
