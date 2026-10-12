// 临时探针：把 resources/icon.svg 画成一张「各尺寸对照表」PNG，供人工检视。
// 用完即删（不属于交付物）。运行：electron.exe scripts/_icon-rasterize.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "scripts", "_icon-preview");
const svg = fs.readFileSync(path.join(root, "resources", "icon.svg"), "utf8");
const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
    fs.mkdirSync(outDir, { recursive: true });

    // 先做一组二分诊断：data URL 在小窗口 / 大窗口、短内容 / 长内容下是否可用。
    const small = Buffer.from("<!doctype html><html><body>hi</body></html>").toString("base64");
    const big = Buffer.from(
        "<!doctype html><html><body>" + "x".repeat(8000) + "</body></html>"
    ).toString("base64");

    for (const [label, url, size] of [
        ["short@256", "data:text/html;base64," + small, 256],
        ["short@16", "data:text/html;base64," + small, 16],
        ["long@256", "data:text/html;base64," + big, 256],
        ["long@16", "data:text/html;base64," + big, 16]
    ]) {
        const w = new BrowserWindow({ width: size, height: size, show: false, useContentSize: true });
        try {
            await w.loadURL(url);
            console.log("OK  ", label);
        } catch (error) {
            console.log("FAIL", label, String(error).split("\n")[0]);
        }
        w.destroy();
    }

    app.quit();
});

    const sizes = [16, 20, 24, 32, 48, 64, 128, 256];
    const inline = svg.replace(/<\?xml[^>]*\?>/, "");
    const cells = sizes
        .map((s) => {
            const sized = inline
                .replace(/\swidth="256"/, ` width="${s}"`)
                .replace(/\sheight="256"/, ` height="${s}"`);
            return `<figure style="margin:0;text-align:center">
        <span class="ico">${sized}</span>
        <figcaption>${s}</figcaption>
      </figure>`;
        })
        .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      .ico svg{display:block}
      body{margin:0;background:#f0f0f2;font:12px/1.4 "Segoe UI",sans-serif;color:#333}
      .row{display:flex;gap:18px;align-items:flex-end;padding:16px 20px;border-bottom:1px solid #d8d8dc}
      figure{display:flex;flex-direction:column;gap:6px;align-items:center}
      .dark{background:#1c1c1e;color:#eee}
      .dark figcaption{color:#aaa}
      .blue{background:#0f6cbd;color:#fff}
      .blue figcaption{color:#cfe6fb}
    </style></head><body>
      <div class="row">${cells}</div>
      <div class="row dark">${cells}</div>
      <div class="row blue">${cells}</div>
    </body></html>`;

    const win = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        useContentSize: true
    });
    await win.loadURL("data:text/html;base64," + Buffer.from(html).toString("base64"));
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, "contact-sheet.png"), image.toPNG());
    console.log("sheet", JSON.stringify(image.getSize()));
    app.quit();
});
