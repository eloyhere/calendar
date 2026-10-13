// ============================================================================
//  build-icons.cjs - 由 resources/icon.svg 生成全部光栅图标
//
//  产物（都是脚本产物，不要手工编辑；改图形只改 resources/icon.svg）：
//    resources/icon.png   256×256   运行期窗口图标（BrowserWindow 的 icon）
//    build/icon.ico       多尺寸     electron-builder：Windows 可执行文件图标
//    build/icon.png       512×512    electron-builder：Linux 图标
//    build/icon.icns      多尺寸     electron-builder：macOS 图标
//
//  ## 为什么不用 Chromium 渲染
//
//  最省事的做法是开一个隐藏窗口 `loadFile(icon.svg)` 再 `capturePage()`，但在这台
//  机器上不可行：同一份页面、同一个进程，渲染进程会随窗口尺寸随机 `ERR_FAILED`
//  (-2)（64px 能过、128px 崩；重跑一次结论还会变）。根因是 DSH 沙箱给工作区打了
//  Low 完整性标签，Electron 只在被允许的范围内起得来渲染进程。图标生成不该依赖
//  这种环境运气——它必须离线、可重复、在任何机器上产出同样的字节。
//
//  ## 所以这里自带一个极小的 SVG 渲染器
//
//  **没有第二份图形定义**：几何、渐变、层级全部从 icon.svg 解析，改 SVG 就等于改
//  图标。只认 icon.svg 用到的东西：
//    - 元素：rect / circle / path（M L H V C A Z）/ linearGradient / radialGradient
//    - 填充：纯色、url(#渐变)、fill-opacity、opacity
//    - 描边：stroke / stroke-width / stroke-opacity / stroke-linecap（只支持纯色描边）
//  合成方式：每个像素 4×4 超采样求覆盖率，逐层按画家算法做 source-over 混合，
//  因此圆角、圆弧、斜描边都带抗锯齿。
//
//  ## 用法
//
//    node scripts/build-icons.cjs        （npm run icons 会代劳）
//    不需要 Electron，不需要联网，不需要装任何东西。
// ============================================================================

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const svgPath = path.join(root, "resources", "icon.svg");
const resourcesDir = path.join(root, "resources");
const buildDir = path.join(root, "build");

/** ICO 里的尺寸。16/24/32 给任务栏与小图标视图，48 给桌面，256 给资源管理器。 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** 运行期窗口图标尺寸。 */
const RUNTIME_SIZE = 256;

/** Linux 的 electron-builder 图标尺寸。 */
const LINUX_SIZE = 512;

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

/* ========================================================================== */
/* 一、SVG 解析                                                                */
/* ========================================================================== */

/**
 * 把 XML 拆成元素树。
 *
 * 只处理元素、注释、自闭合标签——icon.svg 里没有 CDATA、实体引用与命名空间前缀，
 * 正则足够；为这个用途写一个通用 XML 解析器是过度设计。两条踩过的坑记在这里：
 *
 * 1. **注释必须在扫描标签前剔除**。注释正文里的 `<stop ... />` 会被当成真标签收进
 *    树里，把 `<defs>` 的层级搅乱，结果是渐变表里莫名少几项。剔除时用等长空白替
 *    换而不是删除，这样报错里的位置仍对应原文。
 * 2. **自闭合的 `/` 不能留给属性段**。属性段若写成 `[^>"']*`，它会把 `... />` 里的
 *    空格和斜杠一起吃掉，`selfClosing` 永远是空串，所有元素都被当成"开标签"压栈，
 *    树直接塌掉。所以属性段要么以引号对结尾，要么收在 `/` 或 `>` 之前。
 *
 * 收尾还会核对闭合标签的名字与栈顶是否一致：这份文件被手工改坏时，应当在这里
 * 报出具体行号，而不是安静地渲染出一张缺东西的图。
 */
function parseXml(source) {
    const text = source
        .replace(/<\?xml[\s\S]*?\?>/g, "")
        // 注释的结束符是 `-->`，不能写成 `</...>`：正文里的 `<circle ... />` 会被
        // 当成了结束标记，注释只切掉一半，剩下半截正文混进标签流。
        .replace(/<!--[\s\S]*?-->/g, (comment) => " ".repeat(comment.length));
    const stack = [];
    let rootNode = null;

    const tagPattern =
        /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
    let match;

    while ((match = tagPattern.exec(text)) !== null) {
        const [, closing, name, rawAttrs, selfClosing] = match;

        if (closing) {
            const open = stack.pop();
            if (!open || open.name !== name) {
                throw new Error(
                    `SVG 标签不配对：在第 ${lineOf(text, match.index)} 行遇到 </${name}>，` +
                        `栈顶是 <${open ? open.name : "空"}>`
                );
            }
            continue;
        }

        const node = { name, attrs: parseAttributes(rawAttrs), children: [] };
        const parent = stack[stack.length - 1];
        if (parent) {
            parent.children.push(node);
        } else if (rootNode) {
            throw new Error(`SVG 有多个根元素：<${rootNode.name}> 与 <${name}>`);
        } else {
            rootNode = node;
        }

        if (!selfClosing) {
            stack.push(node);
        }
    }

    if (!rootNode) {
        throw new Error("SVG 里没有找到根元素");
    }
    if (stack.length > 0) {
        throw new Error(`SVG 有未闭合的标签：<${stack[stack.length - 1].name}>`);
    }
    return rootNode;
}

/** 字符下标 → 行号（从 1 开始），用于报错定位。 */
function lineOf(text, index) {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i += 1) {
        if (text[i] === "\n") {
            line += 1;
        }
    }
    return line;
}

/** 解析 `key="value"`；本图形的属性都用双引号。 */
function parseAttributes(raw) {
    const attrs = {};
    const pattern = /([\w:-]+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = pattern.exec(raw)) !== null) {
        attrs[match[1]] = match[2];
    }
    return attrs;
}

/** 深度优先找出所有指定名字的元素。 */
function findAll(node, name, out = []) {
    if (node.name === name) {
        out.push(node);
    }
    for (const child of node.children) {
        findAll(child, name, out);
    }
    return out;
}

/** 取数字属性，缺省时回退。 */
function num(attrs, key, fallback = 0) {
    const value = attrs[key];
    if (value === undefined) {
        return fallback;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** `#RGB` / `#RRGGBB` → `[r, g, b]`。 */
function parseColor(value) {
    if (!value || value === "none") {
        return null;
    }
    const hex = value.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        return [
            Number.parseInt(hex[0] + hex[0], 16),
            Number.parseInt(hex[1] + hex[1], 16),
            Number.parseInt(hex[2] + hex[2], 16)
        ];
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
        return [
            Number.parseInt(hex.slice(0, 2), 16),
            Number.parseInt(hex.slice(2, 4), 16),
            Number.parseInt(hex.slice(4, 6), 16)
        ];
    }
    throw new Error(`认不出的颜色：${value}`);
}

/** `url(#id)` → 渐变引用；纯色 → 颜色；`none` → 空。 */
function parsePaint(value) {
    if (!value || value === "none") {
        return { kind: "none" };
    }
    const reference = /^url\(#([^)]+)\)$/.exec(value.trim());
    if (reference) {
        return { kind: "gradient", id: reference[1] };
    }
    return { kind: "solid", color: parseColor(value) };
}

/** 收集 `<defs>` 里的渐变，编译成 `(盒内归一化坐标) → [r,g,b,a]`。 */
function collectGradients(rootNode) {
    const gradients = new Map();

    for (const node of findAll(rootNode, "linearGradient")) {
        const stops = readStops(node);
        const x1 = num(node.attrs, "x1", 0);
        const y1 = num(node.attrs, "y1", 0);
        const x2 = num(node.attrs, "x2", 1);
        const y2 = num(node.attrs, "y2", 0);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        gradients.set(node.attrs.id, (x, y) => {
            const t = lengthSquared === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
            return sampleStops(stops, clamp01(t));
        });
    }

    for (const node of findAll(rootNode, "radialGradient")) {
        const stops = readStops(node);
        const cx = num(node.attrs, "cx", 0.5);
        const cy = num(node.attrs, "cy", 0.5);
        const r = num(node.attrs, "r", 0.5);

        // 半径按包围盒对角线换算（规范做法），所以非正方形包围盒上的径向渐变是椭圆。
        // 若改成"宽高各自归一化"，圆盘上那团暖光会算成完全不同的形状。
        gradients.set(node.attrs.id, (x, y, bounds) => {
            const unitsPerRadius = r * Math.hypot(bounds.width, bounds.height);
            if (unitsPerRadius === 0) {
                return sampleStops(stops, 0);
            }
            const distance = Math.hypot((x - cx) * bounds.width, (y - cy) * bounds.height);
            return sampleStops(stops, clamp01(distance / unitsPerRadius));
        });
    }

    return gradients;
}

function readStops(node) {
    const stops = findAll(node, "stop").map((stop) => ({
        offset: clamp01(num(stop.attrs, "offset", 0)),
        color: parseColor(stop.attrs["stop-color"] ?? "#000000"),
        opacity: num(stop.attrs, "stop-opacity", 1)
    }));
    if (stops.length === 0) {
        throw new Error(`渐变 #${node.attrs.id} 一个 stop 都没有`);
    }
    return stops.sort((a, b) => a.offset - b.offset);
}

/** 在 stop 列表上按 offset 线性插值，返回 [r, g, b, a]。 */
function sampleStops(stops, t) {
    const first = stops[0];
    const last = stops[stops.length - 1];
    if (t <= first.offset) {
        return [...first.color, first.opacity];
    }
    if (t >= last.offset) {
        return [...last.color, last.opacity];
    }
    for (let i = 1; i < stops.length; i += 1) {
        const previous = stops[i - 1];
        const current = stops[i];
        if (t <= current.offset) {
            const span = current.offset - previous.offset;
            const ratio = span === 0 ? 0 : (t - previous.offset) / span;
            return [
                previous.color[0] + (current.color[0] - previous.color[0]) * ratio,
                previous.color[1] + (current.color[1] - previous.color[1]) * ratio,
                previous.color[2] + (current.color[2] - previous.color[2]) * ratio,
                previous.opacity + (current.opacity - previous.opacity) * ratio
            ];
        }
    }
    return [...last.color, last.opacity];
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

/* ========================================================================== */
/* 二、几何判定                                                                 */
/* ========================================================================== */

/** `d` → 段列表。只支持 M L H V C A Z（绝对坐标，icon.svg 里就是这么写的）。 */
function parsePathData(d) {
    const tokens = d.match(/[MmLlHhVvCcSsAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
    const segments = [];
    let index = 0;
    let command = null;

    const take = () => Number.parseFloat(tokens[index++]);

    while (index < tokens.length) {
        if (/^[A-Za-z]$/.test(tokens[index])) {
            command = tokens[index];
            index += 1;
            if (command === "Z" || command === "z") {
                segments.push({ type: "Z" });
                continue;
            }
        }

        const upper = command.toUpperCase();
        if (upper === "M") {
            segments.push({ type: "M", to: [take(), take()] });
        } else if (upper === "L") {
            segments.push({ type: "L", to: [take(), take()] });
        } else if (upper === "H") {
            segments.push({ type: "H", x: take() });
        } else if (upper === "V") {
            segments.push({ type: "V", y: take() });
        } else if (upper === "C") {
            segments.push({ type: "C", c1: [take(), take()], c2: [take(), take()], to: [take(), take()] });
        } else if (upper === "A") {
            segments.push({
                type: "A",
                rx: take(),
                ry: take(),
                rotation: take(),
                largeArc: take() !== 0,
                sweep: take() !== 0,
                to: [take(), take()]
            });
        } else {
            throw new Error(`path 里不支持的指令：${command}`);
        }
    }

    return segments;
}

/** 段列表 → 折线边集合（贝塞尔与圆弧按需展平）。 */
function buildEdges(segments) {
    const edges = [];
    let current = null;
    let start = null;

    const lineTo = (to) => {
        if (current) {
            edges.push({ from: current, to });
        }
        current = to;
    };

    for (const segment of segments) {
        if (segment.type === "M") {
            current = segment.to;
            start = segment.to;
        } else if (segment.type === "L") {
            lineTo(segment.to);
        } else if (segment.type === "H") {
            lineTo([segment.x, current[1]]);
        } else if (segment.type === "V") {
            lineTo([current[0], segment.y]);
        } else if (segment.type === "C") {
            for (const point of flattenCubic(current, segment.c1, segment.c2, segment.to, 32)) {
                edges.push({ from: current, to: point });
                current = point;
            }
        } else if (segment.type === "A") {
            for (const point of flattenArc(current, segment, 64)) {
                edges.push({ from: current, to: point });
                current = point;
            }
        } else if (segment.type === "Z") {
            if (current && start) {
                lineTo(start);
            }
            current = start;
        } else {
            throw new Error(`认不出的段：${segment.type}`);
        }
    }

    return edges;
}

function flattenCubic(p0, p1, p2, p3, steps) {
    const points = [];
    for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const mt = 1 - t;
        points.push([
            mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
            mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
        ]);
    }
    return points;
}

/** 端点式圆弧 → 折线（按 SVG 规范 F.6.5 求椭圆参数）。 */
function flattenArc(from, segment, steps) {
    const [x1, y1] = from;
    const [x2, y2] = segment.to;

    if (x1 === x2 && y1 === y2) {
        return [];
    }

    const phi = (segment.rotation * Math.PI) / 180;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    const dx2 = (x1 - x2) / 2;
    const dy2 = (y1 - y2) / 2;
    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;

    let rx = Math.abs(segment.rx);
    let ry = Math.abs(segment.ry);
    if (rx === 0 || ry === 0) {
        return [segment.to];
    }

    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lambda > 1) {
        const scale = Math.sqrt(lambda);
        rx *= scale;
        ry *= scale;
    }

    const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const factor =
        (segment.largeArc === segment.sweep ? -1 : 1) *
        Math.sqrt(Math.max(0, numerator / denominator));

    const cxp = (factor * rx * y1p) / ry;
    const cyp = (-factor * ry * x1p) / rx;
    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

    const startAngle = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
    const endAngle = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);

    let delta = endAngle - startAngle;
    if (!segment.sweep && delta > 0) {
        delta -= 2 * Math.PI;
    } else if (segment.sweep && delta < 0) {
        delta += 2 * Math.PI;
    }

    const points = [];
    for (let i = 1; i <= steps; i += 1) {
        const theta = startAngle + (delta * i) / steps;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        points.push([
            cx + rx * cosTheta * cosPhi - ry * sinTheta * sinPhi,
            cy + rx * cosTheta * sinPhi + ry * sinTheta * cosPhi
        ]);
    }
    return points;
}

function distanceToSegment(x, y, from, to) {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp01(((x - from[0]) * dx + (y - from[1]) * dy) / lengthSquared);
    return Math.hypot(x - (from[0] + t * dx), y - (from[1] + t * dy));
}

/** 非零环绕：射线法数穿越方向。 */
function windingContains(edges, x, y) {
    let winding = 0;
    for (const edge of edges) {
        const { from, to } = edge;
        if (from[1] <= y) {
            if (to[1] > y && isLeft(from, to, x, y) > 0) {
                winding += 1;
            }
        } else if (to[1] <= y && isLeft(from, to, x, y) < 0) {
            winding -= 1;
        }
    }
    return winding !== 0;
}

function isLeft(from, to, x, y) {
    return (to[0] - from[0]) * (y - from[1]) - (x - from[0]) * (to[1] - from[1]);
}

/* ========================================================================== */
/* 三、把 SVG 编译成图层                                                        */
/* ========================================================================== */

/**
 * 解析 icon.svg，输出：
 *   `{ viewBox, shapes: [...] }`
 * 每个 shape 提供统一的 `inside(x, y)`，以及自己的填充/描边描述。渐变在编译期
 * 解析成"盒内归一化坐标 → 颜色"，运行期只做采样。
 */
function compileIcon(svgSource) {
    const svg = parseXml(svgSource);
    const width = num(svg.attrs, "width", 256);
    const height = num(svg.attrs, "height", 256);
    const viewBox = (svg.attrs.viewBox ?? `0 0 ${width} ${height}`)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

    const gradients = collectGradients(svg);
    const shapes = [];

    /**
     * 递归展开元素。
     *
     * `<g>` 只做属性继承（fill / opacity / stroke 等），不建自己的几何——分组在
     * 本图形里只用来给一组点共用一个 fill，展开后与逐个写属性等价。
     */
    const walk = (node, inherited) => {
        if (["defs", "title", "desc", "linearGradient", "radialGradient"].includes(node.name)) {
            return;
        }

        const attrs = { ...inherited, ...node.attrs };

        if (node.name === "g") {
            for (const child of node.children) {
                walk(child, attrs);
            }
            return;
        }

        const shape = compileShape({ name: node.name, attrs });
        const opacity = num(attrs, "opacity", 1);

        shape.fill = resolveFill(parsePaint(attrs.fill), shape.bounds, gradients, opacity);
        shape.fillAlpha = opacity * num(attrs, "fill-opacity", 1);

        const strokePaint = parsePaint(attrs.stroke);
        const strokeWidth = num(attrs, "stroke-width", 0);
        if (strokePaint.kind !== "none" && strokeWidth > 0) {
            shape.stroke = {
                paint: resolveFill(
                    strokePaint,
                    shape.bounds,
                    gradients,
                    opacity * num(attrs, "stroke-opacity", 1)
                ),
                width: strokeWidth,
                round: attrs["stroke-linecap"] === "round"
            };
        }

        shapes.push(shape);
    };

    for (const node of svg.children) {
        walk(node, {});
    }

    return { viewBox, shapes };
}

/** 单个元素 → `{ bounds, distance(x, y) }`；distance 为"到图形边界的有符号距离"（内含为负）。 */
function compileShape(node) {
    if (node.name === "rect") {
        const rect = {
            x: num(node.attrs, "x"),
            y: num(node.attrs, "y"),
            width: num(node.attrs, "width"),
            height: num(node.attrs, "height"),
            radius: num(node.attrs, "rx")
        };
        return { element: node.name, bounds: rect, distance: (x, y) => roundedRectDistance(x, y, rect) };
    }

    if (node.name === "circle") {
        const cx = num(node.attrs, "cx");
        const cy = num(node.attrs, "cy");
        const r = num(node.attrs, "r");
        return {
            element: node.name,
            bounds: { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
            distance: (x, y) => Math.hypot(x - cx, y - cy) - r
        };
    }

    if (node.name === "path") {
        const segments = parsePathData(node.attrs.d);
        const edges = buildEdges(segments);
        const isClosed = segments.some((segment) => segment.type === "Z");

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const edge of edges) {
            minX = Math.min(minX, edge.from[0], edge.to[0]);
            minY = Math.min(minY, edge.from[1], edge.to[1]);
            maxX = Math.max(maxX, edge.from[0], edge.to[0]);
            maxY = Math.max(maxY, edge.from[1], edge.to[1]);
        }

        // 开放路径的两个端点：描边圆头（stroke-linecap="round"）以端点为中心画半圆，
        // 只按"到边界的距离"算会得到平切口，所以这里把端点也纳入距离场。
        const endpoints = isClosed
            ? []
            : [edges[0].from, edges[edges.length - 1].to];

        return {
            element: node.name,
            bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
            inside: (x, y) => windingContains(edges, x, y),
            distance: (x, y) => {
                let nearest = Infinity;
                for (const edge of edges) {
                    const d = distanceToSegment(x, y, edge.from, edge.to);
                    if (d < nearest) {
                        nearest = d;
                    }
                }
                for (const endpoint of endpoints) {
                    const d = Math.hypot(x - endpoint[0], y - endpoint[1]);
                    if (d < nearest) {
                        nearest = d;
                    }
                }
                return windingContains(edges, x, y) ? -nearest : nearest;
            }
        };
    }

    throw new Error(`icon.svg 里出现了本脚本不认识的元素：<${node.name}>`);
}

/** 圆角矩形的有符号距离：内部为负，边界为 0，外部为正。 */
function roundedRectDistance(x, y, rect) {
    const r = Math.min(rect.radius, rect.width / 2, rect.height / 2);
    const halfWidth = rect.width / 2;
    const halfHeight = rect.height / 2;
    const dx = Math.abs(x - (rect.x + halfWidth)) - (halfWidth - r);
    const dy = Math.abs(y - (rect.y + halfHeight)) - (halfHeight - r);
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    const inside = Math.min(Math.max(dx, dy), 0);
    return outside + inside - r;
}

/**
 * 填充解析。
 *
 * 渐变按 SVG 默认的 `objectBoundingBox` 单位处理：`x1/y1/x2/y2` 与 `cx/cy/r` 都是
 * 相对**该图形包围盒**的比例。这里把"盒内归一化坐标 + 包围盒尺寸"一起交给渐变，
 * 径向渐变需要后者才能按对角线算半径。
 */
function resolveFill(paint, bounds, gradients, opacity) {
    if (paint.kind === "none") {
        return null;
    }
    if (paint.kind === "solid") {
        return () => [...paint.color, opacity];
    }

    const gradient = gradients.get(paint.id);
    if (!gradient) {
        throw new Error(`找不到渐变 #${paint.id}`);
    }
    return (x, y) => {
        const [r, g, b, a] = gradient(
            (x - bounds.x) / bounds.width,
            (y - bounds.y) / bounds.height,
            bounds
        );
        return [r, g, b, a * opacity];
    };
}

/* ========================================================================== */
/* 四、光栅化                                                                   */
/* ========================================================================== */

/**
 * 渲染成 PNG。
 *
 * 流程：
 * 1. 建立 `图形坐标 → 像素坐标` 的映射（`scale = 目标尺寸 / viewBox 边长`）；
 * 2. 每个图层单独出一份**有符号距离场**（SDF，按像素中心采样）。填充覆盖率由
 *    SDF 直接算 `clamp(0.5 - sdf, 0, 1)`，描边覆盖率由 `clamp(half + 0.5 - |sdf|)`
 *    算——两者共用同一份 SDF，圆角矩形的金边因此不需要另一套几何；
 * 3. 逐图层做 source-over 叠加，最后压成 PNG。
 *
 * 用 SDF 而不是逐点内外测试，是因为描边本质上是"到边界的距离 ≤ strokeWidth/2"，
 * 而填充是"距离 ≤ 0"——同一份距离场把两件事一次算清，且边缘天然抗锯齿。
 */
function renderIcon(icon, size) {
    const [viewX, viewY, viewWidth, viewHeight] = icon.viewBox;
    const scale = size / Math.max(viewWidth, viewHeight);
    const pixels = new Float32Array(size * size * 4);

    for (const shape of icon.shapes) {
        const field = rasterizeSdf(shape, size, viewX, viewY, scale);
        if (!field) {
            continue;
        }
        compositeLayer(pixels, size, shape, field, viewX, viewY, scale);
    }

    return encodePng(size, size, toRgba8(pixels, size));
}

/**
 * 单图层的距离场。
 *
 * 返回 `{ left, top, width, height, data }`，`data` 是逐像素的**有符号距离**（图形
 * 坐标）：图形内部为负、边界为 0、外部为正。填充覆盖率由它算 `clamp(0.5 - sdf)`，
 * 描边覆盖率由 `clamp(strokeHalf + 0.5 - |sdf|)` 算——两者共用一份距离场，
 * 圆角矩形的金边因此不需要另一套几何。
 *
 * 只算图形包围盒外扩描边宽度的矩形区域；没有描边时外扩 2 个像素兜住抗锯齿。
 */
function rasterizeSdf(shape, size, viewX, viewY, scale) {
    const strokeHalf = shape.stroke ? shape.stroke.width / 2 : 0;
    const pad = Math.max(strokeHalf, 2 / scale);
    const { bounds } = shape;

    const left = Math.max(0, Math.floor((bounds.x - viewX - pad) * scale));
    const top = Math.max(0, Math.floor((bounds.y - viewY - pad) * scale));
    const right = Math.min(size - 1, Math.ceil((bounds.x - viewX + bounds.width + pad) * scale));
    const bottom = Math.min(size - 1, Math.ceil((bounds.y - viewY + bounds.height + pad) * scale));

    if (right < left || bottom < top) {
        return null;
    }

    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;
    const data = new Float32Array(boxWidth * boxHeight);

    for (let py = top; py <= bottom; py += 1) {
        for (let px = left; px <= right; px += 1) {
            const x = viewX + (px + 0.5) / scale;
            const y = viewY + (py + 0.5) / scale;
            data[(py - top) * boxWidth + (px - left)] = shape.distance(x, y);
        }
    }

    return { left, top, width: boxWidth, height: boxHeight, data };
}

/** 逐层 source-over 合成。 */
function compositeLayer(pixels, size, shape, field, viewX, viewY, scale) {
    const strokeHalf = shape.stroke ? shape.stroke.width / 2 : 0;
    const pixel = 1 / scale;

    for (let py = field.top; py < field.top + field.height; py += 1) {
        for (let px = field.left; px < field.left + field.width; px += 1) {
            const sdf = field.data[(py - field.top) * field.width + (px - field.left)];

            // 覆盖率 = "该像素里有多大比例满足条件"，用 SDF 做一像素宽的软过渡。
            const fillCoverage = shape.fill ? clamp01(0.5 - sdf / pixel) : 0;
            const edgeCoverage = shape.stroke
                ? clamp01((strokeHalf + 0.5 * pixel - Math.abs(sdf)) / pixel)
                : 0;

            if (fillCoverage <= 0 && edgeCoverage <= 0) {
                continue;
            }

            // 像素中心落在图形坐标系里的位置，用于取渐变色。
            const x = viewX + (px + 0.5) / scale;
            const y = viewY + (py + 0.5) / scale;
            const target = (py * size + px) * 4;

            if (fillCoverage > 0 && shape.fill) {
                const [r, g, b, a] = shape.fill(x, y);
                blend(pixels, target, r, g, b, a * shape.fillAlpha * fillCoverage);
            }

            if (edgeCoverage > 0 && shape.stroke) {
                // 描边覆盖率里含了本体；有填充时本体已由上面画过，这里只取外扩的环带。
                const alpha = shape.fill ? Math.max(0, edgeCoverage - fillCoverage) : edgeCoverage;
                if (alpha > 0) {
                    const [r, g, b, a] = shape.stroke.paint(x, y);
                    blend(pixels, target, r, g, b, a * alpha);
                }
            }
        }
    }
}

/** source-over：把 (r,g,b,a) 叠到目标像素上。`pixels` 是 0~255 的浮点缓冲。 */
function blend(pixels, target, r, g, b, alpha) {
    if (alpha <= 0) {
        return;
    }
    const inverse = 1 - alpha;
    pixels[target] = r * alpha + pixels[target] * inverse;
    pixels[target + 1] = g * alpha + pixels[target + 1] * inverse;
    pixels[target + 2] = b * alpha + pixels[target + 2] * inverse;
    pixels[target + 3] = alpha * 255 + pixels[target + 3] * inverse;
}

function toRgba8(pixels, size) {
    const out = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
        out[i * 4] = clampByte(pixels[i * 4]);
        out[i * 4 + 1] = clampByte(pixels[i * 4 + 1]);
        out[i * 4 + 2] = clampByte(pixels[i * 4 + 2]);
        out[i * 4 + 3] = clampByte(pixels[i * 4 + 3]);
    }
    return out;
}

const clampByte = (value) => (value < 0 ? 0 : value > 255 ? 255 : Math.round(value));

/* ========================================================================== */
/* 五、PNG / ICO / ICNS 编码                                                    */
/* ========================================================================== */

function crc32(buffer) {
    if (!crc32.table) {
        crc32.table = new Int32Array(256);
        for (let n = 0; n < 256; n += 1) {
            let c = n;
            for (let k = 0; k < 8; k += 1) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            crc32.table[n] = c;
        }
    }
    let crc = -1;
    for (let i = 0; i < buffer.length; i += 1) {
        crc = crc32.table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([length, typeAndData, crc]);
}

/** RGBA8 → PNG。行首加一个 filter 字节（0 = None）。 */
function encodePng(width, height, rgba) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.writeUInt8(8, 8); // bit depth
    ihdr.writeUInt8(6, 9); // color type: RGBA
    ihdr.writeUInt8(0, 10); // compression
    ihdr.writeUInt8(0, 11); // filter
    ihdr.writeUInt8(0, 12); // interlace

    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y += 1) {
        raw[y * (stride + 1)] = 0;
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }

    return Buffer.concat([
        signature,
        pngChunk("IHDR", ihdr),
        pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        pngChunk("IEND", Buffer.alloc(0))
    ]);
}

/**
 * 组装 ICO。
 *
 * 结构：6 字节文件头 + 每张图 16 字节目录项 + 各图数据。目录项里的宽高是单字节，
 * 256 按规范写 0（0 表示 256）。数据段直接放 PNG 字节流——Vista 以后都支持，
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
        item.writeUInt8(size >= 256 ? 0 : size, 0);
        item.writeUInt8(size >= 256 ? 0 : size, 1);
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

/* ========================================================================== */
/* 六、入口                                                                     */
/* ========================================================================== */

function report(label, file, bytes) {
    console.log(
        `  ${label.padEnd(24)} ${path.relative(root, file).padEnd(22)} ${(bytes / 1024).toFixed(1)} KB`
    );
}

function main() {
    const started = Date.now();
    const icon = compileIcon(fs.readFileSync(svgPath, "utf8"));
    console.log(
        `[build-icons] ${path.relative(root, svgPath)}：viewBox ${icon.viewBox.join(" ")}，${icon.shapes.length} 个图层`
    );

    fs.mkdirSync(buildDir, { recursive: true });

    const pngBySize = new Map();
    for (const size of [...new Set([...ICO_SIZES, RUNTIME_SIZE, LINUX_SIZE])].sort((a, b) => a - b)) {
        pngBySize.set(size, renderIcon(icon, size));
    }

    const runtimeIcon = path.join(resourcesDir, "icon.png");
    fs.writeFileSync(runtimeIcon, pngBySize.get(RUNTIME_SIZE));
    report(`运行期窗口图标 ${RUNTIME_SIZE}`, runtimeIcon, pngBySize.get(RUNTIME_SIZE).length);

    const icoPath = path.join(buildDir, "icon.ico");
    const ico = buildIco(ICO_SIZES.map((size) => ({ size, png: pngBySize.get(size) })));
    fs.writeFileSync(icoPath, ico);
    report(`安装包 .ico (${ICO_SIZES.length} 尺寸)`, icoPath, ico.length);

    const linuxIcon = path.join(buildDir, "icon.png");
    fs.writeFileSync(linuxIcon, pngBySize.get(LINUX_SIZE));
    report(`安装包 PNG ${LINUX_SIZE}`, linuxIcon, pngBySize.get(LINUX_SIZE).length);

    const icnsPath = path.join(buildDir, "icon.icns");
    const icns = buildIcns(pngBySize);
    fs.writeFileSync(icnsPath, icns);
    report(`安装包 .icns (${ICNS_TYPES.length} 项)`, icnsPath, icns.length);

    console.log(`[build-icons] 完成，用时 ${Date.now() - started} ms`);

    // 调试用：把每个尺寸单独落盘，方便肉眼核对渲染结果（不参与构建产物）。
    const previewDir = process.env.CALENDAR_ICON_PREVIEW;
    if (previewDir) {
        fs.mkdirSync(previewDir, { recursive: true });
        for (const [size, png] of pngBySize) {
            fs.writeFileSync(path.join(previewDir, `gen-${size}.png`), png);
        }
        console.log(`[build-icons] 预览已写入 ${path.relative(root, previewDir)}`);
    }
}

// 仅当被直接执行时才生成图标；被 require 进来时只暴露函数，方便单独调参或测试。
if (require.main === module) {
    main();
}
