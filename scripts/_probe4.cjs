// 逐步逼近：256 画布 + 真实 SVG，找出到底是哪一步让渲染进程起不来。用完即删。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "resources", "icon.svg"), "utf8");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-probe4-"));
const plain = path.join(dir, "plain.html");
const withSvg = path.join(dir, "withsvg.html");
const minimalSvg = path.join(dir, "minimal.svg.html");

fs.writeFileSync(plain, "<!doctype html><html><body style='margin:0'>hi</body></html>", "utf8");
fs.writeFileSync(
    withSvg,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}svg{display:block}</style></head><body>${svg.replace(/\swidth="\d+"/, ' width="32"').replace(/\sheight="\d+"/, ' height="32"')}</body></html>`,
    "utf8"
);
fs.writeFileSync(
    minimalSvg,
    `<!doctype html><html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="32" height="32"><circle cx="128" cy="128" r="100" fill="#2C4062"/></svg></body></html>`,
    "utf8"
);

console.log("scratch:", dir);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    const runs = [
        ["plain @256", plain],
        ["minimal-svg @256", minimalSvg],
        ["real-svg @256", withSvg]
    ];

    for (const [label, file] of runs) {
        const win = new BrowserWindow({
            width: 256,
            height: 256,
            useContentSize: true,
            show: false,
            frame: false,
            backgroundColor: "#ffffff",
            webPreferences: { backgroundThrottling: false }
        });
        let failed = null;
        win.webContents.on("did-fail-load", (_e, code, desc) => {
            failed = `${code} ${desc}`;
        });
        win.webContents.on("render-process-gone", (_e, details) => {
            failed = `gone: ${details.reason} exit=${details.exitCode}`;
        });
        try {
            await win.loadFile(file);
            await new Promise((r) => setTimeout(r, 60));
            const shot = await win.webContents.capturePage();
            console.log("OK  ", label, JSON.stringify(shot.getSize()), shot.toPNG().length, failed ?? "");
        } catch (error) {
            console.log("FAIL", label, String(error).split("\n")[0], failed ?? "");
        }
        win.destroy();
    }

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("done");
    app.exit(0);
});
