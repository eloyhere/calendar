<script setup lang="ts">
/**
 * 空态块：查询成功但库里没有数据。
 *
 * 与"加载中"、"出错"分开是必要的：`calendar` 库里有 11,906,768 行，
 * 但 `chronology` / `astronomy` 等几张表当前是**零行**（数据源缺失或换算法则
 * 未实现，见 `docs/design.md` §3）。零行不是错误，界面要说清"为什么没有"，
 * 而不是弹一个红色提示。
 *
 * 用 `ElEmpty` 撑起版面，另一个 `ElAlert` 承载原因说明——
 * 空态最常见的失败是"什么都不说"，用户分不清是没数据还是查询挂了。
 */

import { computed } from "vue";

interface Props {
    /** 主标题 */
    title?: string;
    /** 说明文字：为什么这里是空的 */
    description?: string;
    /** 原因提示的级别；用 `info` 表示"这是预期内的空" */
    tipType?: "info" | "warning";
    /** 操作按钮文案；不传则不渲染按钮 */
    actionText?: string;
    /** 数据源名称，会拼进默认说明里 */
    source?: string;
}

const props = withDefaults(defineProps<Props>(), {
    title: "暂无数据",
    description: "",
    tipType: "info",
    actionText: "",
    source: ""
});

const emit = defineEmits<{
    /** 点击操作按钮 */
    action: [];
}>();

/** 说明文案：给了 `description` 就用它，否则按数据源拼一句兜底。 */
const explain = computed(() => {
    if (props.description) {
        return props.description;
    }
    return props.source
        ? `${props.source} 里还没有可展示的记录。`
        : "该实体对应的表当前为空，或数据尚未初始化。";
});
</script>

<template>
    <ElEmpty :description="props.title">
        <ElAlert
            :type="props.tipType"
            :closable="false"
            show-icon
            :title="explain"
            class="empty-state__alert"
        />
        <ElButton v-if="props.actionText" type="primary" plain @click="emit('action')">
            {{ props.actionText }}
        </ElButton>
    </ElEmpty>
</template>

<style scoped>
.empty-state__alert {
    align-items: flex-start;
    margin-bottom: 16px;
    text-align: left;
    width: 100%;
}
</style>
