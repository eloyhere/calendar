import { ipcMain, BrowserWindow } from "electron";

import { WindowChannels, isWindowCommand } from "../shared/window-api";
import type { WindowState } from "../shared/window-api";
import { WorkflowChannels, isWorkflowStepList } from "../shared/workflow-api";
import type { WorkflowEvent } from "../shared/workflow-api";
import { OsChannels, isOsInvokeRequest } from "../shared/os-api";
import type { OsInvokeResult } from "../shared/os-api";
import { CalendarChannels, isCalendarColumnsRequest, isCalendarSelectRequest } from "../shared/calendar-api";
import { cancelWorkflow, invokeOs, readCatalog, runWorkflow } from "./workflow";
import { readColumns, readModuleStates, selectRow, selectRows } from "./database";

/**
 * IPC 通道注册。
 *
 * 所有渲染进程可达的主进程入口都集中在这里，方便一眼看完暴露面。
 * 新增通道的完整流程：
 * 1. 在 `shared/window-api.ts` 里加通道名 / 命令名与类型（主进程、preload、前端共用）；
 * 2. 在 `preload/index.ts` 的 `api` 里加一个转发方法；
 * 3. 在这里用 `ipcMain.handle` / `ipcMain.on` 实现。
 *
 * 前端不直接碰 `ipcRenderer`，只调 `window.desktop.*`。
 */

/* -------------------------------------------------------------------------- */
/* 自绘标题栏的窗口控制                                                          */
/* -------------------------------------------------------------------------- */

/**
 * 取发起这次 IPC 的窗口。
 *
 * 用 `BrowserWindow.fromWebContents(event.sender)` 而不是持有"当前窗口"引用：
 * 将来开第二个窗口时，两个窗口各控各的，不会互相操作。窗口可能在这一瞬间已经
 * 销毁（关闭连点），所以结果为 null 时静默返回。
 */
const windowFrom = (event: Electron.IpcMainEvent): BrowserWindow | null => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window && !window.isDestroyed() ? window : null;
};

/**
 * 读取窗口状态快照。
 *
 * `isMaximized()` 与 `isFullScreen()` 都要报：最大化按钮在两种状态下都要变成
 * "还原"图标，但它们是两件不同的事（全屏还会盖住任务栏）。
 */
export const readWindowState = (window: BrowserWindow): WindowState => ({
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen()
});

/**
 * 把窗口状态变化推给渲染进程。
 *
 * 状态的事实来源在主进程（用户双击标题栏、按 Win+↑、系统菜单都会改它），前端
 * 只负责照着画图标。这里把"什么时候可能变了"集中成六个事件，避免前端去轮询。
 *
 * 订阅的是窗口自己的事件，所以本函数在 `createWindow()` 里对每个窗口调用一次；
 * `window.once("closed")` 之后监听器随窗口一起回收。
 */
export const attachWindowState = (window: BrowserWindow): void => {
    const push = (): void => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) {
            return;
        }
        window.webContents.send(WindowChannels.state, readWindowState(window));
    };

    // 逐个写而不是遍历一个数组：`BrowserWindow.on` 是一组按事件名重载的签名，
    // 传联合类型会让 TS 挑不到正确的重载（它只会去匹配最后一个）。
    window.on("maximize", push);
    window.on("unmaximize", push);
    window.on("enter-full-screen", push);
    window.on("leave-full-screen", push);
    window.on("restore", push);

    // 首帧渲染完就推一次，前端不必自己再问一遍（也就没有"先画错再纠正"的闪烁）。
    window.webContents.on("did-finish-load", push);
};

/** 注册全部 IPC 通道。`app.whenReady()` 之后调用一次。 */
export const registerIpc = (): void => {
    // 连通性自检用；正式的查询通道在接入 SQLite 驱动后加在这里。
    ipcMain.on("ping", () => console.log("pong"));

    ipcMain.on(WindowChannels.command, (event, command: unknown) => {
        // 命令名先过白名单：渲染进程理论上只会发三个合法值，但这层校验让
        // "前端多写一个字符串"变成无声忽略，而不是主进程抛错。
        if (!isWindowCommand(command)) {
            console.warn("[ipc] 未知的窗口命令：", command);
            return;
        }

        const window = windowFrom(event);
        if (!window) {
            return;
        }

        switch (command) {
            case "minimize":
                window.minimize();
                break;
            case "toggle-maximize":
                // 全屏状态下先退出全屏再谈最大化，否则按钮会"点了没反应"。
                if (window.isFullScreen()) {
                    window.setFullScreen(false);
                } else if (window.isMaximized()) {
                    window.unmaximize();
                } else {
                    window.maximize();
                }
                break;
            case "close":
                window.close();
                break;
        }
    });

    /* ---------------------------------------------------------------------- */
    /* 工作流：执行 scripts/operation 的 dsh-os 命令层                          */
    /* ---------------------------------------------------------------------- */

    // 动词清单与当前平台选中的入口。产物缺失或解释器不可用时走 problem 字段，
    // 不抛错——前端要能把这个原因显示成一句可操作的提示。
    ipcMain.handle(WorkflowChannels.catalog, () => readCatalog());

    ipcMain.handle(WorkflowChannels.run, async (event, steps: unknown) => {
        // 形状校验在这里：`spawn` 的入参必须是干净的字符串数组，不能靠前端自觉。
        if (!isWorkflowStepList(steps)) {
            throw new Error("工作流步骤的形状不合法，已拒绝执行");
        }

        // 事件推回**发起这次运行的窗口**，而不是记住"当前窗口"——
        // 将来开第二个窗口时两个窗口各跑各的，输出不会串台。
        const sender = event.sender;
        const emit = (payload: WorkflowEvent): void => {
            if (!sender.isDestroyed()) {
                sender.send(WorkflowChannels.event, payload);
            }
        };

        return runWorkflow(steps, emit);
    });

    ipcMain.on(WorkflowChannels.cancel, () => {
        cancelWorkflow();
    });

    /* ---------------------------------------------------------------------- */
    /* dsh-os 单动词钩子                                                        */
    /* ---------------------------------------------------------------------- */

    // 清单与工作流共用一份（`readCatalog`），所以两个通道返回的是同一张表。
    // 页面调它拿参数名与开关，用来渲染可读的参数标签，而不是让用户对着 arg1 猜。
    ipcMain.handle(OsChannels.catalog, () => readCatalog());

    ipcMain.handle(OsChannels.invoke, async (_event, request: unknown): Promise<OsInvokeResult> => {
        // 形状校验与工作流同源：拒掉的是前端的 bug，不是"恶意前端"。
        if (!isOsInvokeRequest(request)) {
            throw new Error("动词调用的形状不合法，已拒绝执行");
        }

        const result = await invokeOs({
            verb: request.verb,
            args: request.args,
            named: request.named,
            flags: request.flags,
            allow: request.allow
        });

        return { verb: request.verb, ...result };
    });

    // 单动词调用与工作流共用同一个子进程槽位（`activeChild`），所以中断也是同一个入口。
    ipcMain.on(OsChannels.cancel, () => {
        cancelWorkflow();
    });

    /* ---------------------------------------------------------------------- */
    /* 分库查询                                                                */
    /* ---------------------------------------------------------------------- */

    // 22 个分库的实时状态。行数是现算的 `COUNT(*)`，不是构建期记下来的数字——
    // 界面要回答"现在有多少行"，而不是"上次构建时有多少行"。
    ipcMain.handle(CalendarChannels.modules, () => readModuleStates());

    ipcMain.handle(CalendarChannels.select, (_event, request: unknown) => {
        if (!isCalendarSelectRequest(request)) {
            throw new Error("查询请求的形状不合法，已拒绝执行");
        }
        return selectRows(request);
    });

    ipcMain.handle(CalendarChannels.selectOne, (_event, request: unknown) => {
        if (!isCalendarSelectRequest(request)) {
            throw new Error("查询请求的形状不合法，已拒绝执行");
        }
        return selectRow(request);
    });

    ipcMain.handle(CalendarChannels.columns, (_event, request: unknown) => {
        if (!isCalendarColumnsRequest(request)) {
            throw new Error("取列的请求形状不合法，已拒绝执行");
        }
        return readColumns(request);
    });
};
