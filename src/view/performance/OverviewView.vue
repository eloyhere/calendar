<script setup lang="ts">
/**
 * 性能·概览
 *
 * 查询耗时、缓存命中与内存占用。
 *
 * 内容留白：还没有埋点，指标从哪来尚未定。先把看板的形状定下来——
 * 四个统计卡 + 耗时曲线 + 慢查询列表。
 *
 * 这是少数应当以「数据未就绪」示人的页面：指标为空本身就是结论，
 * 给骨架屏反而会被误读成「正在加载」。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="card"
        source="性能埋点"
        empty-text="还没有任何埋点数据：查询计时、缓存命中率、内存快照都要先接上，指标为空本身就是当前状态。" />
</template>
