// 二分诊断：Windows 上大窗口 + capturePage 的可行上限，以及离屏渲染能否绕开。用完即删。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-probe3-"));
const page = path.join(dir, "page.html");
fs.writeFileSync(page, "<!doctype html><html><body style='margin:0'>hi</body></html>", "utf8");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const runs = [
        { label: "visible @256", size: 256, offscreen: false },
        { label: "visible @384", size: 384, offscreen: false },
        { label: "visible @512", size: 512, offscreen: false },
        { label: "offscreen @512", size: 512, offscreen: true },
        { label: "offscreen @1024", size: 1024, offscreen: true }
    ];

    for (const run of runs) {
        const win = new BrowserWindow({
            width: run.size,
            height: run.size,
            useContentSize: true,
            show: false,
            frame: false,
            webPreferences: { offscreen: run.offscreen, backgroundThrottling: false }
        });
        try {
            await win.loadFile(page);
            const shot = await win.webContents.capturePage();
            console.log("OK  ", run.label, JSON.stringify(shot.getSize()), shot.toPNG().length);
        } catch (error) {
            console.log("FAIL", run.label, String(error).split("\n")[0]);
        }
        win.destroy();
    }

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("done");
    app.exit(0);
});
