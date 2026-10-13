<script setup lang="ts">
/**
 * 设置（`/system/setting`）：快捷键表、界面偏好、环境自检。
 *
 * ## 三块，各自的依据
 *
 * | 块       | 内容                     | 依据                                                    |
 * | -------- | ------------------------ | ------------------------------------------------------- |
 * | 快捷键   | 全部键盘约定             | §2.2 第 8 条（沿用桌面惯例）+ HAX **G7/G8**（唤起/关闭） |
 * | 界面     | 侧栏折叠、密度           | §5.3                                                    |
 * | 环境自检 | dsh-os 与实验能力         | §6.7 / §7.5（授权面）                                    |
 *
 * ## 为什么快捷键要有一张完整的表
 *
 * WCAG **3.2.6 Consistent Help** 要求帮助机制在所有页面出现在**相同的位置顺序**；
 * 而"用户能查到有哪些快捷键"是这条要求的前提——快捷键本身是"效率加速器"
 * （§2.2 第 8 条、启发式 #7），不是必须记住的东西。
 *
 * 这张表**不许手写**：它必须与实际绑定的键一致。所以每一项都在下面的
 * `Shortcuts` 常量里，而 `AppShell` 的实现与它逐条对应——不一致就是 bug。
 */

import { computed, onMounted, ref } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { useShellStore } from "../../store/shell.store";

const shell = useShellStore();

/* -------------------------------------------------------------------------- */
/* 快捷键                                                                      */
/* -------------------------------------------------------------------------- */

interface Shortcut {
    keys: string;
    action: string;
    where: string;
}

/**
 * 全部快捷键。
 *
 * `docs/ui-architecture.md` §13 第 7 条说"落地时做一张表放进 `/system/setting`，
 * 并检查不与 Electron 默认菜单冲突"——这就是那张表。
 * 冲突检查的结论写在最后一列的"范围"里。
 */
const Shortcuts: readonly Shortcut[] = [
    { keys: "Ctrl / ⌘ + K", action: "打开搜索与跳转（命令面板）", where: "全应用" },
    { keys: "Ctrl / ⌘ + /", action: "打开助手", where: "全应用" },
    { keys: "Ctrl / ⌘ + B", action: "折叠 / 展开侧栏", where: "全应用" },
    { keys: "Esc", action: "关闭覆盖物；消息流里停止生成", where: "全应用 / 输入区" },
    { keys: "↑ / ↓", action: "在命令面板里移动选中", where: "命令面板" },
    { keys: "Enter", action: "跳到命令面板里选中的页面", where: "命令面板" },
    { keys: "Enter", action: "发送消息（可在输入区切成 Ctrl+Enter 发送）", where: "对话输入区" },
    { keys: "Shift + Enter", action: "换行", where: "对话输入区" },
    { keys: "Enter / 失焦", action: "提交年份输入", where: "历法 · 日历" }
];

/** Electron 默认菜单里与本应用冲突的项。 */
const Conflicts: readonly { keys: string; note: string }[] = [
    { keys: "Ctrl + R", note: "重新加载页面（Electron 默认，开发期保留）" },
    { keys: "Ctrl + Shift + I / F12", note: "开发者工具（electron-toolkit 的 optimizer 只在开发期开）" },
    { keys: "Ctrl + W", note: "关闭窗口（Electron 默认）" }
];

/* -------------------------------------------------------------------------- */
/* 环境自检                                                                    */
/* -------------------------------------------------------------------------- */

const busy = ref(false);
const engine = ref<{ ok: boolean; text: string } | null>(null);

/** 跑一次 `selfcheck`，把结果收成一句话。 */
const checkEngine = async (): Promise<void> => {
    busy.value = true;
    const result = await window.desktop.os.invoke({ verb: "selfcheck" });
    busy.value = false;

    if (result.ok) {
        const payload = result.envelope?.result as
            | { verbCount?: number; powershell?: string; script?: string }
            | undefined;
        engine.value = {
            ok: true,
            text: `命令层就绪：${payload?.verbCount ?? "?"} 个动词，${payload?.powershell ?? "?"}，入口 ${payload?.script ?? "?"}`
        };
        return;
    }

    engine.value = {
        ok: false,
        text:
            result.envelope?.error?.message ??
            result.note ??
            "命令层没跑通。先执行 node scripts/operation/build.mjs 生成入口与动词清单。"
    };
};

onMounted(checkEngine);

/* -------------------------------------------------------------------------- */
/* 界面偏好                                                                    */
/* -------------------------------------------------------------------------- */

/** 侧栏状态。 */
const sidebarText = computed(() => (shell.collapsed ? "已折叠（48px）" : "已展开（220px）"));

/** 助手状态。 */
const assistantText = computed(() => (shell.assistantOpen ? "打开" : "关闭"));
</script>

<template>
    <div class="setting">
        <!-- 快捷键：完整一张表 -->
        <div class="xy-panel setting__panel">
            <h2 class="xy-panel-title">快捷键</h2>

            <ElTable :data="Shortcuts as unknown as Record<string, string>[]" stripe size="small">
                <ElTableColumn label="按键" width="200">
                    <template #default="{ row }">
                        <span class="numeral setting__keys">{{ row.keys }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn prop="action" label="动作" min-width="240" />
                <ElTableColumn prop="where" label="范围" width="180" class="xy-dim" />
            </ElTable>

            <p class="xy-note">
                <code>Ctrl + Enter</code> / <code>Shift + Enter</code> / <code>Esc</code>
                是桌面聊天的通行惯例（Jakob 定律：用户带着别处的预期过来），
                所以输入区沿用它而不是自创。
            </p>
        </div>

        <!-- 与 Electron 默认的冲突 -->
        <div class="xy-panel setting__panel">
            <h2 class="xy-panel-title">与 Electron 默认菜单的关系</h2>

            <ElTable :data="Conflicts as unknown as Record<string, string>[]" stripe size="small">
                <ElTableColumn label="按键" width="200">
                    <template #default="{ row }">
                        <span class="numeral setting__keys">{{ row.keys }}</span>
                    </template>
                </ElTableColumn>
                <ElTableColumn prop="note" label="说明" min-width="320" />
            </ElTable>

            <p class="xy-note">
                本应用**不覆写** Electron 的默认菜单——那些是用户对桌面应用的既有预期。
                上表里的三条都不与本应用的绑定重叠：本应用用的是
                <code>Ctrl + K</code>、<code>Ctrl + /</code>、<code>Ctrl + B</code>。
            </p>
        </div>

        <!-- 界面状态 -->
        <div class="xy-panel setting__panel">
            <h2 class="xy-panel-title">界面</h2>
            <ElDescriptions :column="1" border size="small">
                <ElDescriptionsItem label="侧栏">
                    {{ sidebarText }}
                    <ElButton text size="small" @click="shell.toggleSidebar()">切换</ElButton>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="助手抽屉">
                    {{ assistantText }}
                    <ElButton text size="small" @click="shell.toggleAssistant()">切换</ElButton>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="当前视点">{{ shell.pointText }}</ElDescriptionsItem>
            </ElDescriptions>
        </div>

        <!-- 环境自检 -->
        <div class="xy-panel setting__panel">
            <h2 class="xy-panel-title">环境</h2>

            <ElAlert
                v-if="engine !== null"
                :type="engine.ok ? 'success' : 'warning'"
                :closable="false"
                show-icon
                :title="engine.ok ? '命令层可用' : '命令层不可用'"
                :description="engine.text" />

            <div class="setting__actions">
                <ElButton :loading="busy" @click="checkEngine">
                    <AppIcon name="Refresh" />
                    <span>重新自检</span>
                </ElButton>
            </div>

            <ElDescriptions :column="1" border size="small" class="setting__env">
                <ElDescriptionsItem label="分库目录">
                    <span class="numeral">src/sqlite/</span>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="命令层入口">
                    <span class="numeral">scripts/operation/</span>
                    <span class="xy-dim">
                        （动词清单由 <code>node scripts/operation/build.mjs</code> 从源码生成）
                    </span>
                </ElDescriptionsItem>
                <ElDescriptionsItem label="授权与审计">
                    <RouterLink to="/system/permission">权限与审计</RouterLink>
                </ElDescriptionsItem>
            </ElDescriptions>

            <p class="xy-note">
                这一页只报环境**能不能用**，不改环境。要装/重建命令层入口与动词清单，
                在项目根跑 <code>node scripts/operation/build.mjs</code>。
            </p>
        </div>
    </div>
</template>

<style scoped>
.setting__panel {
    margin-bottom: 16px;
}

.setting__keys {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    display: inline-block;
    font-size: 12px;
    padding: 1px 6px;
}

.setting__actions {
    margin-top: 14px;
}

.setting__env {
    margin-top: 14px;
}
</style>
