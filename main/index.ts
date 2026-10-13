import { app, BrowserWindow } from "electron";
import { electronApp, optimizer } from "@electron-toolkit/utils";

import { registerIpc } from "./ipc";
import { applyAppIcon } from "./icon";
import { createWindow } from "./window";
import { checkDatabaseEnvironment, closeDatabases } from "./database";

/**
 * 主进程入口。
 *
 * 只做五件事：设图标、查数据环境、注册 IPC、建窗口、管应用生命周期。
 * 窗口细节在 `window.ts`，图标在 `icon.ts`，IPC 通道在 `ipc.ts`，
 * 分库读取在 `database.ts`——本文件不出现 BrowserWindow 的构造参数，
 * 也不出现 SQL。
 */
app.whenReady().then(() => {
    electronApp.setAppUserModelId("com.electron");

    // 必须在 ready 之后：macOS 的 dock 图标此时才存在。
    // 窗口图标另在 createWindow 里逐个设置（见 window.ts）。
    applyAppIcon();

    // 启动时打一行分库环境自检。缺库不该让应用起不来（界面会逐个显示"文件不存在"），
    // 但少了这一行，用户看到的是 22 个空页面而不是一句原因。
    const environment = checkDatabaseEnvironment();
    console.log(
        `[database] ${environment.directory} 存在=${environment.present} ` +
            `已装数=${environment.files}/${environment.registered} ` +
            `最大单库=${(environment.largest / 1024 / 1024).toFixed(0)}MB`
    );

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

// 退出前关掉 22 个只读连接。SQLite 的连接不关会让 `.sqlite-wal` 之类的附属文件
// 留在磁盘上，而开发期经常要重建分库。
app.on("will-quit", () => {
    closeDatabases();
});
