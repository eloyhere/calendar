// 唯一变量：窗口尺寸。同一份 SVG，看哪些尺寸能渲染。用完即删。
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "resources", "icon.svg"), "utf8");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-probe6-"));
const file = path.join(dir, "icon.html");
fs.writeFileSync(
    file,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden}svg{display:block}</style></head><body>${svg.replace(/\swidth="\d+"/, ' width="200"').replace(/\sheight="\d+"/, ' height="200"')}</body></html>`,
    "utf8"
);

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    for (const size of [64, 128, 200, 256, 300, 400, 512, 700, 900]) {
        const win = new BrowserWindow({
            width: size,
            height: size,
            useContentSize: true,
            show: false,
            frame: false
        });
        try {
            await win.loadFile(file);
            const shot = await win.webContents.capturePage();
            console.log("OK  ", size, JSON.stringify(shot.getSize()));
        } catch (error) {
            console.log("FAIL", size, String(error).split("\n")[0].slice(0, 50));
        }
        win.destroy();
    }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("done");
    app.exit(0);
});
