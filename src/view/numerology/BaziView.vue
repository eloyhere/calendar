<script setup lang="ts">
/**
 * 命理·八字排盘
 *
 * 以出生时刻排出四柱与大运。
 *
 * 内容留白：排盘结果表与盘面都还没做，现在把状态机的三种出口摆出来。
 * 出生时刻是所有排盘页面的共同输入，将来会提到 NumerologyView 的域级区域，
 * 页面本身不重复放一份。
 *
 * 现状：排盘规则（真太阳时校正、节气分月、大运起运）还没实现。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="empty"
        skeleton="form"
        source="bazi"
        empty-text="排盘规则（真太阳时校正、节气分月、大运起运）还没实现。" />
</template>
