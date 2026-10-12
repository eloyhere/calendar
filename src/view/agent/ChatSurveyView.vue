<script setup lang="ts">
/**
 * 智能体·数据调研
 *
 * 查找相关数据、建立统计模型并输出分析结果。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：本项目的 11,906,768 行历表是天然的调研对象，尚未接线。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="数据调研"
        placeholder="描述要调研的数据口径……" />
</template>
