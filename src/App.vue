<template>
    <!--
        只有一个挂载点。
        布局（横向页头 / 内容 / 页脚）在 src/component/AppShell.vue，
        菜单在 src/component/AppHeader.vue，
        菜单内容来自 src/plugin/router.ts 的路由表（经 src/plugin/menu.ts 推导）。
    -->
    <RouterView />
</template>

<script setup lang="ts">
/**
 * 应用根组件：只做一件事——把路由渲染出来。
 *
 * ## 为什么这里几乎没有内容
 *
 * 早先本文件同时承担三件事：布局容器、七十项手写菜单、路由出口。三者绑在
 * 一起的后果是"菜单与路由对不上"没人发现得了——改路由不会碰菜单，改菜单
 * 也看不出路由缺了哪条。重写前实测到的结果：菜单里 15 个条目没有 `index`
 * （点不动）、格里高丽历整段指向 astronomy、`/year/tropical` 重复两遍、
 * 而 `plugin/router.ts` 里那 5 条路由一条都点不到。
 *
 * 现在职责拆成三层，每一层都可以单独替换：
 *
 * | 关注点            | 落在哪                         |
 * | ----------------- | ------------------------------ |
 * | 有哪些页面 / 层级 | `src/plugin/router.ts`（路由表）|
 * | 菜单长什么样      | `src/plugin/menu.ts`（由路由推导）|
 * | 外壳与菜单的渲染  | `src/component/AppShell.vue` / `AppHeader.vue` |
 *
 * 新增一个页面因此只需要动路由表一处；菜单、面包屑、窗口标题会自动跟上。
 */
</script>
