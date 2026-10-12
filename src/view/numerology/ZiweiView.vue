<script setup lang="ts">
/**
 * 命理·紫微斗数
 *
 * 安十二宫与诸星，推演命盘。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：安星诀与十二宫盘面还没实现。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="form"
        source="ziwei"
        empty-text="安星诀与十二宫盘面还没实现。" />
</template>
