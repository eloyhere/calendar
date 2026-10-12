import { shell, BrowserWindow } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";
import icon from "../resources/icon.png?asset";

/** 无参无返回值的动作，等价于 `java.lang.Runnable` 的最简对应。 */
export type Runnable = () => void;

/** 窗口创建参数：留出可覆盖的余地，便于以后开多个窗口。 */
export interface WindowOptions {
    width?: number;
    height?: number;
}

/**
 * 新建一个 BrowserWindow 并挂上 renderer。
 *
 * 产物布局约定（与 electron.vite.config.ts 对应）：
 * - 本文件输出到 `out/main/index.js`，故 `__dirname` 是 `out/main`；
 * - preload 桥接脚本输出到 `out/preload/index.js`，故取 `../preload/index.js`；
 * - renderer 输出到 `out/renderer/index.html`，故取 `../renderer/index.html`。
 */
export const createWindow = (options: WindowOptions = {}): BrowserWindow => {
    const mainWindow = new BrowserWindow({
        width: options.width ?? 900,
        height: options.height ?? 670,
        show: false,
        autoHideMenuBar: true,
        // 与 Element Plus 默认主题的 --el-bg-color 一致：页面画出来之前不留异色底。
        backgroundColor: "#ffffff",
        ...(process.platform === "linux" ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            sandbox: false
        }
    });

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    // 站外链接交给系统浏览器，不在应用内开新窗口。
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    loadRenderer(mainWindow);
    return mainWindow;
};

/** 装载 renderer：开发期走 dev server（有 HMR），生产期读本地文件。 */
const loadRenderer = (window: BrowserWindow): void => {
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    } else {
        window.loadFile(join(__dirname, "../renderer/index.html"));
    }
};
