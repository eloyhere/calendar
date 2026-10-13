// ============================================================================
//  capture-log.cjs — 抓帧并把进度写进日志文件
//
//  为什么写文件而不是 console.log：本环境里 Electron 子进程的 stdout
//  不会实时回传（要等进程退出才出现，而进程退出前拿不到任何反馈）。
//  写文件可以由外面轮询，出问题时也能看到卡在哪一步。
//
//  用法：electron scripts/capture-log.cjs [输出目录] [路由...]
// ============================================================================

const { app, BrowserWindow, protocol, net } = require("electron");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const outDir = path.resolve(process.argv[2] || path.join(__dirname, "_shots"));
const routes =
    process.argv.length > 3
        ? process.argv.slice(3)
        : ["/", "/calendar/natural", "/calendar/synodic", "/agent/setting", "/calendar/climate"];

const rendererRoot = path.join(__dirname, "..", "out", "renderer");
const logFile = path.join(outDir, "capture.log");

/*
 * 把 stdout / stderr 的写入变成"永不抛"。
 *
 * 本环境里 Electron 的 stdout 是一个**断开一半的管道**：内核层允许 open，
 * 但写的时候报 EPIPE。而 Electron 内部有几处不可避免的 `console.error`
 * （CDP 失败回显就是一处），它们在 `Session.emit` 里同步写 stdout，
 * 一次 EPIPE 就把进程干掉——**绕过所有 try/catch**，
 * 表现是"截完第一张图，切路由时脚本无声退出"。
 *
 * 所以这里把两个流都接上一个不抛错的壳。真要排错时看 `capture.log`，
 * 它是直接 appendFileSync 写的，不经过这两个流。
 */
for (const stream of [process.stdout, process.stderr]) {
    stream.write = () => true;
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(logFile, "", "utf8");

/** 记一行日志。同步写，保证崩之前那几行已经在盘上。 */
const log = (line) => {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`, "utf8");
};

/**
 * 给任意 Promise 加超时。
 *
 * 本环境里 Electron 的几个 API（`executeJavaScript`、`capturePage`）
 * 都有"永不 resolve"的失败模式，而 Promise 永远挂着时**没有任何报错**，
 * 脚本就静静地停在那里。加超时把"挂住"变成"一条明确的失败记录"。
 */
const withTimeout = (promise, ms, label) =>
    Promise.race([
        promise,
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
    ]);

process.on("uncaughtException", (error) => {
    log(`UNCAUGHT ${String(error?.stack ?? error)}`);
    app.exit(1);
});
process.on("unhandledRejection", (error) => {
    log(`REJECTED ${String(error?.stack ?? error)}`);
});

app.setPath("userData", path.join(outDir, "userdata"));
app.disableHardwareAcceleration();

/*
 * 装上**真实的**主进程 IPC。
 *
 * 不装的话 `window.desktop.calendar.select` 根本不存在，页面上每一条分库查询
 * 都会失败——而失败的后果是"日历一格数据都没有"，看起来像数据缺失。
 * 这个坑踩过一次：截图里的日历连续三版都是"这个时间窗口里没有历法数据"，
 * 而真正的原因是截图脚本没给渲染进程接上数据库。
 *
 * 取的是 `main/ipc.ts` 的**真代码**（用 esbuild 单独打成一个临时 CJS 再 require），
 * 不是脚本里另写一份近似实现——那种测法会把"主进程忘了推状态"这类问题正好漏掉。
 * 不直接 `require("out/main/index.js")`：那个模块顶层就 `app.whenReady()` 建窗口、
 * 装协议、跑生命周期，引进来会另开一个窗口并让脚本永远退不出。
 */
const ipcModulePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "calendar-capture-")), "ipc.cjs");
require("esbuild").buildSync({
    entryPoints: [path.join(__dirname, "..", "main", "ipc.ts")],
    outfile: ipcModulePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"]
});
const { registerIpc } = require(ipcModulePath);

protocol.registerSchemesAsPrivileged([
    {
        scheme: "app",
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
    }
]);

const fileOf = (route) => `${route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "home"}.png`;

app.whenReady().then(async () => {
    log(`ready; routes=${routes.length}`);

    /* 注册 IPC 处理器。必须在页面加载**之前**，否则首屏的查询会打到没装好的通道上 */
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
            backgroundThrottling: false,
            preload: path.join(__dirname, "..", "out", "preload", "index.js")
        }
    });
    win.webContents.setBackgroundThrottling(false);

    const problems = [];
    win.webContents.on("console-message", (event) => {
        if (event.level === "error") {
            // 完整消息（不截断）：配置类错误的全文才看得出是哪几条路径没对上
            problems.push(`[error] ${String(event.message)}`);
        }
    });
    win.webContents.on("did-finish-load", () => log("did-finish-load"));
    win.webContents.on("did-fail-load", (_e, code, description) => log(`did-fail-load ${code} ${description}`));

    try {
        win.webContents.debugger.attach("1.3");
        log("debugger attached");
    } catch (error) {
        log(`debugger attach failed: ${String(error)}`);
    }

    /*
     * 关掉 debugger 的错误回显。
     *
     * `sendCommand` 超时或失败时，Electron 内部会走 `console.error` 把错误打出来。
     * 在本环境里 stdout 是一个**已经断开的管道**（父 shell 收走了读取端），
     * 于是这次 `console.error` 抛 `EPIPE: broken pipe`，而它是在一次
     * `Session.emit` 里同步抛的——**绕过 try/catch**，直接把进程干掉。
     * 表现就是"第一条路由截完，切第二条时脚本无声退出"。
     *
     * 真的需要看 CDP 的错误时，把这一行注释掉即可。
     */
    win.webContents.debugger.on?.("detach", () => {});

    await win.loadURL("app://local/index.html");
    log("loadURL returned");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    log("settle done");

    for (const route of routes) {
        /*
         * 切路由要带超时。
         *
         * 实测过一次：`location.hash = "/"` 之后 `executeJavaScript` 一直不返回
         * （页面在某个渲染循环里没让出主线程）。没有超时的话整个脚本就停在这一行，
         * 而且**看不出停在哪**——日志停在 "route / set" 的上一条，像是路由设置失败。
         * 这里把每一步都包上超时并把结果记下来，卡住时能一眼看出是哪一步。
         */
        try {
            await withTimeout(
                win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(`#${route}`)}; location.hash`),
                8000,
                `set ${route}`
            );
            log(`route ${route} set`);
        } catch (error) {
            log(`route ${route} SET FAILED: ${String(error).split("\n")[0]}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2400));

        /*
         * 只用 `capturePage()`，不用 CDP。
         *
         * 实测：`debugger.sendCommand("Page.captureScreenshot")` 在本环境里
         * **每次都超时**（10s 拿不到结果），而 `capturePage()` 能出图，
         * 代价是第一次要 12 秒左右——之后每次都快。所以顺序反过来：
         * 直接走 `capturePage()`，超时给到 30 秒（冷启动那一次要 12s+）。
         */
        let png = null;
        try {
            const shot = await withTimeout(win.webContents.capturePage(), 30_000, `capturePage ${route}`);
            if (shot.getSize().width > 0) {
                png = shot.toPNG();
                log(`capturePage ok ${png.length}`);
            } else {
                log("capturePage returned empty");
            }
        } catch (error) {
            log(`capturePage failed: ${String(error).split("\n")[0]}`);
        }

        if (png !== null) {
            const file = path.join(outDir, fileOf(route));
            fs.writeFileSync(file, png);
            log(`WROTE ${path.basename(file)} ${png.length}`);
        } else {
            log(`NOPIXEL ${route}`);
        }
    }

    try {
        const probe = await win.webContents.executeJavaScript(`
            (() => {
                const pick = (selector) => {
                    const el = document.querySelector(selector);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
                };
                return {
                    hash: location.hash, title: document.title,
                    rail: pick(".rail"), pages: pick(".pages"), topbar: pick(".topbar"),
                    main: pick(".shell__main"), statusbar: pick(".app-statusbar"),
                    cell: pick(".cal__cell"), aside: pick(".cal-page__aside"), result: pick(".el-result")
                };
            })()
        `);
        log(`PROBE ${JSON.stringify(probe)}`);
    } catch (error) {
        log(`probe failed: ${String(error)}`);
    }

    /*
     * 直接从渲染进程问一次分库。
     *
     * 这一步单独做，是因为"页面显示空"有很多种原因（查询失败、参数没传过去、
     * 窗口算错、结果没被用上），而它们从界面上看**一模一样**。
     * 直接问一次能把范围缩到"是数据这一层还是渲染这一层"。
     */
    try {
        const ipc = await win.webContents.executeJavaScript(`
            (async () => {
                const out = { bridge: typeof window.desktop?.calendar?.select };
                const sql = 'SELECT COUNT(*) AS n FROM "synodic_month" WHERE "end" >= :from AND "start" <= :to';
                try {
                    const r = await window.desktop.calendar.select({
                        module: "synodic", statement: sql,
                        parameters: { from: BigInt("149030841600"), to: BigInt("149034729600") }
                    });
                    out.bigintParams = JSON.stringify(r.rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
                } catch (e) { out.bigintParams = "ERR " + String(e); }
                try {
                    const r = await window.desktop.calendar.select({
                        module: "synodic", statement: sql,
                        parameters: { from: 149030841600, to: 149034729600 }
                    });
                    out.numberParams = JSON.stringify(r.rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
                } catch (e) { out.numberParams = "ERR " + String(e); }
                try {
                    const r = await window.desktop.calendar.select({
                        module: "synodic", statement: 'SELECT COUNT(*) AS n FROM "synodic_month"', parameters: {}
                    });
                    out.noParams = JSON.stringify(r.rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
                } catch (e) { out.noParams = "ERR " + String(e); }

                /* 真正跑一遍日历页要的那条时间轴查询，看回来的字段是什么 */
                try {
                    const from = BigInt("149032569600") - 86400n * 45n;
                    const to = BigInt("149032569600") + 86400n * 75n;
                    const r = await window.desktop.calendar.select({
                        module: "temporal",
                        statement: 'SELECT "absolute", "days", "year", "month", "day" FROM "temporal" WHERE "seconds" = 0 AND "absolute" BETWEEN :from AND :to ORDER BY "absolute"',
                        parameters: { from, to }
                    });
                    out.dayRows = r.rows.length;
                    out.firstDays = JSON.stringify(r.rows.slice(0, 3), (_k, v) => (typeof v === "bigint" ? v.toString() : v));
                } catch (e) { out.dayRows = "ERR " + String(e); }

                /* 再问一次：某一天能不能查到 days */
                try {
                    const r = await window.desktop.calendar.select({
                        module: "temporal",
                        statement: 'SELECT "days" FROM "temporal" WHERE "year" = :year AND "month" = :month AND "day" = :day AND "seconds" = 0 LIMIT 1',
                        parameters: { year: 2026, month: 10, day: 13 }
                    });
                    out.todayRow = JSON.stringify(r.rows, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
                } catch (e) { out.todayRow = "ERR " + String(e); }
                return out;
            })()
        `);
        log(`IPC ${JSON.stringify(ipc)}`);
    } catch (error) {
        log(`ipc probe failed: ${String(error)}`);
    }

    if (problems.length > 0) {
        for (const line of [...new Set(problems)].slice(0, 25)) {
            log(`PROBLEM ${line.replace(/\n/g, " ⏎ ")}`);
        }
    } else {
        log("no renderer errors");
    }

    log("DONE");
    app.exit(0);
});
