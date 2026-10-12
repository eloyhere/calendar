import { ipcMain } from "electron";

/**
 * IPC 通道注册。
 *
 * 所有渲染进程可达的主进程入口都集中在这里，方便一眼看完暴露面。
 * 新增通道的完整流程：
 * 1. 在 `preload/index.ts` 的 `api` 里加一个转发方法；
 * 2. 在 `preload/index.d.ts` 里补上它的类型；
 * 3. 在这里用 `ipcMain.handle` / `ipcMain.on` 实现。
 *
 * 前端不直接碰 `ipcRenderer`，只调 `window.api.*`。
 */
export const registerIpc = (): void => {
    // 连通性自检用；正式的查询通道在接入 SQLite 驱动后加在这里。
    ipcMain.on("ping", () => console.log("pong"));
};
