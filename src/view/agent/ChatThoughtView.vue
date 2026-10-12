<script setup lang="ts">
/**
 * 智能体·思维碰撞
 *
 * 助手向你提问，帮你梳理和拓展思考链路。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：提问策略与思考链路的可视化都还没做。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="思维碰撞"
        placeholder="抛出一个还没想清楚的问题……" />
</template>
