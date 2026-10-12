import { resolve } from "path";
import { defineConfig } from "electron-vite";
import vue from "@vitejs/plugin-vue";

/**
 * 三段构建：主进程、preload 桥接脚本、渲染进程（前端）。
 *
 * 目录约定：
 * - `main/`      根目录，Electron 主进程：`index.ts` 生命周期与装配、
 *                `window.ts` 窗口、`ipc.ts` IPC 通道注册。
 * - `preload/`   根目录，preload 桥接脚本（contextBridge）+ 注入到 window 的类型声明。
 * - `src/`       纯前端，标准 Vue 项目结构，不出现任何 Electron 依赖。
 * - `out/`       构建产物，三段分开：`out/main`、`out/preload`、`out/renderer`。
 *
 * 为什么两个入口都要显式指定：electron-vite 默认只在 `src/main/index.ts`、
 * `src/preload/index.ts` 下找入口（见其 `findLibEntry`），本项目 Electron 侧
 * 代码都在根目录，靠默认值会直接报
 * "An entry point is required in the electron vite main config"。
 *
 * 产物目录没有互相覆盖的问题：`main` 与 `preload` 两个 scope 默认都写
 * `out/preload`，但这里各自显式指定 `out/main` 与 `out/preload`，因此
 * `main/window.ts` 里的 `../preload/index.js`、`../renderer/index.html`
 * 都是正常的一层相对路径，不需要任何绕行。
 */
export default defineConfig({
    main: {
        build: {
            lib: {
                entry: resolve(__dirname, "main/index.ts")
            },
            outDir: resolve(__dirname, "out/main")
        }
    },
    preload: {
        build: {
            lib: {
                entry: resolve(__dirname, "preload/index.ts")
            },
            outDir: resolve(__dirname, "out/preload")
        }
    },
    renderer: {
        // 前端入口就是项目根的 index.html（它引用 /src/main.ts）。
        root: __dirname,
        build: {
            rollupOptions: {
                // 同样不能靠默认值：electron-vite 只在 `src/renderer/index.html`
                // 找 renderer 入口（见其 `findInput`），本项目前端已搬到 `src/`，
                // 页面在项目根，不显式指定会报
                // "build.rollupOptions.input option is required in the electron vite renderer config"。
                input: resolve(__dirname, "index.html")
            }
        },
        resolve: {
            alias: {
                // 与 tsconfig.web.json 的 paths 保持一致。
                "@src": resolve(__dirname, "src")
            }
        },
        plugins: [vue()]
    }
});
