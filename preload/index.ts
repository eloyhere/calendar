import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

import { WindowChannels } from "../shared/window-api";
import type { DesktopApi, WindowCommand, WindowState } from "../shared/window-api";
import { WorkflowChannels } from "../shared/workflow-api";
import type { WorkflowCatalog, WorkflowEvent, WorkflowRunResult, WorkflowStep } from "../shared/workflow-api";
import { OsChannels } from "../shared/os-api";
import type { OsInvokeRequest, OsInvokeResult } from "../shared/os-api";
import { CalendarChannels } from "../shared/calendar-api";
import type {
    CalendarColumnInfo,
    CalendarColumnsRequest,
    CalendarModuleState,
    CalendarRow,
    CalendarSelectRequest,
    CalendarSelectResult
} from "../shared/calendar-api";

/**
 * preload 桥接脚本。
 *
 * 本文件运行在渲染进程的隔离上下文里，负责把需要暴露给前端的 Electron 能力
 * 挂到 `window` 上。主进程的窗口与 IPC 注册在根目录 `main/` 下。
 *
 * 这里刻意保持最小：只放 `@electron-toolkit/preload` 提供的通用 API，业务自己的
 * 能力在 `desktop` 里逐个显式列出——每多暴露一个方法，就多一条前端可达主进程的
 * 入口，所以不做整体透传。通道名与类型都取自 `shared/` 下的契约文件，与主进程
 * 共用同一份定义。
 */

/** 发一条窗口控制命令。集中在这里，省得下面写三遍 `ipcRenderer.send`。 */
const sendWindowCommand = (command: WindowCommand): void => {
    ipcRenderer.send(WindowChannels.command, command);
};

/**
 * 订阅窗口状态。
 *
 * 返回的取消订阅函数会 `removeListener` 掉**同一个**监听器引用；若在回调里写成
 * 内联箭头函数，取消订阅时移除的是另一个函数，监听器会一直留着。
 */
const onWindowStateChange = (listener: (state: WindowState) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: WindowState): void => listener(state);
    ipcRenderer.on(WindowChannels.state, wrapped);
    return () => ipcRenderer.removeListener(WindowChannels.state, wrapped);
};

/** 订阅工作流运行事件。同上，包装函数的引用要留住才能取消订阅。 */
const onWorkflowEvent = (listener: (event: WorkflowEvent) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: WorkflowEvent): void => listener(payload);
    ipcRenderer.on(WorkflowChannels.event, wrapped);
    return () => ipcRenderer.removeListener(WorkflowChannels.event, wrapped);
};

/** 业务自己的 IPC 接口。新增通道时在这里补方法，并同步 `shared/` 下的契约。 */
const api: DesktopApi = {
    window: {
        minimize: () => sendWindowCommand("minimize"),
        toggleMaximize: () => sendWindowCommand("toggle-maximize"),
        close: () => sendWindowCommand("close"),
        onStateChange: onWindowStateChange
    },
    workflow: {
        catalog: () => ipcRenderer.invoke(WorkflowChannels.catalog) as Promise<WorkflowCatalog>,
        run: (steps: WorkflowStep[]) =>
            ipcRenderer.invoke(WorkflowChannels.run, steps) as Promise<WorkflowRunResult>,
        cancel: () => ipcRenderer.send(WorkflowChannels.cancel),
        onEvent: onWorkflowEvent
    },
    /**
     * dsh-os 单动词钩子。
     *
     * 与 `workflow` 是同一个执行器的两个入口：`workflow.run` 跑一串步骤并回推流式事件，
     * `os.invoke` 跑一个动词并只回最终结果。页面上的"查一下这个"用它，
     * 工作流的每一步也最终走它。
     */
    os: {
        catalog: () => ipcRenderer.invoke(OsChannels.catalog) as Promise<WorkflowCatalog>,
        invoke: (request: OsInvokeRequest) =>
            ipcRenderer.invoke(OsChannels.invoke, request) as Promise<OsInvokeResult>,
        cancel: () => ipcRenderer.send(OsChannels.cancel)
    },
    /**
     * 分库查询。
     *
     * 渲染进程持有语句（`src/sql/*.sql` 由 `database/sqlfiles.py` 生成到
     * `src/datasource/*.sqlite.ts`），主进程负责打开文件与只读校验。
     * 语句来源唯一，所以这一层只透传，不复制一份 SQL。
     */
    calendar: {
        modules: () =>
            ipcRenderer.invoke(CalendarChannels.modules) as Promise<readonly CalendarModuleState[]>,
        select: (request: CalendarSelectRequest) =>
            ipcRenderer.invoke(CalendarChannels.select, request) as Promise<CalendarSelectResult>,
        selectOne: (request: CalendarSelectRequest) =>
            ipcRenderer.invoke(CalendarChannels.selectOne, request) as Promise<CalendarRow | null>,
        columns: (request: CalendarColumnsRequest) =>
            ipcRenderer.invoke(CalendarChannels.columns, request) as Promise<readonly CalendarColumnInfo[]>
    }
};

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld("electron", electronAPI);
        contextBridge.exposeInMainWorld("desktop", api);
    } catch (error) {
        console.error(error);
    }
} else {
    // 未开启上下文隔离时只能直接挂到 window（类型见 index.d.ts）。
    // @ts-ignore preload 的全局声明在 index.d.ts 里
    window.electron = electronAPI;
    // @ts-ignore preload 的全局声明在 index.d.ts 里
    window.desktop = api;
}
