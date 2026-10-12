<script setup lang="ts">
/**
 * 名字图标：把 `IconName` 字符串渲染成 `<ElIcon>` 里的组件。
 *
 * 为什么需要这一层：Element Plus 的 293 个图标由 `plugins/icons.ts` 全局注册，
 * 但**全局注册只存在于运行时**。路由 `meta.icon` 里存的是字符串（因为它要能
 * 参与菜单排序、序列化、写进 `RouteName` 旁边的配置），模板里需要把字符串变成
 * 组件——`<component :is="'Search'" />` 在 vue-tsc 眼里是"用一个任意字符串当
 * 组件"，只有运行时才知道对不对。
 *
 * 本组件把这件事收口到一处：白名单外的名字解析成 `null`，渲染成空而不是让
 * Vue 抛 "Failed to resolve component"。名字的正确性由
 * `findRouteIssues()` 在开发期就用启动失败的方式拦住。
 */

import { computed } from "vue";
import type { Component } from "vue";
import { resolveIconComponent } from "../plugin/dependencies";

interface Props {
    /** 图标名，应为 `src/plugin/icons.ts` 白名单里的名字 */
    name?: string | null;
}

const props = withDefaults(defineProps<Props>(), { name: null });

/** 解析出来的组件；不在白名单 / 依赖里没有则为 `null`。 */
const icon = computed<Component | null>(() =>
    props.name ? resolveIconComponent(props.name) : null
);
</script>

<template>
    <ElIcon v-if="icon">
        <component :is="icon" />
    </ElIcon>
</template>
