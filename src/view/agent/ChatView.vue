<script setup lang="ts">
/**
 * 对话页的路由包装：`/agent/chat/:mode?`。
 *
 * ## 为什么需要这一层
 *
 * `view/agent/chat/ChatPage.vue` 需要一个 `channel` prop——它是**纯组件**，
 * 只认"我渲染哪个模式"，不知道路由长什么样。而路由表把组件直接挂在
 * `/agent/chat/:mode?` 上，`props` 一个都没传，于是 `channel` 是 `undefined`，
 * 页面**整个白屏**并抛 `Cannot read properties of undefined (reading 'description')`。
 *
 * 这一层薄包装就是那个缺失的转接：读 `:mode`、校验、把合法的 `ChatChannel`
 * 传下去。它同时是"非法 mode 给出口"这条规矩的落点——如果把它塞进 `ChatPage`，
 * 那个组件就要同时知道路由与业务，而它现在只做后者。
 *
 * ## 非法 mode 不重定向
 *
 * 与历法页同一个判断：`/agent/chat/foo` 渲染空态并列出合法值，
 * **不 redirect**。重定向会把拼错的地址掩盖掉。
 */

import { computed } from "vue";

import { useRoute, useRouter } from "../../plugin";
import { ChatChannels } from "../../entity/chat";
import type { ChatChannel } from "../../entity/chat";
import ChatPage from "./chat/ChatPage.vue";

const route = useRoute();
const router = useRouter();

/** 默认模式：新建对话。`/agent/chat` 落到它。 */
const DEFAULT_CHANNEL: ChatChannel = "create";

/** `:mode` 参数，缺省用默认模式。 */
const channel = computed<ChatChannel | null>(() => {
    const raw = route.params.mode;
    const value = String(Array.isArray(raw) ? raw[0] : raw);
    if (value.length === 0 || value === "undefined") {
        return DEFAULT_CHANNEL;
    }
    return value in ChatChannels ? (value as ChatChannel) : null;
});

/** 合法的模式列表，空态里列出来。 */
const channels = computed(() =>
    Object.entries(ChatChannels).map(([id, info]) => ({ id: id as ChatChannel, label: info.title }))
);
</script>

<template>
    <ChatPage v-if="channel !== null" :channel="channel" />

    <ElResult
        v-else
        icon="warning"
        title="没有这个对话模式"
        :sub-title="`地址里的「${String(route.params.mode)}」不在对话模式的登记表里。可用的有：${channels.map((item) => item.label).join('、')}。`">
        <template #extra>
            <ElButton
                v-for="item in channels"
                :key="item.id"
                :type="item.id === DEFAULT_CHANNEL ? 'primary' : 'default'"
                @click="router.push(`/agent/chat/${item.id}`)">
                {{ item.label }}
            </ElButton>
        </template>
    </ElResult>
</template>
