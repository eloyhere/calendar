// 二分诊断：Electron 里加载本地文件到极小窗口的可行组合。用完即删。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-probe-"));
const shortPage = path.join(dir, "short.html");
const longPage = path.join(dir, "long.html");
fs.writeFileSync(shortPage, "<!doctype html><html><body>hi</body></html>", "utf8");
fs.writeFileSync(
    longPage,
    "<!doctype html><html><body>" + "x".repeat(8000) + "</body></html>",
    "utf8"
);
console.log("scratch:", dir);

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout(${label})`)), ms))
    ]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const runs = [
        { label: "loadFile short @256", file: shortPage, size: 256, show: false },
        { label: "loadFile short @512", file: shortPage, size: 512, show: false },
        { label: "loadFile long  @256", file: longPage, size: 256, show: false },
        { label: "loadFile long  @512", file: longPage, size: 512, show: false },
        { label: "loadFile long  @512 show", file: longPage, size: 512, show: true },
        { label: "loadURL  long  @512 show", file: longPage, size: 512, show: true, useUrl: true }
    ];

    for (const run of runs) {
        const win = new BrowserWindow({
            width: run.size,
            height: run.size,
            useContentSize: true,
            show: run.show,
            frame: false,
            backgroundColor: "#ffffff"
        });
        win.webContents.on("did-fail-load", (_e, code, desc, url) => {
            console.log("  event did-fail-load", code, desc, String(url).slice(0, 70));
        });
        try {
            if (run.useUrl) {
                await withTimeout(
                    win.loadURL("file:///" + run.file.replace(/\\/g, "/")),
                    6000,
                    run.label
                );
            } else {
                await withTimeout(win.loadFile(run.file), 6000, run.label);
            }
            console.log("OK  ", run.label, JSON.stringify(win.getContentSize()));
        } catch (error) {
            console.log("FAIL", run.label, String(error).split("\n")[0]);
        }
        win.destroy();
    }

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("done");
    app.exit(0);
});
