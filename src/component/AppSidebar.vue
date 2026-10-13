<script setup lang="ts">
/**
 * 侧栏：分区 + 递归菜单 + 折叠 + 底部助手按钮。
 *
 * ## 为什么是侧栏而不是横向页头菜单
 *
 * `docs/ui-architecture.md` §2.2 第 1 条的实测数据：179 名参与者、6 个网站的测试里，
 * 桌面端隐藏式菜单的使用率 **27%**，可见导航 **48%**；原文明确"在桌面上隐藏导航
 * 对体验与可发现性的损害比手机上更大"。桌面应用的主导航必须常驻可见。
 *
 * 另一条理由更直接：新表有 9 项一级导航、26 项菜单条目。旧版的横向菜单用
 * `ellipsis: false`，窗口一窄就把菜单尾巴裁掉——不是"显示不全"，是**点不到**。
 *
 * ## 三段分区
 *
 * 「工作区」「数据与工具」「系统」。分区来自 `meta.domain`，在域一级写一次。
 * 分区的意义是 chunking（把 9 项分成三组扫描），**不是**为了限制项数——
 * §2.2 第 5 条已写明 Miller 的 7±2 常被误用，"长菜单是可以的"。
 *
 * ## 折叠
 *
 * `Ctrl+B`，折叠后 48px 只留图标。折叠状态在 `shell.store.ts` 里，换页不丢。
 * 折叠时**分区标题也隐藏**：`ElMenu` 的 `collapse` 只处理菜单项，
 * 多出来的说明文字要自己收（`.is-collapsed` 分支）。
 *
 * ## 底部为什么有助手
 *
 * WCAG **3.2.6 Consistent Help** 要求重复出现的帮助机制出现在**相对于其他页面
 * 内容相同的位置顺序**。助手是本应用的"帮助"，所以它固定钉在侧栏底部——
 * 在任何页面、任何状态下都在同一个位置。
 */

import { computed } from "vue";

import type { MenuNode } from "../plugin";
import { createMenuSections, useRouter } from "../plugin";
import { useShellStore } from "../store/shell.store";
import AppBrandIcon from "./AppBrandIcon.vue";
import AppMenuTree from "./AppMenuTree.vue";

interface Props {
    /** 是否折叠（只留图标） */
    collapsed: boolean;
    /** 当前高亮的路径 */
    activePath: string;
}

const props = withDefaults(defineProps<Props>(), {});

const router = useRouter();
const shell = useShellStore();

/**
 * 菜单分区在模块级算一次。
 *
 * `plugin/menu.ts` 的 `resolveItem` 在找不到对应路由时会**抛错**
 * （防止菜单悄悄少一项），所以这里让它尽早执行——启动时炸比点进去发现缺项好。
 */
const sections = createMenuSections();

/** 全部节点的分区归属，命令面板与高亮都用得上。 */
const allNodes = computed<MenuNode[]>(() => sections.flatMap((section) => section.nodes));

/**
 * 高亮用的 index。
 *
 * **不能取 `route.matched[0].path`**——外壳挂在 `/` 上，那个值永远是 `/`，
 * 高亮会整片失效（`plugin/README.md` 记过这个坑）。取 `route.path` 就好，
 * 但参数化路由要额外处理：`/calendar/gregory/calendar` 在菜单里没有对应项
 * （菜单只列体系的简介页），此时高亮落到「历法」这一组的**父项**上。
 */
const activeIndex = computed(() => {
    const path = props.activePath;

    // 精确命中：菜单里有这一项
    const exact = (function walk(nodes: readonly MenuNode[]): string | null {
        for (const node of nodes) {
            if (node.path === path) {
                return path;
            }
            const found = walk(node.children);
            if (found !== null) {
                return found;
            }
        }
        return null;
    })(allNodes.value);

    if (exact !== null) {
        return exact;
    }

    /*
     * 没精确命中时按**最长前缀**回退。
     *
     * `/calendar/gregory/calendar` → `/calendar/gregory/entry`（格里高利历这一项），
     * 因为菜单里 gregory 只列了 entry。比"回退到 /calendar"更准：
     * 用户在看格里高利历，高亮就该落在格里高利历上，而不是笼统的"历法"。
     */
    const candidates = allNodes.value.flatMap(function collect(
        node: MenuNode
    ): { path: string; title: string }[] {
        return [
            ...(node.path === null ? [] : [{ path: node.path, title: node.title }]),
            ...node.children.flatMap(collect)
        ];
    });

    let best: string | null = null;
    let bestLength = 0;
    for (const candidate of candidates) {
        // 只比到倒数第二段：`/calendar/gregory` 是 `/calendar/gregory/calendar` 的前缀。
        const prefix = candidate.path.split("/").slice(0, -1).join("/");
        if (prefix.length > bestLength && path.startsWith(`${prefix}/`)) {
            best = candidate.path;
            bestLength = prefix.length;
        }
    }

    return best;
});

const go = (path: string): void => {
    if (path.length > 0) {
        void router.push(path);
    }
};
</script>

<template>
    <nav class="app-sidebar" :class="{ 'is-collapsed': props.collapsed }">
        <!-- 品牌区。折叠后只剩图标；它是拖拽区（见 AppHeader 的说明） -->
        <div class="app-sidebar__brand">
            <AppBrandIcon :size="22" />
            <span v-if="!props.collapsed" class="app-sidebar__brand-text">轩辕历法</span>
        </div>

        <ElScrollbar class="app-sidebar__scroll">
            <ElMenu
                :default-active="activeIndex ?? ''"
                mode="vertical"
                :collapse="props.collapsed"
                :collapse-transition="false"
                class="app-sidebar__menu"
                @select="go">
                <template v-for="section in sections" :key="section.title">
                    <div v-if="!props.collapsed" class="app-sidebar__section">{{ section.title }}</div>
                    <div v-else class="app-sidebar__section-rule" />

                    <AppMenuTree :items="section.nodes" @select="go" />
                </template>
            </ElMenu>
        </ElScrollbar>

        <div class="app-sidebar__foot">
            <ElTooltip content="助手（Ctrl+/）" placement="right" :disabled="!props.collapsed">
                <ElButton
                    class="app-sidebar__assistant"
                    :class="{ 'is-icon-only': props.collapsed }"
                    text
                    @click="shell.openAssistant()">
                    <AppIcon name="MagicStick" />
                    <span v-if="!props.collapsed" class="app-sidebar__assistant-text">
                        助手
                    </span>
                </ElButton>
            </ElTooltip>
        </div>
    </nav>
</template>

<style scoped>
.app-sidebar {
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    /* 折叠后 48px：`ElMenu` 的 collapse 宽度就是这个数 */
    width: 220px;
    transition: width 0.16s ease;
}

.app-sidebar.is-collapsed {
    width: 48px;
}

/*
 * 品牌区 48px 高，与顶栏同高——这样窗口按钮、品牌、菜单在一条水平线上，
 * 侧栏与顶栏看起来是一体的（`docs/ui-architecture.md` §5.1 的示意）。
 */
.app-sidebar__brand {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    height: 48px;
    justify-content: center;
    overflow: hidden;
    padding: 0 10px;
    white-space: nowrap;
}

.app-sidebar__brand-text {
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.app-sidebar__scroll {
    flex: 1;
    min-height: 0;
}

/* `ElMenu` 自带 1px 右边框与自己的宽度，这里让它铺满侧栏 */
.app-sidebar__menu {
    --el-menu-item-height: 40px;
    --el-menu-sub-item-height: 36px;
    border-right: none;
    width: 100%;
}

/*
 * 分区标题：不可点、不参与高亮。字号比菜单项小一档、颜色更弱，
 * 让它读起来像"标签"而不是"又一项"。
 */
.app-sidebar__section {
    color: var(--el-text-color-placeholder);
    font-size: 12px;
    letter-spacing: 0.06em;
    padding: 14px 16px 6px;
    user-select: none;
}

/* 折叠态用一条短横线代替标题：仍能看出分组边界，但不占宽度 */
.app-sidebar__section-rule {
    border-top: 1px solid var(--el-border-color-lighter);
    margin: 8px 10px 4px;
}

.app-sidebar__foot {
    border-top: 1px solid var(--el-border-color-lighter);
    flex-shrink: 0;
    padding: 8px;
}

.app-sidebar__assistant {
    align-items: center;
    display: flex;
    gap: 6px;
    justify-content: center;
    width: 100%;
}

.app-sidebar__assistant.is-icon-only {
    padding: 8px 0;
}
</style>
