<script setup lang="ts">
/**
 * 菜单树递归渲染：一份代码伺候任意深度的菜单。
 *
 * ## 判据只有两个：有没有子节点、自己能不能跳
 *
 * `docs/ui-architecture.md` §5.3 的菜单里同时存在三种节点：
 *
 * | 形态       | 判据                     | 渲染成                                      |
 * | ---------- | ------------------------ | ------------------------------------------- |
 * | 叶子       | 无子节点                  | `<ElMenuItem>`                              |
 * | 纯分组     | 有子节点、`path === null` | `<ElSubMenu>`，标题只展开                   |
 * | 可跳的分组 | 有子节点、`path !== null` | `<ElSubMenu>`，标题**可点**（跳到自己的页） |
 *
 * 第三种是本项目的实际情况：「历法」有子项，但自己指向朔望历简介；
 * 「更多历法」有子项，自己指向天文历简介。`plugin/menu.ts` 用
 * "声明里有没有给 `params`"判断能不能跳，这里只按 `path` 是不是 `null` 分派。
 *
 * ## 为什么不用 `ElMenuItemGroup`
 *
 * 它不能嵌套、也不能点击，而「历法」既要有子项又要能点。所以用 `ElSubMenu`
 * 加一个标题点击处理。
 *
 * ## `index` 必须唯一
 *
 * 高亮（`default-active`）与展开状态都按 `index` 索引同一个 `<ElMenu>` 里的项，
 * 撞了就会出现"点一个高亮两个"。可跳节点用它的绝对路径，分组节点用
 * `group:<标题>`——路径里不会出现 `group:`，两者不会互相撞。
 *
 * ## 侧栏里必须纵向展开
 *
 * `ElMenu` 的 `mode="horizontal"` 会走下拉，`vertical` 才是侧栏要的。
 * 折叠态由父组件传 `collapse`，`ElMenu` 自己会把文字收进 tooltip。
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

/** 点分组标题：能跳就跳。 */
const pickGroup = (item: MenuNode): void => {
    if (item.path !== null) {
        emit("select", item.path);
    }
};
</script>

<template>
    <template v-for="item in props.items" :key="item.path ?? `group:${item.title}`">
        <!-- 有子项：先展开，标题自己能不能跳由 path 决定 -->
        <ElSubMenu v-if="item.children.length > 0" :index="`group:${item.title}`">
            <template #title>
                <span
                    class="app-menu-tree__head"
                    :class="{ 'is-jumpable': item.path !== null }"
                    :title="item.description ?? item.title"
                    @click="pickGroup(item)">
                    <AppIcon v-if="item.icon" :name="item.icon" />
                    <span class="app-menu-tree__label">{{ item.title }}</span>
                </span>
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
                <span class="app-menu-tree__label" :title="item.description ?? item.title">
                    {{ item.title }}
                </span>
            </template>
        </ElMenuItem>
    </template>
</template>

<style scoped>
.app-menu-tree__label {
    margin-left: 4px;
}

/*
 * 分组标题本身占满一行，可跳时给一个可点的观感（hover 变主色 + 指针）。
 * 不可跳的分组保持默认——`ElSubMenu` 的标题本来就能点（展开），
 * 再叠一个手型光标会让人以为点了会跳转。
 */
.app-menu-tree__head {
    align-items: center;
    display: inline-flex;
    min-width: 0;
}

.app-menu-tree__head.is-jumpable {
    cursor: pointer;
}

.app-menu-tree__head.is-jumpable:hover .app-menu-tree__label {
    color: var(--el-color-primary);
}
</style>
