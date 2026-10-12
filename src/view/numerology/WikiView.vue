<script setup lang="ts">
/**
 * 命理·命理百科
 *
 * 术语、流派与推演方法的总览。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：术语表还没整理；先把八字、紫微、七政四余、卦象、星盘各自的口径写清，再汇到本页。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="card"
        source="命理术语表"
        empty-text="术语表还没整理；先把八字、紫微、七政四余、卦象、星盘各自的口径写清，再汇到本页。" />
</template>
