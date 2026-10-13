import { net, protocol, shell, BrowserWindow } from "electron";
import { existsSync, statSync } from "fs";
import { extname, join, resolve, sep } from "path";
import { pathToFileURL } from "url";
import { is } from "@electron-toolkit/utils";

import { appIcon } from "./icon";
import { attachWindowState } from "./ipc";

/** 无参无返回值的动作，等价于 `java.lang.Runnable` 的最简对应。 */
export type Runnable = () => void;

/** 窗口创建参数：留出可覆盖的余地，便于以后开多个窗口。 */
export interface WindowOptions {
    width?: number;
    height?: number;
}

/* -------------------------------------------------------------------------- */
/* renderer 的自定义协议 `app://`                                               */
/* -------------------------------------------------------------------------- */

/** 协议名与主机名。主机只是为了凑出合法来源，没有实际含义。 */
const APP_SCHEME = "app";
const APP_HOST = "local";

/** renderer 产物根目录。本文件输出到 `out/main/index.js`，故根是 `out/renderer`。 */
const rendererRoot = join(__dirname, "../renderer");

/** 打包后装载的入口 URL。 */
const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

/**
 * 把 `app://` 登记成特权协议。
 *
 * **必须在 app ready 之前调用**，所以写在模块顶层（`main/index.ts` 在 ready 之前
 * import 本文件）。三个特权各有原因，去掉任何一个都会坏：
 *
 * - `standard`：让 `app://local` 成为一个真正的**来源**。没有它，`app://` 是
 *   "不透明来源"，相对路径资源解析、`history.pushState`、ES module 全部失效；
 * - `secure`：算作安全上下文，否则浏览器特性（crypto、剪贴板等）在页面上不可用；
 * - `supportFetchAPI` / `corsEnabled` / `stream`：页面里用 `fetch` 取自己的资源、
 *   以及 `Range` 请求（音视频拖动）都依赖它们。
 */
protocol.registerSchemesAsPrivileged([
    {
        scheme: APP_SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
]);

/**
 * 把一次 `app://` 请求映射到 `out/renderer` 下的文件。
 *
 * 这里刻意不用 `loadFile`：`loadFile` 走 `file://`，而 `file://` 的来源是不透明的，
 * 页面拿不到 origin——`pushState` 抛 `SecurityError`，刷新与深链会去请求真实文件
 * 路径。自定义协议把页面放回一个正常来源上，这些问题一并消失。
 */
const serveRenderer = async (request: Request): Promise<Response> => {
    let pathname: string;

    try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
        // 畸形百分号编码（`/%zz`）会让 decodeURIComponent 抛错，不该冒泡到协议层
        return new Response("Bad request", { status: 400, headers: { "content-type": "text/plain" } });
    }

    let target = resolve(rendererRoot, `.${pathname}`);

    // 目录穿越：`app://local/../../secret` 必须被挡在 renderer 根之外
    if (target !== rendererRoot && !target.startsWith(rendererRoot + sep)) {
        return new Response("Forbidden", { status: 403, headers: { "content-type": "text/plain" } });
    }

    if (!existsSync(target) || !statSync(target).isFile()) {
        // SPA 深链（`/calendar/astronomy/entry`）回退到 index.html；
        // 但**带扩展名的资源不兜底**——否则缺失的 .js 会拿到一坨 HTML，
        // 报错变成难查的 MIME 错误而不是干脆的 404。
        if (extname(target) !== "") {
            return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
        }
        target = join(rendererRoot, "index.html");
    }

    // 交给 Electron 自己的 file 加载器：它按扩展名给 Content-Type，
    // 而 ES module 对 MIME 是严格的，手写映射很容易漏。
    return net.fetch(pathToFileURL(target).toString());
};

/** `protocol.handle` 只能注册一次，重复注册会覆盖并告警。 */
let appProtocolRegistered = false;

/** 注册 `app://` 处理器；须在 app ready 之后调用（首次建窗口时就在 ready 里）。 */
const registerAppProtocol = (): void => {
    if (appProtocolRegistered) {
        return;
    }
    appProtocolRegistered = true;
    protocol.handle(APP_SCHEME, serveRenderer);
};

/* -------------------------------------------------------------------------- */
/* 窗口                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 新建一个 BrowserWindow 并挂上 renderer。
 *
 * ## 为什么是无边框（`frame: false`）+ 自绘标题栏
 *
 * 系统标题栏之上再画一条页面标题栏，顶部会出现两条"标题带"，颜色与高度都对不齐。
 * 去掉系统边框后，最小化 / 最大化 / 关闭三颗按钮由 `ElButton` 画在页面里
 * （`src/component/AppTitleBar.vue`），样式与切换态跟应用其余部分一致。
 *
 * 代价是三件必须自己接的事，缺一样用户就会觉得"这窗口坏了"：
 * 1. **拖拽区**：靠 CSS 的 `-webkit-app-region: drag`，见 AppTitleBar.vue；
 * 2. **三颗按钮**：走 `window.desktop.window.*`，落到 `main/ipc.ts`；
 * 3. **最大化状态同步**：按钮图标要跟着变，见 `attachWindowState()`。
 *
 * macOS 例外：那边沿用原生红绿灯（`titleBarStyle: "hiddenInset"`），用户习惯在
 * 左上角找它们；`trafficLightPosition` 把它压到与自绘标题栏同一水平线上。
 *
 * 产物布局约定（与 electron.vite.config.ts 对应）：
 * - 本文件输出到 `out/main/index.js`，故 `__dirname` 是 `out/main`；
 * - preload 桥接脚本输出到 `out/preload/index.js`，故取 `../preload/index.js`；
 * - renderer 输出到 `out/renderer/index.html`，由 `app://local/index.html` 装载。
 */
export const createWindow = (options: WindowOptions = {}): BrowserWindow => {
    const mainWindow = new BrowserWindow({
        width: options.width ?? 900,
        height: options.height ?? 670,
        show: false,
        // 与 Element Plus 默认主题的 --el-bg-color 一致：页面画出来之前不留异色底。
        backgroundColor: "#ffffff",
        frame: false,
        ...(process.platform === "darwin"
            ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 16, y: 20 } }
            : {}),
        icon: appIcon(),
        webPreferences: {
            preload: join(__dirname, "../preload/index.js"),
            sandbox: false
        }
    });

    // 系统菜单栏（File / Edit / View…）挂在窗口顶部，会与自绘标题栏并排出现，
    // 还把可拖拽区域切成两段。开发期的 F12 / Ctrl+R 由 main/index.ts 里的
    // `optimizer.watchWindowShortcuts` 提供，不依赖菜单。
    mainWindow.removeMenu();

    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
    });

    // 站外链接交给系统浏览器，不在应用内开新窗口。
    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: "deny" };
    });

    attachWindowState(mainWindow);
    loadRenderer(mainWindow);
    return mainWindow;
};

/**
 * 装载 renderer。
 *
 * - 开发期：走 dev server（`ELECTRON_RENDERER_URL`），保留 HMR；
 * - 其余情况（`electron-vite preview`、打包产物）：走 `app://`，
 *   页面因此有一个正常来源，不再是 `file://` 的不透明来源。
 */
const loadRenderer = (window: BrowserWindow): void => {
    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
        window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
        return;
    }

    registerAppProtocol();
    window.loadURL(APP_ENTRY_URL);
};
