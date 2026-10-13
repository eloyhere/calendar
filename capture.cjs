/**
 * 临时脚本：把打包产物渲染成一张 PNG，用来目视核对深度研究页。
 *
 * 用法：electron capture.cjs <输出 png>
 * 用完即删——它不属于项目代码，只是为了"看一眼页面到底长什么样"。
 */

const { app, BrowserWindow, protocol, net } = require("electron");
const { existsSync, statSync, writeFileSync } = require("fs");
const { extname, join, resolve, sep } = require("path");
const { pathToFileURL } = require("url");

const root = join(__dirname, "out", "renderer");

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
]);

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("force-device-scale-factor", "1");

app.whenReady().then(async () => {
    protocol.handle("app", async (request) => {
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        let target = resolve(root, `.${pathname}`);

        if (target !== root && !target.startsWith(root + sep)) {
            return new Response("Forbidden", { status: 403 });
        }
        if (!existsSync(target) || !statSync(target).isFile()) {
            if (extname(target) !== "") {
                return new Response("Not found", { status: 404 });
            }
            target = join(root, "index.html");
        }

        return net.fetch(pathToFileURL(target).toString());
    });

    const window = new BrowserWindow({
        width: Number(process.argv[3] ?? 1440),
        height: Number(process.argv[4] ?? 900),
        show: false,
        frame: false,
        backgroundColor: "#ffffff",
        webPreferences: {
            preload: join(__dirname, "out", "preload", "index.js"),
            sandbox: false
        }
    });

    window.webContents.on("console-message", (_event, level, message) => {
        console.log(`[renderer:${level}] ${message}`);
    });

    await window.loadURL("app://local/index.html#/agent/chat/research");
    // 等 Vue 挂载 + 演示数据落地 + 字体就位
    await new Promise((done) => setTimeout(done, 2500));

    // 右栏自己要滚（页面本身不滚），把滚动位置也交给参数
    const panelScroll = Number(process.argv[5] ?? 0);
    if (panelScroll > 0) {
        const applied = await window.webContents.executeJavaScript(`
            (() => {
                const panel = document.querySelector(".chat-context");
                if (!panel) { return "no-panel"; }
                panel.scrollTop = ${panelScroll};
                return panel.scrollTop + "/" + panel.scrollHeight;
            })()
        `);
        console.log(`panel scroll: ${applied}`);
        await new Promise((done) => setTimeout(done, 400));
    }

    const image = await window.webContents.capturePage();
    const output = process.argv[2] ?? join(process.cwd(), "research-page.png");
    writeFileSync(output, image.toPNG());
    console.log(`saved: ${output}`);

    app.quit();
});
