/**
 * 验证「翻木星月，格子会跟着变」。
 *
 * ## 为什么需要驱动式验证
 *
 * 这个 bug 是**交互态**的：点"下月"之后格子不动。截图只能看到初始状态，
 * 看不出这个。所以必须**真的点一下**，再把点击前后的页头文案与首格日期读出来比对。
 *
 * ## 骨架照抄 `capture-log.cjs`
 *
 * 这个环境里有几个坑，那份脚本已经踩过了：`capturePage()` 对显示窗口挂死、
 * Electron 子进程的 stdout 不实时回传、`console.error` 遇到 EPIPE 会杀掉进程。
 * 页面用自定义 `app://` 协议加载（不是 http，所以不能写 `http://localhost/`）。
 *
 * 用法：
 *   Remove-Item Env:\ELECTRON_RUN_AS_NODE
 *   node_modules\electron\dist\electron.exe scripts\probe-step-month.cjs
 */
const { app, BrowserWindow, net, protocol } = require("electron");
const { spawnSync } = require("node:child_process");
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const LOG = "scripts/_shots/step.log";
mkdirSync("scripts/_shots", { recursive: true });
writeFileSync(LOG, "");
const log = (line) => appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

/* stdout 在本环境里不实时回传，而且 EPIPE 会杀掉进程 */
process.stdout.write = () => true;
process.stderr.write = () => true;

const rendererRoot = path.resolve("out/renderer");

/* 打包主进程 IPC —— 不注册的话首屏查询全部打空 */
const ipcModulePath = path.resolve("scripts/_shots/ipc.cjs");
spawnSync(
    process.platform === "win32" ? "node_modules\\.bin\\esbuild.cmd" : "node_modules/.bin/esbuild",
    [
        "main/ipc.ts",
        "--bundle",
        "--platform=node",
        "--format=cjs",
        "--external:electron",
        `--outfile=${ipcModulePath}`
    ],
    { stdio: "ignore", shell: true }
);
const { registerIpc } = require(ipcModulePath);

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
]);

/** 被测用例。木星历是目标，另两个历法作对照。 */
const CASES = [
    { route: "/calendar/jupiter", steps: 3, why: "一个月 361 天，必然跳出已加载窗口" },
    { route: "/calendar/climate", steps: 3, why: "一个月 15 天，对照" },
    { route: "/calendar/natural", steps: 3, why: "一个月 29/30 天，对照" }
];

/** 读取能辨识"格子换了没有"的三处文案。 */
const READ = `(() => {
    const head = document.querySelector(".cal-page__period-main");
    const title = document.querySelector(".cal__title");
    const cells = [...document.querySelectorAll(".el-calendar-table td .cal__day")];
    return JSON.stringify({
        head: head ? head.textContent.replace(/\\s+/g, " ").trim() : null,
        title: title ? title.textContent.replace(/\\s+/g, " ").trim() : null,
        firstDay: cells.length > 0 ? cells[0].textContent.trim() : null
    });
})()`;

/** 点"下月"。 */
const CLICK = `(() => {
    const next = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("下月"));
    if (!next) return "NOT_FOUND";
    next.click();
    return "CLICKED";
})()`;

app.whenReady().then(async () => {
    try {
        registerIpc();
        log("ipc registered");
    } catch (error) {
        log(`ipc register failed: ${String(error)}`);
    }

    protocol.handle("app", (request) => {
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        return net.fetch(pathToFileURL(path.join(rendererRoot, pathname)).toString());
    });

    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        show: false,
        frame: false,
        backgroundColor: "#ffffff",
        webPreferences: {
            sandbox: false,
            contextIsolation: true,
            preload: path.resolve("out/preload/index.js")
        }
    });

    win.webContents.on("console-message", (_event, level, message) => {
        if (level >= 2) {
            log(`CONSOLE ${String(message).slice(0, 180)}`);
        }
    });

    await win.loadURL("app://local/index.html");
    log("loaded");

    for (const item of CASES) {
        await win.webContents.executeJavaScript(`location.hash = "#${item.route}"`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        log(`\n=== ${item.route}（${item.why}）===`);
        log(`  点击前 ${await win.webContents.executeJavaScript(READ)}`);

        for (let step = 1; step <= item.steps; step += 1) {
            const clicked = await win.webContents.executeJavaScript(CLICK);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            log(`  第 ${step} 次 ${clicked} → ${await win.webContents.executeJavaScript(READ)}`);
        }
    }

    log("\nDONE");
    app.quit();
});
