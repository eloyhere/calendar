import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

/**
 * preload 桥接脚本。
 *
 * 本文件运行在渲染进程的隔离上下文里，负责把需要暴露给前端的 Electron 能力
 * 挂到 `window` 上。主进程的窗口与 IPC 注册在根目录 `main/` 下。
 *
 * 这里刻意保持最小：只放 `@electron-toolkit/preload` 提供的通用 API，
 * 业务自己的通道在 `api` 里逐个显式列出——每多暴露一个方法，就多一条
 * 前端可达主进程的入口，所以不做整体透传。
 */

/** 业务自己的 IPC 接口。新增通道时在这里补方法，并同步 `index.d.ts`。 */
const api = {};

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("api", api);
    } catch (error) {
        console.error(error);
    }
} else {
    // 未开启上下文隔离时只能直接挂到 window（类型见 index.d.ts）。
    // @ts-ignore preload 的全局声明在 index.d.ts 里
    window.electron = electronAPI;
    // @ts-ignore preload 的全局声明在 index.d.ts 里
    window.api = api;
}
