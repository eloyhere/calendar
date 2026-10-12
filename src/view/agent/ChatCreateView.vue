<script setup lang="ts">
/**
 * 智能体·新建对话
 *
 * 空会话入口：新建一条会话，然后与助手自由对话。
 *
 * 六个聊天模式共用 <ChatPage>：外框（会话栏 / 消息流 / 输入区）已经搭好，
 * 差异只在标题、输入框占位与提示语——这三样由本文件传进去，
 * 所以换模式不需要换页面结构。
 *
 * 现状：会话列表、消息流、输入框都还没接后端。
 */

import ChatPage from "./parts/ChatPage.vue";

</script>

<template>
    <ChatPage
        mode="新建对话"
        placeholder="说点什么，开始一个任务……" />
</template>
