<script setup lang="ts">
/**
 * 菜单树递归渲染：一份代码伺候任意深度的菜单。
 *
 * ## 为什么要递归，而不能按"固定几级"写
 *
 * 本项目菜单的**深浅本来就不一样**：
 *
 * ```
 * 概览                                    一级，直接跳转
 * 智能体 ▾
 *   ├─ 工作流                             二级
 *   └─ 对话 ▾
 *        ├─ 新建对话 …                    三级
 * 历法 ▾
 *   ├─ 天文历 ▾
 *   │    ├─ 简介 / 日历 / 数据            三级
 *   └─ 年表 ▾
 *        └─ 简介 / 数据                   三级
 * 命理 ▾ / 年 ▾ / 性能 ▾                  二级
 * ```
 *
 * 所以判据只能是 `children.length`：有子节点就是 `<ElSubMenu>`（只展开），
 * 没有就是 `<ElMenuItem>`（可跳转）。多深都不用改代码——新增一层菜单只需要在
 * `plugin/router.ts` 里多嵌一层 `children`。
 *
 * ## `index` 必须唯一
 *
 * 高亮（`default-active`）与展开状态都按 `index` 索引同一个 `<ElMenu>` 里的项，
 * 撞了就会出现"点一个高亮两个"。这里分组节点用 `group:<标题>`，
 * 叶子用它的绝对路径，两者不会互相撞。
 */

import type { MenuNode } from "../plugin";

interface Props {
    /** 这一层要渲染的节点 */
    items: readonly MenuNode[];
}

const props = withDefaults(defineProps<Props>(), {});

const emit = defineEmits<{
    /** 用户点了可跳转的菜单项 */
    select: [path: string];
}>();
</script>

<template>
    <template v-for="item in props.items" :key="item.path ?? `group:${item.title}`">
        <!-- 收纳层：只展开，继续递归下一层 -->
        <ElSubMenu v-if="item.children.length > 0" :index="`group:${item.title}`">
            <template #title>
                <AppIcon v-if="item.icon" :name="item.icon" />
                <span class="app-menu__label">{{ item.title }}</span>
            </template>

            <AppMenuTree :items="item.children" @select="emit('select', $event)" />
        </ElSubMenu>

        <!-- 叶子：可跳转的页面 -->
        <ElMenuItem
            v-else
            :index="item.path ?? `group:${item.title}`"
            @click="emit('select', item.path ?? '')">
            <AppIcon v-if="item.icon" :name="item.icon" />
            <template #title>
                <span class="app-menu__label">{{ item.title }}</span>
            </template>
        </ElMenuItem>
    </template>
</template>

<style scoped>
.app-menu__label {
    margin-left: 4px;
}
</style>
