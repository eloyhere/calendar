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

    app.exit(0);
});
