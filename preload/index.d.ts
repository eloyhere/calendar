import type { ElectronAPI } from "@electron-toolkit/preload";

/**
 * preload 注入到渲染进程的全局对象声明。
 *
 * 前端要拿到 `window.electron` / `window.api` 的类型提示，就得让本文件进入
 * 前端的 tsconfig。`tsconfig.web.json` 的 include 里已经列了它。
 */
declare global {
    interface Window {
        electron: ElectronAPI;
        api: unknown;
    }
}
