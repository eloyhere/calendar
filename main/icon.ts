import { app, nativeImage } from "electron";
import type { NativeImage } from "electron";
import iconPng from "../resources/icon.png?asset";

/**
 * 运行期应用图标。
 *
 * 图形来源是 `resources/icon.svg`；`resources/icon.png` 由 `npm run icons`
 * （`scripts/build-icons.cjs`）从它生成，两者一起改，不要单独编辑 PNG。
 *
 * 之所以运行期用 PNG 而不是直接读 SVG：Electron 的 `nativeImage` 不认 SVG
 * （`createFromDataURL` 传 SVG 数据 URL 会返回空图），各平台窗口图标的接口要的
 * 都是位图。SVG 仍然保留在仓库里作为唯一图形来源，也是标题栏里画的那一份。
 */

let cached: NativeImage | null = null;

/** 取窗口图标（`nativeImage`）。同一进程内只解码一次。 */
export const appIcon = (): NativeImage => {
    if (!cached) {
        cached = nativeImage.createFromPath(iconPng);
    }
    return cached;
};

/**
 * 设置应用级图标。
 *
 * - macOS：dock 图标，必须在 `app.whenReady()` 之后调用；
 * - Windows / Linux：作为新建窗口的默认图标（任务栏与 Alt+Tab 用它）。
 *
 * 打包后 Windows 任务栏读的是 exe 里嵌的图标（electron-builder 从 `build/icon.ico`
 * 写入），这里的设置对开发期与 Linux 才有可见效果——两边都设上，是为了开发期
 * 看到的就是最终图标。
 */
export const applyAppIcon = (): void => {
    const icon = appIcon();
    if (icon.isEmpty()) {
        console.warn("[icon] resources/icon.png 读取失败，窗口图标将回退到 Electron 默认图标");
        return;
    }
    if (process.platform === "darwin") {
        app.dock?.setIcon(icon);
    }
};
