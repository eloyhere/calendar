// ============================================================================
//  verify-ui.cjs - 临时验证脚本：把页面渲染出来截图
//
//  为什么要单独开一个进程去截：开发实例的窗口在用户桌面上，脚本没法直接抓它。
//  这里按与 main/window.ts 相同的窗口参数新建一个窗口，指向 dev server 或打包产物
//  （走 app:// 协议，与 main/window.ts 的装载方式一致），拿到像素再退出。
//
//  用法：electron scripts/verify-ui.cjs [devServerUrl] [输出目录]
//       不传 URL 时加载 out/renderer/index.html。
//  用完即删。
// ============================================================================

const { app, BrowserWindow, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const url = process.argv[2] || "";
const outDir = process.argv[3] || path.join(__dirname, "_verify");
const rendererRoot = path.join(__dirname, "..", "out", "renderer");

/**
 * 取主进程里真实的 `registerIpc()` 与 `attachWindowState()`。
 *
 * 为什么不直接 `require("out/main/index.js")`：那个模块顶层就 `app.whenReady()`
 * 建窗口、装协议、跑生命周期，引进来会另开一个窗口并让脚本永远退不出。
 * `main/ipc.ts` 是独立模块，模块级没有副作用，所以这里用 esbuild（vite 自带）把它
 * 单独打成一个临时 CJS 再 require——**测的是真代码**，而不是脚本里另写一份近似实现
 * （那种测法会把"主进程忘了推状态"这类问题正好漏掉）。
 */
const os = require("node:os");
const esbuild = require("esbuild");

const ipcModulePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "calendar-verify-")),
    "ipc.cjs"
);

esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "main", "ipc.ts")],
    outfile: ipcModulePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"]
});

const mainIpc = require(ipcModulePath);
const registerIpc = mainIpc.registerIpc;
const attachWindowState = mainIpc.attachWindowState;

app.setPath("userData", path.join(outDir, "userdata"));
app.disableHardwareAcceleration();

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
]);

app.whenReady().then(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    registerIpc();

    const win = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        frame: false,
        backgroundColor: "#ffffff",
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, "..", "out", "preload", "index.js")
        }
    });

    win.webContents.on("console-message", (event) => {
        // Vue 的组件解析警告很长，这里只看前两行，避免刷屏
        if (event.level === "error" || event.level === "warning") {
            const message = String(event.message).split("\n").slice(0, 2).join(" | ");
            console.log(`[renderer:${event.level}]`, message);
        }
    });
    win.webContents.on("did-fail-load", (_event, code, description) => {
        console.log("[renderer] did-fail-load", code, description);
    });

    try {
        if (url) {
            await win.loadURL(url);
        } else {
            protocol.handle("app", (request) => {
                const pathname = decodeURIComponent(new URL(request.url).pathname);
                return net.fetch(pathToFileURL(path.join(rendererRoot, pathname)).toString());
            });
            await win.loadURL("app://local/index.html");
        }
    } catch (error) {
        console.log("加载失败:", String(error).split("\n")[0]);
        app.exit(1);
        return;
    }

    // 挂上"窗口状态变化 → 推给渲染进程"这条链路（与 window.ts 里做的事一致）
    attachWindowState(win);

    // 给 Element Plus 与首屏路由一点时间
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const shot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, "app.png"), shot.toPNG());
    console.log("截图尺寸", JSON.stringify(shot.getSize()));

    // 顺带把标题栏那几个关键元素的实际盒子打出来，便于判断布局有没有崩
    const probe = await win.webContents.executeJavaScript(`
        (() => {
            const pick = (selector) => {
                const el = document.querySelector(selector);
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {
                    selector,
                    x: Math.round(r.x), y: Math.round(r.y),
                    w: Math.round(r.width), h: Math.round(r.height)
                };
            };
            return {
                header: pick(".app-header"),
                brand: pick(".app-header__brand"),
                menu: pick(".app-header__menu"),
                controls: pick(".window-controls"),
                buttons: document.querySelectorAll(".window-controls__button").length,
                svgInBrand: document.querySelectorAll(".app-header__brand svg").length,
                title: document.title,
                dragRegion: getComputedStyle(document.querySelector(".app-header")).getPropertyValue("app-region"),
                desktopBridge: typeof window.desktop === "object" && typeof window.desktop?.window?.close === "function"
            };
        })()
    `);
    console.log("元素探测", JSON.stringify(probe, null, 2));

    // 端到端验证：点"最大化"必须真的最大化窗口，并且按钮换成"还原"图标
    // 窗口要真的显示出来 —— 隐藏的窗口在 Windows 上不能最大化
    win.show();
    await new Promise((resolve) => setTimeout(resolve, 400));

    const diagnostics = await win.webContents.executeJavaScript(`
        (() => {
            const buttons = [...document.querySelectorAll(".window-controls__button")];
            window.__stateLog = [];
            window.desktop.window.onStateChange((s) => window.__stateLog.push(JSON.stringify(s)));
            return {
                disabled: buttons.map((b) => b.disabled),
                hasBridge: typeof window.desktop?.window?.toggleMaximize === "function"
            };
        })()
    `);
    console.log("按钮状态:", JSON.stringify(diagnostics));

    const before = win.isMaximized();
    await win.webContents.executeJavaScript(`
        document.querySelectorAll(".window-controls__button")[1].click()
    `);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const afterMaximize = win.isMaximized();
    // 最大化图标是 1 个矩形，还原图标是 2 个——数矩形即可判断图形有没有换
    const duringMaximize = await win.webContents.executeJavaScript(`
        (() => {
            const button = document.querySelectorAll(".window-controls__button")[1];
            return {
                rects: button.querySelectorAll("rect").length,
                ariaLabel: button.getAttribute("aria-label"),
                innerHTML: button.querySelector("svg")?.outerHTML.slice(0, 90)
            };
        })()
    `);
    console.log(
        "最大化前:",
        before,
        "点击后:",
        afterMaximize,
        "按钮:",
        JSON.stringify(duringMaximize)
    );

    await win.webContents.executeJavaScript(`
        document.querySelectorAll(".window-controls__button")[1].click()
    `);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const rectsWhenNormal = await win.webContents.executeJavaScript(
        `document.querySelectorAll(".window-controls__button")[1].querySelectorAll("rect").length`
    );
    console.log(
        "再点一次（还原）后是否仍最大化:",
        win.isMaximized(),
        "按钮矩形数（1 = 已换回最大化图标）:",
        rectsWhenNormal
    );

    const stateLog = await win.webContents.executeJavaScript(`window.__stateLog`);
    console.log("渲染进程收到的状态推送:", JSON.stringify(stateLog));

    // 拖拽区必须真的是拖拽区，而按钮必须是 no-drag，否则点不动
    const regions = await win.webContents.executeJavaScript(`
        (() => {
            const header = getComputedStyle(document.querySelector(".app-header")).getPropertyValue("app-region");
            const button = getComputedStyle(document.querySelector(".window-controls__button")).getPropertyValue("app-region");
            const menu = getComputedStyle(document.querySelector(".app-header__menu")).getPropertyValue("app-region");
            return { header, button, menu };
        })()
    `);
    console.log("拖拽区域:", JSON.stringify(regions));

    app.exit(0);
});
