<script setup lang="ts">
/**
 * 错误态块：加载失败，附带原因与重试。
 *
 * 用 `ElResult` 的 `error` 图标占据版面，重试按钮直接触发 `retry` 事件，
 * 由 `PageShell` 接回去重新调 loader——错误态必须有一条"用户能自己走出来"的路，
 * 只显示一句红字是不够的。
 *
 * `errorText` 是 loader 抛出的原始信息（查询语句、SQLite 报错等），
 * 折叠在 `ElCollapse` 里：默认不吓人，排查时要看得到。
 */

interface Props {
    /** 标题 */
    title?: string;
    /** loader 抛出的原始信息 */
    errorText?: string;
    /** 重试按钮文案 */
    retryText?: string;
    /** 是否允许重试 */
    retryable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    title: "数据加载失败",
    errorText: "",
    retryText: "重试",
    retryable: true
});

const emit = defineEmits<{
    /** 用户点了重试 */
    retry: [];
}>();
</script>

<template>
    <ElResult icon="error" :title="props.title" sub-title="请检查数据源是否可用，或稍后重试。">
        <template v-if="props.errorText" #extra>
            <ElCollapse class="error-state__detail">
                <ElCollapseItem title="查看原始报错" name="detail">
                    <ElText class="error-state__text" type="info">{{ props.errorText }}</ElText>
                </ElCollapseItem>
            </ElCollapse>
        </template>

        <template #default>
            <ElSpace v-if="props.retryable">
                <ElButton type="primary" @click="emit('retry')">
                    <ElIcon><Refresh /></ElIcon>
                    <span>{{ props.retryText }}</span>
                </ElButton>
            </ElSpace>
        </template>
    </ElResult>
</template>

<style scoped>
.error-state__detail {
    margin-bottom: 16px;
    max-width: 560px;
    text-align: left;
}

.error-state__text {
    word-break: break-all;
    white-space: pre-wrap;
}
</style>
