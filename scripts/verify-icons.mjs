/**
 * 校验 `src/plugin/icons.ts` 的图标白名单。
 *
 * 为什么需要单独一个脚本：`ICON_NAMES` 是**手写**的，而它必须与
 * `@element-plus/icons-vue` 的真实导出对得上。名字写错时模板里只会得到一句
 * Vue 警告加一个空白——不会报错——所以白名单把这类拼写错误交给 `vue-tsc`
 * 拦住。但如果白名单**自己**写了一个 Element Plus 里没有的名字，`vue-tsc`
 * 反而会放行（它只检查类型），于是运行时才发现。
 *
 * 这个脚本就是补上那一步：把白名单与真实导出逐个比对，并报告重复项
 * （重复不报错，但会让"这个图标登记过没有"这个问题有两个答案）。
 *
 * 用法：`node scripts/verify-icons.mjs`
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import * as ElementIcons from "@element-plus/icons-vue";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src", "plugin", "icons.ts"), "utf8");

const start = source.indexOf("ICON_NAMES = [");
const end = source.indexOf("] as const;", start);

if (start < 0 || end < 0) {
    console.error("在 src/plugin/icons.ts 里找不到 ICON_NAMES 数组。");
    process.exit(1);
}

const body = source.slice(start, end);
const declared = [...body.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)].map((match) => match[1]);
const available = new Set(Object.keys(ElementIcons));

const unknown = declared.filter((name) => !available.has(name));
const seen = new Set();
const duplicates = [];
for (const name of declared) {
    if (seen.has(name)) {
        duplicates.push(name);
    }
    seen.add(name);
}

console.log(`白名单 ${declared.length} 项（去重后 ${seen.size} 项）`);
console.log(`@element-plus/icons-vue 导出 ${available.size} 个图标`);

let failed = false;

if (unknown.length > 0) {
    failed = true;
    console.error(`\n❌ ${unknown.length} 个名字在 @element-plus/icons-vue 里不存在：`);
    for (const name of unknown) {
        console.error(`   ${name}`);
    }
} else {
    console.log("\n✅ 全部名字都能在 @element-plus/icons-vue 里找到");
}

if (duplicates.length > 0) {
    failed = true;
    console.error(`\n❌ ${duplicates.length} 个重复项：${[...new Set(duplicates)].join("、")}`);
} else {
    console.log("✅ 没有重复项");
}

process.exit(failed ? 1 : 0);
