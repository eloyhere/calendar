<script setup lang="ts">
/**
 * 智能体·深度研究
 *
 * 检索可信资料、深入分析课题并生成报告。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：资料检索与引用整理都还没做。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="深度研究"
        placeholder="输入要研究的课题……" />
</template>
