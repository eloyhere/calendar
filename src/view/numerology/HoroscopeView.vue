<script setup lang="ts">
/**
 * 命理·星盘
 *
 * 以天文坐标绘制星盘。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：星盘需要宫位与相位计算；天文历的换算法则（astronomy）同样待实现，两者共底。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="table"
        source="horoscope"
        empty-text="星盘需要宫位与相位计算；天文历的换算法则（astronomy）同样待实现，两者共底。" />
</template>
