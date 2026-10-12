<script setup lang="ts">
/**
 * 智能体·课题研究
 *
 * 围绕指定课题检索资料并生成分析。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：课题模板与产出格式还没定。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="课题研究"
        placeholder="输入课题名称……" />
</template>
