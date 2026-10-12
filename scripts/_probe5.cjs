// 能力矩阵：这个环境到底能光栅化什么。用完即删。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "resources", "icon.svg"), "utf8");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-probe5-"));
const page = (name, body) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${body}</body></html>`, "utf8");
    return p;
};

const cssCircle = '<div style="width:200px;height:200px;border-radius:50%;background:linear-gradient(135deg,#2C4062,#F2C14E)"></div>';
const plainSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="200" height="200"><circle cx="128" cy="128" r="100" fill="#2C4062"/></svg>';
const gradSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2C4062"/><stop offset="1" stop-color="#F2C14E"/></linearGradient></defs><circle cx="128" cy="128" r="100" fill="url(#g)"/></svg>';
const fullSvg = svg.replace(/\swidth="\d+"/, ' width="200"').replace(/\sheight="\d+"/, ' height="200"');

const pages = {
    "css-gradient": page("css.html", cssCircle),
    "svg-plain": page("p1.html", plainSvg),
    "svg-gradient": page("p2.html", gradSvg),
    "svg-icon": page("p3.html", fullSvg)
};

console.log("scratch:", dir);
app.disableHardwareAcceleration();

const MODES = [
    ["offscreen", { offscreen: true }],
    ["plain", {}],
    ["nodisablegpu", { offscreen: false }]
];

app.whenReady().then(async () => {
    for (const [mode, prefs] of MODES) {
        if (mode === "nodisablegpu") continue; // 该模式需要另一支进程参数，单独跑
        for (const [name, file] of Object.entries(pages)) {
            const win = new BrowserWindow({
                width: 256,
                height: 256,
                useContentSize: true,
                show: false,
                frame: false,
                backgroundColor: "#ffffff",
                webPreferences: { backgroundThrottling: false, ...prefs }
            });
            let note = "";
            win.webContents.on("render-process-gone", (_e, d) => {
                note = `gone:${d.reason}/${d.exitCode}`;
            });
            try {
                await win.loadFile(file);
                await new Promise((r) => setTimeout(r, 80));
                const shot = await win.webContents.capturePage();
                console.log("OK  ", mode, name, JSON.stringify(shot.getSize()), shot.toPNG().length, note);
            } catch (error) {
                console.log("FAIL", mode, name, String(error).split("\n")[0], note);
            }
            win.destroy();
        }
    }

    fs.rmSync(dir, { recursive: true, force: true });
    console.log("done");
    app.exit(0);
});
