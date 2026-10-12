<script setup lang="ts">
/**
 * 聊天外壳出口。
 *
 * 六个聊天模式（新建对话 / 历史对话 / 深度研究 / 数据调研 / 思维碰撞 / 课题研究）
 * 共用 `view/agent/parts/ChatPage.vue` 那套三栏壳，本文件只负责把子路由渲染出来，
 * 所以它和其余五个域一样用 `DomainOutlet`。
 *
 * 路由表里这一层是 `/agent/chat`，`meta.menu` 为 `false`：侧栏里直接看到的是
 * 六个模式，不会多出一层"对话"分组。它的存在是为了让六个模式的路径有共同前缀
 * （`/agent/chat/*`），将来要把"会话列表"提到这一层做共享侧栏时，
 * 改本文件即可，六个模式页不用动。
 */
import DomainOutlet from "../../component/DomainOutlet.vue";
</script>

<template>
    <DomainOutlet />
</template>
