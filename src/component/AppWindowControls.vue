<script setup lang="ts">
/**
 * 窗口按钮：最小化 / 最大化（还原）/ 关闭。
 *
 * ## 用 ElButton，但把它的"按钮感"全部关掉
 *
 * 三颗按钮用 `ElButton`（`text` 变体）而不是裸 `<button>`：它们因此与全应用共享同一套
 * 状态管理——`:disabled`、`:focus-visible`、`--el-*` 取色，还有 Element Plus 自己的
 * 键盘可达性处理，不必在这里重写一遍。少写一份就会漂移。
 *
 * 但 Windows 的标题栏按钮不该长得像应用里的普通按钮：46×48 的方形热区、无边框无圆角、
 * 贴死在窗口右上角，关闭键 hover 变红。`ElButton` 默认的圆角、边框、内边距、hover
 * 底色与这套规格正好相反，所以下面用 `:deep()` 把这几项掰回来——**改的是外观，不是
 * 交互**，禁用态、焦点环与点击行为仍然是 ElButton 的。
 *
 * ## 图形自己画
 *
 * Element Plus 的图标里没有窗口按钮这一套：`FullScreen` 是四角括号、`ScaleToOriginal`
 * 是缩放箭头，语义都不对。三颗按钮挨在一起，笔画粗细差一点都很显眼，所以四个图形
 * 共用一套参数：10×10 的 viewBox、1px 描边、`currentColor`（跟着 hover / disabled
 * 的文字色走）。坐标刻意落在半像素上，100% 缩放下 1px 的线不发虚。
 *
 * ## 每一颗都要自己声明 `no-drag`
 *
 * 承载它的标题栏整条是可拖拽区（`-webkit-app-region` / `app-region`），而拖拽区是
 * 按元素盒子抠洞的——按钮不显式标 `no-drag`，点下去只会开始拖窗口。
 *
 * ## 最大化状态从哪来
 *
 * 事实来源在主进程：双击标题栏、Win+↑、系统右键菜单都会改它，页面无从预判。所以
 * 这里只订阅 `window.desktop.window.onStateChange`，不自己维护一份"点过了就翻转"
 * 的本地状态。主进程在页面加载完成时会主动推一次，因此不存在"先按未最大化画一遍、
 * 再跳成还原"的闪烁。
 */

import { computed, onUnmounted, ref } from "vue";

import type { WindowState } from "../../shared/window-api";

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
                text
                :disabled="!controllable"
                aria-label="最小化"
                @click="minimize">
                <svg class="window-controls__glyph" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M0 5.5h10" />
                </svg>
            </ElButton>
        </ElTooltip>

        <ElTooltip :content="maximizeLabel" placement="bottom" :show-after="400">
            <ElButton
                class="window-controls__button"
                text
                :disabled="!controllable"
                :aria-label="maximizeLabel"
                @click="toggleMaximize">
                <!-- 还原：前面一个方框，后面那个只露出上边、右边与一小段下边 -->
                <svg
                    v-if="restored"
                    class="window-controls__glyph"
                    viewBox="0 0 10 10"
                    aria-hidden="true">
                    <rect x="0.5" y="2.5" width="7" height="7" />
                    <path d="M2.5 2.5V0.5h7v7h-2" />
                </svg>
                <svg v-else class="window-controls__glyph" viewBox="0 0 10 10" aria-hidden="true">
                    <rect x="0.5" y="0.5" width="9" height="9" />
                </svg>
            </ElButton>
        </ElTooltip>

        <ElTooltip content="关闭" placement="bottom" :show-after="400">
            <ElButton
                class="window-controls__button window-controls__button--close"
                text
                :disabled="!controllable"
                aria-label="关闭"
                @click="close">
                <svg class="window-controls__glyph" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
                </svg>
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
    /*
     * 贴死在窗口右上角，两颗 margin 各管一头：
     * - `margin-left: auto` 把这一组推到最右（菜单铺满时它是 0，菜单哪天不铺满了也不会
     *   跑到中间去）；
     * - `margin-right: -14px` 抵消标题栏自身的右内边距，让关闭键真的顶到窗口边——
     *   这也是 Windows 标题栏按钮的位置。
     */
    margin-left: auto;
    margin-right: -14px;
}

/*
 * 三颗按钮：贴边、无圆角、46×48 的方形热区，而且三颗之间不留缝——hover 底色连成
 * 一片才是标题栏按钮该有的样子（圆角会让右上角看着缺一块）。
 *
 * 下面这一组属性基本都在"抵消 ElButton 的默认外观"：边框、圆角、内边距、默认底色、
 * 字重、过渡曲线全部来自 Element Plus 的 `.el-button`，这里逐条掰成标题栏规格。
 * `text` 变体已经关掉了大部分，剩下的是它保留的 hover 底色与正方形以外的尺寸。
 */
.window-controls__button {
    -webkit-app-region: no-drag;
    app-region: no-drag;
    align-items: center;
    border-radius: 0;
    color: var(--el-text-color-regular);
    cursor: default; /* 窗口按钮用箭头光标，不是手型 */
    display: inline-flex;
    font-weight: 400;
    height: 100%;
    justify-content: center;
    margin: 0;
    min-height: 0;
    padding: 0;
    transition:
        background-color 0.12s ease,
        color 0.12s ease;
    width: 46px;
}

/* Element Plus 给按钮加了相邻兄弟的 margin-left，标题栏里三颗必须紧贴 */
.window-controls__button + .window-controls__button {
    margin-left: 0;
}

/* 焦点环画在热区**里面**：outline 不占布局，但 offset 为正时会被标题栏裁掉 */
.window-controls :deep(.window-controls__button:focus-visible) {
    outline: 1px solid var(--el-color-primary);
    outline-offset: -3px;
}

.window-controls :deep(.window-controls__button:hover:not(.is-disabled)) {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
}

.window-controls :deep(.window-controls__button:active:not(.is-disabled)) {
    background: var(--el-fill-color-dark);
}

.window-controls :deep(.window-controls__button.is-disabled) {
    color: var(--el-text-color-disabled);
    cursor: default;
}

/* 关闭键 hover 变红：Windows 上的肌肉记忆，照做（这两颗红不在 --el-* 语义里） */
.window-controls :deep(.window-controls__button--close:hover:not(.is-disabled)) {
    background: #e81123;
    color: #fff;
}

.window-controls :deep(.window-controls__button--close:active:not(.is-disabled)) {
    background: #c50f1f;
}

/* 图形：10px 见方、1px 描边。尺寸写在 CSS 里，四个图形共用一条规则 */
.window-controls__glyph {
    fill: none;
    height: 10px;
    stroke: currentColor;
    stroke-width: 1;
    width: 10px;
}

/* ElButton 的内容包在一层 span 里，居中靠它 */
.window-controls :deep(.el-button > span) {
    align-items: center;
    display: inline-flex;
    height: 100%;
    justify-content: center;
    width: 100%;
}

/* ElTooltip 会在按钮外再包一层，间距得从包裹层上清掉 */
.window-controls :deep(.el-tooltip__trigger) {
    display: flex;
}
</style>
