// ============================================================================
//  inspect-header.cjs - 临时脚本：打印标题栏内各元素的计算样式，定位布局问题
//  用法：electron scripts/inspect-header.cjs
//  用完即删。
// ============================================================================

const { app, BrowserWindow, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const outDir = path.join(__dirname, "_verify");
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

    protocol.handle("app", (request) => {
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        return net.fetch(pathToFileURL(path.join(rendererRoot, pathname)).toString());
    });
    await win.loadURL("app://local/index.html");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const report = await win.webContents.executeJavaScript(`
        (() => {
            const props = [
                "display", "position", "height", "minHeight", "lineHeight",
                "alignItems", "padding", "margin", "borderBottomWidth",
                "borderBottomColor", "boxSizing", "overflow", "verticalAlign"
            ];
            const describe = (selector) => {
                const el = document.querySelector(selector);
                if (!el) return { selector, missing: true };
                const cs = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                const out = { selector, rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)] };
                for (const p of props) out[p] = cs[p];
                return out;
            };
            return [
                ".app-header",
                ".app-header__menu",
                ".app-header__menu > .el-menu",
                ".app-header__menu .el-menu-item",
                ".app-header__menu .el-sub-menu__title",
                ".window-controls",
                ".window-controls .el-tooltip__trigger",
                ".window-controls__button"
            ].map(describe);
        })()
    `);

    for (const item of report) {
        console.log(JSON.stringify(item));
    }
    app.exit(0);
});
