// ============================================================================
//  build-icons.cjs - 由 resources/icon.svg 生成全部光栅图标
//
//  产物（全部是脚本产物，不要手工编辑，改图形请改 resources/icon.svg）：
//    resources/icon.png   256×256     运行期窗口图标（BrowserWindow 的 icon）
//    build/icon.ico       多尺寸       electron-builder：Windows 可执行文件图标
//    build/icon.png       512×512      electron-builder：Linux 图标
//    build/icon.icns      多尺寸       electron-builder：macOS 图标
//
//  为什么走 Electron：.svg 是唯一的图形来源，而 Chromium 就在 node_modules 里，
//  它是最准的 SVG 光栅化器（滤镜、渐变、抗锯齿都与运行时渲染一致）。主进程的
//  nativeImage 不支持 SVG，所以运行期图标必须是 PNG——这份 PNG 也由这里生成。
//
//  用法：node_modules\.bin\electron scripts\build-icons.cjs
//  或在 PowerShell 里：& .\node_modules\electron\dist\electron.exe scripts\build-icons.cjs
//
//  注意：本文件跑在 Electron 的主进程里，用 CommonJS（package.json 不是 ESM，
//  且 electron 主进程默认按 CJS 解析 .cjs）。
// ============================================================================

const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "resources", "icon.svg");
const resourcesDir = path.join(root, "resources");
const buildDir = path.join(root, "build");

/** ICO/ICNS 里要放的尺寸。16/24/32 给任务栏与小图标视图，48 给桌面，256 给资源管理器。 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * 光栅化画布的边长上限。
 *
 * 256 是这台机器上能稳定起渲染进程的最大窗口——超过 256 的窗口 Chromium 直接
 * `ERR_FAILED (-2)`（384、512 都试过，见不了窗口就崩），低于 ~40 的小窗口同样
 * 起不来。所以画布固定 256：比它小的目标在该画布上按矢量渲染并裁切，比它大的
 * 目标（macOS/Linux 用的 512）由 256 放大得到。
 */
const CANVAS = 256;

/** ICNS 的图标类型码 → 该类型要求的像素边长（1x / 2x）。 */
const ICNS_TYPES = [
    ["icp4", 16],
    ["icp5", 32],
    ["ic11", 32], // 16pt @2x
    ["ic12", 64], // 32pt @2x
    ["ic07", 128],
    ["ic08", 256],
    ["ic13", 256], // 128pt @2x
    ["ic09", 512],
    ["ic14", 512] // 256pt @2x
];

app.disableHardwareAcceleration();

/**
 * 渲染一个尺寸的图标。
 *
 * 两步走，而不是"窗口多大就截多大"：
 *
 * 1. **固定画布窗口**（边长取 max(目标尺寸, `CANVAS_MIN`)，把 SVG 缩放到目标尺寸
 *    后画在左上角。窗口尺寸不能跟着目标尺寸走——16px、24px 这种窗口在 Windows 上
 *    会让渲染进程直接起不来，`loadURL` 报 `ERR_FAILED (-2)`。固定尺寸也顺带保证
 *    `capturePage` 每次拿到同一块画面。
 * 2. 截下来的画面按目标尺寸做一次高质量重采样。小图不靠"缩大图"，而是靠步骤 1
 *    里按目标尺寸做的矢量光栅化，重采样只在已经画好的像素上做，笔画取舍依然干净。
 *
 * 页面走**临时文件**而不是 `data:` URL：这份 HTML 里带着 8KB 左右的 SVG，长
 * data URL 在这儿会随机 `ERR_FAILED`（短 data URL 正常，长的不行）。落盘加载
 * 既能稳定工作，也让出错时能直接打开临时文件看渲染结果。
 */
async function rasterize(svg, size, canvas, pagePath) {
    const inline = svg
        .replace(/<\?xml[^>]*\?>/, "")
        .replace(/\swidth="\d+"/, ` width="${size}"`)
        .replace(/\sheight="\d+"/, ` height="${size}"`);

    const html =
        `<!doctype html><html><head><meta charset="utf-8">` +
        `<style>html,body{margin:0;padding:0;background:#ffffff;overflow:hidden}` +
        `svg{display:block}</style></head><body>${inline}</body></html>`;

    fs.writeFileSync(pagePath, html, "utf8");

    const win = new BrowserWindow({
        width: canvas,
        height: canvas,
        useContentSize: true,
        show: false,
        frame: false,
        backgroundColor: "#ffffff",
        webPreferences: { backgroundThrottling: false }
    });

    try {
        await win.loadFile(pagePath);
        // 等一帧，确认渐变已经落到画布上（capturePage 赶在首帧前会截到空白）。
        await new Promise((resolve) => setTimeout(resolve, 60));
        const shot = await win.webContents.capturePage();
        const actual = shot.getSize();
        if (actual.width !== canvas || actual.height !== canvas) {
            throw new Error(`画布尺寸不符：期望 ${canvas}，实得 ${actual.width}×${actual.height}`);
        }
        const cropped = shot.crop({ x: 0, y: 0, width: size, height: size });
        if (size !== canvas) {
            return cropped.resize({ width: size, height: size, quality: "best" }).toPNG();
        }
        return cropped.toPNG();
    } finally {
        win.destroy();
    }
}

/**
 * 组装 ICO。
 *
 * 结构：6 字节文件头 + 每张图 16 字节目录项 + 各图数据。目录项里的宽高是单字节，
 * 256 按规范写 0（`0` 表示 256）。数据段直接放 PNG 字节流——Vista 以后都支持，
 * 也是 electron-builder 自己的做法，不必再转 BMP/DIB。
 */
function buildIco(entries) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: 1 = icon
    header.writeUInt16LE(entries.length, 4);

    let offset = 6 + entries.length * 16;
    const directory = [];
    const payload = [];

    for (const { size, png } of entries) {
        const item = Buffer.alloc(16);
        item.writeUInt8(size >= 256 ? 0 : size, 0); // width
        item.writeUInt8(size >= 256 ? 0 : size, 1); // height
        item.writeUInt8(0, 2); // 调色板色数（真彩为 0）
        item.writeUInt8(0, 3); // reserved
        item.writeUInt16LE(1, 4); // color planes
        item.writeUInt16LE(32, 6); // bits per pixel
        item.writeUInt32LE(png.length, 8);
        item.writeUInt32LE(offset, 12);
        directory.push(item);
        payload.push(png);
        offset += png.length;
    }

    return Buffer.concat([header, ...directory, ...payload]);
}

/**
 * 组装 ICNS。
 *
 * 结构：8 字节文件头（magic + 总长度，均大端）+ 若干「类型码(4) + 长度(4) + PNG」块。
 * 所有尺寸都用 PNG 载荷（`ic07` 及以后支持），不做老的 1-bit / RLE 编码。
 * 同一像素尺寸被多个类型码要求时复用同一份 PNG 数据。
 */
function buildIcns(pngBySize) {
    const chunks = [];
    for (const [type, size] of ICNS_TYPES) {
        const png = pngBySize.get(size);
        if (!png) {
            throw new Error(`ICNS 缺少 ${size}px 数据（类型 ${type}）`);
        }
        const head = Buffer.alloc(8);
        head.write(type, 0, 4, "ascii");
        head.writeUInt32BE(png.length + 8, 4);
        chunks.push(head, png);
    }

    const body = Buffer.concat(chunks);
    const header = Buffer.alloc(8);
    header.write("icns", 0, 4, "ascii");
    header.writeUInt32BE(body.length + 8, 4);
    return Buffer.concat([header, body]);
}

function report(label, file, bytes) {
    const kb = (bytes / 1024).toFixed(1);
    console.log(`  ${label.padEnd(22)} ${path.relative(root, file).padEnd(24)} ${kb} KB`);
}

app.whenReady().then(async () => {
    const svg = fs.readFileSync(svgPath, "utf8");
    fs.mkdirSync(buildDir, { recursive: true });

    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-icons-"));
    const pagePath = path.join(scratchDir, "icon.html");

    console.log(`[build-icons] 源：${path.relative(root, svgPath)}`);

    try {
        const pngBySize = new Map();
        for (const size of [...new Set([...ICO_SIZES, ...EXTRA_SIZES])].sort((a, b) => a - b)) {
            pngBySize.set(size, await rasterize(svg, size, Math.max(size, CANVAS_MIN), pagePath));
        }

        const runtimeIcon = path.join(resourcesDir, "icon.png");
        fs.writeFileSync(runtimeIcon, pngBySize.get(256));
        report("运行期窗口图标", runtimeIcon, pngBySize.get(256).length);

        const icoPath = path.join(buildDir, "icon.ico");
        const ico = buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size) })));
        fs.writeFileSync(icoPath, ico);
        report(`安装包 .ico (${ICO_SIZES.length} 尺寸)`, icoPath, ico.length);

        const linuxPngPath = path.join(buildDir, "icon.png");
        fs.writeFileSync(linuxPngPath, pngBySize.get(512));
        report("安装包 PNG 512", linuxPngPath, pngBySize.get(512).length);

        const icnsPath = path.join(buildDir, "icon.icns");
        const icns = buildIcns(pngBySize);
        fs.writeFileSync(icnsPath, icns);
        report(`安装包 .icns (${ICNS_TYPES.length} 项)`, icnsPath, icns.length);
    } finally {
        fs.rmSync(scratchDir, { recursive: true, force: true });
    }

    console.log("[build-icons] 完成");
    app.exit(0);
});
