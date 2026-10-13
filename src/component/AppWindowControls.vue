<script setup lang="ts">
/**
 * 窗口按钮：最小化 / 最大化（还原）/ 关闭。
 *
 * ## 为什么是三个 `ElButton`
 *
 * 窗口是无边框的（`main/window.ts` 的 `frame: false`），系统标题栏不存在，这三颗
 * 按钮得由页面提供。用 `ElButton` 是为了跟应用其它按钮共享状态样式（禁用、聚焦环、
 * `--el-*` 变量），不必自己从零写一套 hover / disabled。
 *
 * ## 每一颗都要自己声明 `no-drag`
 *
 * 承载它的标题栏整条是可拖拽区（`-webkit-app-region: drag`），而拖拽区的判定是
 * 按 z 序取最上层元素——按钮如果不显式标 `no-drag`，点下去只会开始拖窗口。
 * 拖拽区是"整条"而不是"一条 spacer"，所以这里必须逐个标注。
 *
 * ## 最大化状态从哪来
 *
 * 事实来源在主进程：双击标题栏、Win+↑、系统右键菜单都会改它，页面无从预判。所以
 * 这里只订阅 `window.desktop.window.onStateChange`，不自己维护一份"点过了就翻转"
 * 的本地状态。主进程在页面加载完成时会主动推一次，因此不存在"先按未最大化画一遍、
 * 再跳成还原"的闪烁。
 */

import { computed, h, onUnmounted, ref } from "vue";
import type { FunctionalComponent } from "vue";
import { Close, FullScreen, Minus } from "@element-plus/icons-vue";

import type { WindowState } from "../../shared/window-api";

/**
 * "还原"图标：两个错开重叠的方框。
 *
 * Element Plus 里没有这个形状——`CopyDocument` 是带折角的纸张，`ScaleToOriginal`
 * 是缩放箭头，都不像窗口按钮。它是 Windows 上最有辨识度的一颗，所以画一个极简版：
 * 两个矩形，用 `currentColor` 描边以跟随按钮文字颜色。
 */
const RestoreIcon: FunctionalComponent = () =>
    h("svg", { viewBox: "0 0 12 12", width: "1em", height: "1em", "aria-hidden": "true" }, [
        h("rect", {
            x: 0.75,
            y: 2.75,
            width: 6.5,
            height: 6.5,
            rx: 1,
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.1
        }),
        h("path", {
            d: "M3.75 2.75V1.75a1 1 0 0 1 1-1h5.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-1",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.1,
            "stroke-linecap": "round"
        })
    ]);

/** 初始按"未最大化"画；主进程很快会推真实值过来。 */
const state = ref<WindowState>({ isMaximized: false, isFullScreen: false });

/**
 * 桥接可能不存在：用普通浏览器单独调试前端时 `window.desktop` 是 undefined。
 * 那种情况下按钮点了没反应，但不该因此白屏——降级成三个禁用按钮更容易看出问题。
 */
const windowApi = window.desktop?.window ?? null;
const controllable = windowApi !== null;

const unsubscribe = windowApi?.onStateChange((next) => {
    state.value = next;
});
onUnmounted(() => unsubscribe?.());

/** 最大化或全屏时，中间那颗显示"还原"。 */
const restored = computed(() => state.value.isMaximized || state.value.isFullScreen);

/** 中间按钮的提示与无障碍名称，随状态变。 */
const maximizeLabel = computed(() => (restored.value ? "向下还原" : "最大化"));

/** 三颗按钮都"发完就忘"：状态变化由主进程推回来，这里不做乐观更新。 */
function minimize(): void {
    windowApi?.minimize();
}

function toggleMaximize(): void {
    windowApi?.toggleMaximize();
}

function close(): void {
    windowApi?.close();
}
</script>

<template>
    <div class="window-controls">
        <ElTooltip content="最小化" placement="bottom" :show-after="400">
            <ElButton
                class="window-controls__button"
                :disabled="!controllable"
                aria-label="最小化"
                @click="minimize">
                <ElIcon><Minus /></ElIcon>
            </ElButton>
        </ElTooltip>

        <ElTooltip :content="maximizeLabel" placement="bottom" :show-after="400">
            <ElButton
                class="window-controls__button"
                :disabled="!controllable"
                :aria-label="maximizeLabel"
                @click="toggleMaximize">
                <ElIcon>
                    <component :is="restored ? RestoreIcon : FullScreen" />
                </ElIcon>
            </ElButton>
        </ElTooltip>

        <ElTooltip content="关闭" placement="bottom" :show-after="400">
            <ElButton
                class="window-controls__button window-controls__button--close"
                :disabled="!controllable"
                aria-label="关闭"
                @click="close">
                <ElIcon><Close /></ElIcon>
            </ElButton>
        </ElTooltip>
    </div>
</template>

<style scoped>
.window-controls {
    align-items: stretch;
    align-self: stretch;
    display: flex;
    flex-shrink: 0;
    /* 贴在窗口右上角：抵消标题栏自身的右内边距，右侧不留白 */
    margin-right: -14px;
}

/*
 * 三颗按钮：贴边、无圆角、正方形热区。圆角会让右上角看着缺一块；
 * 无圆角 + 贴边才是窗口按钮该有的样子。
 */
.window-controls__button {
    app-region: no-drag;
    border: none;
    border-radius: 0;
    color: var(--el-text-color-regular);
    font-size: 15px;
    height: 100%;
    margin: 0;
    padding: 0;
    width: 46px;
}

.window-controls__button:hover:not(.is-disabled) {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
}

/* 关闭键 hover 变红：Windows 上的肌肉记忆，照做 */
.window-controls__button--close:hover:not(.is-disabled) {
    background: var(--el-color-danger);
    color: #fff;
}

/* ElTooltip 会在按钮外再包一层，间距得从包裹层上清掉 */
.window-controls :deep(.el-tooltip__trigger) {
    display: flex;
}
</style>
