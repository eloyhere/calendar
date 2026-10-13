<script setup lang="ts">
/**
 * 品牌图标：把 `resources/icon.svg` 内联成 SVG 画在标题栏里。
 *
 * ## 为什么不直接放 `<img>`
 *
 * `<img src>` 里的 SVG 无法继承页面的 `currentColor`，也没法用 CSS 改尺寸之外的
 * 东西。这里要的是"与窗口图标同一份图形"，所以走 `?raw` 把源文件读成字符串再
 * 内联——`resources/icon.svg` 因此是全应用唯一的图形定义：窗口图标（PNG）由
 * `npm run icons` 从它生成，标题栏直接内联它，两边不会漂移。
 *
 * ## 尺寸与无障碍
 *
 * 只给宽高，`viewBox` 让图形自己缩放。作为纯装饰元素（旁边就有"轩辕历法"文字）
 * 标 `aria-hidden`，避免读屏软件把标题念两遍。
 */

import iconSource from "../../resources/icon.svg?raw";

interface Props {
    /** 边长，单位 px */
    size?: number;
}

const props = withDefaults(defineProps<Props>(), { size: 26 });

/**
 * 内联前先去根元素上的固定 `width` / `height`。
 *
 * SVG 同时给了 `viewBox` 与固定的 256×256，两者都在时固定值优先，图形不会跟着
 * 容器缩放。标题栏里要的是自适应，所以把这两个属性摘掉。
 */
const markup = iconSource
    .replace(/\swidth="\d+"/, "")
    .replace(/\sheight="\d+"/, "")
    .replace("<svg", '<svg class="app-brand__svg" aria-hidden="true" focusable="false"');
</script>

<template>
    <!-- eslint-disable-next-line vue/no-v-html -- 内容是仓库内的自有 SVG，非用户输入 -->
    <span class="app-brand__icon" :style="{ width: `${props.size}px`, height: `${props.size}px` }" v-html="markup" />
</template>

<style scoped>
.app-brand__icon {
    display: block;
    flex-shrink: 0;
    line-height: 0;
}

.app-brand__icon :deep(svg) {
    display: block;
    height: 100%;
    width: 100%;
}
</style>
