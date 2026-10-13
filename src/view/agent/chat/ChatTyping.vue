<script setup lang="ts">
/**
 * 正在输入：三个跳动的小点。
 *
 * 为什么值得单独一个组件：它是**唯一一处"没有内容但有信息"的状态**——消息流
 * 里空一块和"助手在想"是完全不同的两件事。做成组件后，将来加"正在检索资料"
 * 这类更具体的中间状态，只改这一个文件。
 *
 * 动画只用 CSS（`@keyframes`），不引 `ElSkeleton`：骨架屏表达的是"内容马上到、
 * 位置已占好"，这里是"还没有内容"，两者语气不同。
 */
</script>

<template>
    <div class="chat-typing">
        <span class="chat-typing__dots">
            <i class="chat-typing__dot" />
            <i class="chat-typing__dot" />
            <i class="chat-typing__dot" />
        </span>
        <span class="chat-typing__label">助手正在回复…</span>
    </div>
</template>

<style scoped>
.chat-typing {
    align-items: center;
    display: flex;
    gap: 10px;
    padding-left: 40px;
}

.chat-typing__dots {
    align-items: center;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    display: inline-flex;
    gap: 4px;
    height: 30px;
    padding: 0 12px;
}

.chat-typing__dot {
    animation: chat-typing-blink 1.2s infinite ease-in-out;
    background: var(--el-color-primary);
    border-radius: 50%;
    display: inline-block;
    height: 6px;
    width: 6px;
}

/* 三个点错开 0.2 秒，才看得出"依次跳"而不是"一起闪" */
.chat-typing__dot:nth-child(2) {
    animation-delay: 0.2s;
}

.chat-typing__dot:nth-child(3) {
    animation-delay: 0.4s;
}

.chat-typing__label {
    color: var(--el-text-color-placeholder);
    font-size: 12px;
}

@keyframes chat-typing-blink {
    0%,
    80%,
    100% {
        opacity: 0.25;
        transform: translateY(0);
    }

    40% {
        opacity: 1;
        transform: translateY(-3px);
    }
}
</style>
