<script setup lang="ts">
/**
 * 骨架屏块：页面在 `loading` 状态下的默认呈现。
 *
 * 用 `ElSkeleton` 而不是自己写几个灰条，是因为它自带三种动画
 * （`pulse` / `wave` / `none`），配合 `ElSkeletonItem` 的 `variant`
 * 就能拼出"一个卡片里若干行占位"的形状。
 *
 * ## 三种形状
 *
 * - `card`（默认）：标题 + 若干段落，用于简介类页面；
 * - `table`：多行四列，行间有分隔线，视觉上先立起一张表的骨架；
 * - `form`：两列短标签 + 输入框占位，用于排盘类页面将来的表单区。
 */

/** 骨架屏的呈现形状。 */
type SkeletonVariant = "card" | "table" | "form";

interface Props {
    /** 形状，见 `SkeletonVariant` */
    variant?: SkeletonVariant;
    /** `card` 形状下的段落行数 */
    rows?: number;
    /** `table` 形状下的数据行数 */
    lines?: number;
    /** 是否显示动画；`false` 时是静态灰块 */
    animated?: boolean;
    /** 动画方式 */
    animation?: "pulse" | "wave" | "none";
}

const props = withDefaults(defineProps<Props>(), {
    variant: "card",
    rows: 4,
    lines: 6,
    animated: true,
    animation: "pulse"
});

/** 每一行占位的宽度，避免等宽灰条看起来像条形码。 */
const LineWidths = ["100%", "94%", "88%", "96%", "82%", "91%", "86%", "99%"];

/** 第 `index` 行的宽度；循环取用上面的宽度表。 */
function widthOf(index: number): string {
    return LineWidths[index % LineWidths.length];
}
</script>

<template>
    <div class="page-skeleton" :class="`page-skeleton--${props.variant}`">
        <!-- 标题占位：三种形状共用 -->
        <ElSkeleton :animated="props.animated" :animation="props.animation">
            <template #template>
                <ElSkeletonItem variant="h3" style="width: 30%" />
            </template>
        </ElSkeleton>

        <!-- 表格形状：四列等宽行，先立起一张表的骨架 -->
        <div v-if="props.variant === 'table'" class="page-skeleton__table">
            <div v-for="line in props.lines" :key="line" class="page-skeleton__row">
                <ElSkeletonItem variant="text" style="width: 70%" />
                <ElSkeletonItem variant="text" style="width: 55%" />
                <ElSkeletonItem variant="text" style="width: 80%" />
                <ElSkeletonItem variant="text" style="width: 62%" />
            </div>
        </div>

        <!-- 表单形状：两列「标签 + 输入框」 -->
        <ElRow v-else-if="props.variant === 'form'" :gutter="16">
            <ElCol v-for="field in 6" :key="field" :span="8" class="page-skeleton__field">
                <ElSkeleton :animated="props.animated" :animation="props.animation">
                    <template #template>
                        <ElSkeletonItem variant="text" style="width: 40%; margin-bottom: 8px" />
                        <ElSkeletonItem variant="text" style="width: 100%; height: 32px" />
                    </template>
                </ElSkeleton>
            </ElCol>
        </ElRow>

        <!-- 卡片形状：标题 + 若干段落 -->
        <ElSkeleton
            v-else
            :animated="props.animated"
            :animation="props.animation"
            :rows="props.rows"
        >
            <template #template>
                <ElSkeletonItem
                    v-for="row in props.rows"
                    :key="row"
                    variant="text"
                    :style="{ width: widthOf(row) }"
                />
            </template>
        </ElSkeleton>
    </div>
</template>

<style scoped>
.page-skeleton {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.page-skeleton__table {
    display: flex;
    flex-direction: column;
}

.page-skeleton__row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1.2fr 1fr;
    gap: 24px;
    padding: 7px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.page-skeleton__field {
    margin-bottom: 20px;
}
</style>
