<script setup lang="ts">
/**
 * 命理·卦象分析
 *
 * 起卦、装卦与卦象解读。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：起卦方式与六十四卦表还没实现。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="form"
        source="gua"
        empty-text="起卦方式与六十四卦表还没实现。" />
</template>
