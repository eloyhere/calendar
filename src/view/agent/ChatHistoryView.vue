<script setup lang="ts">
/**
 * 智能体·历史对话
 *
 * 历史会话的检索与续聊入口。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：会话持久化落在仓库的哪一层还没定。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="历史对话"
        placeholder="搜索历史会话……" />
</template>
