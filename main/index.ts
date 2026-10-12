import { app, BrowserWindow } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";

import { registerIpc } from "./ipc";
import { createWindow } from "./window";

/**
 * 主进程入口。
 *
 * 只做三件事：注册 IPC、建窗口、管应用生命周期。窗口细节在 `window.ts`，
 * IPC 通道在 `ipc.ts`——本文件不出现 BrowserWindow 的构造参数。
 */
app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.electron");

    // 开发期 F12 开关 DevTools，生产期忽略 CommandOrControl + R。
    // 见 https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on("browser-window-created", (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    registerIpc();
    createWindow();

    app.on("activate", () => {
        // macOS 上点 dock 图标且没有窗口时重建窗口。
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 除 macOS 外，关掉所有窗口即退出。
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
