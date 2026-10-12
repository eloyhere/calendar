<script setup lang="ts">
/**
 * 命理·七政四余
 *
 * 日月五星与四余的躔度。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：七政四余需要行度数据：perform / encounter 两张表已装数，尚未接进页面。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="table"
        source="seven-luminary"
        empty-text="七政四余需要行度数据：perform / encounter 两张表已装数，尚未接进页面。" />
</template>
