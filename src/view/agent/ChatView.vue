<script setup lang="ts">
/**
 * 聊天外壳出口。
 *
 * 五个聊天模式（新建对话 / 深度研究 / 数据调研 / 思维碰撞 / 课题研究）
 * 共用 `view/agent/chat/ChatPage.vue` 那套三栏壳，本文件只负责把子路由渲染出来，
 * 所以它和其余五个域一样用 `DomainOutlet`。
 *
 * 路由表里这一层是 `/agent/chat`，`meta.menu` 为 `false`：侧栏里直接看到的是
 * 五个模式，不会多出一层"对话"分组。它的存在是为了让五个模式的路径有共同前缀
 * （`/agent/chat/*`）。
 *
 * ## 为什么这一层没有自己的界面
 *
 * 会话状态已经提到 store（`src/store/chat.store.ts`）里，所以五个模式**不需要**
 * 共享一层侧栏——每个模式页各自渲染自己的会话列表，互不串场。这一层因此保持
 * 纯透传；哪天要做一个跨模式的"全部会话"侧栏，再改本文件的模板。
 */
import DomainOutlet from "../../component/DomainOutlet.vue";
</script>

<template>
    <DomainOutlet />
</template>
