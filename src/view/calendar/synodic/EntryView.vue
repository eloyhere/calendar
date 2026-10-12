<script setup lang="ts">
/**
 * 朔望历·简介
 *
 * 内容留白：本页要讲清「这个历法是什么、怎么定建元、怎么换算」。
 * 规则在 docs/design.md 里，未落地前 EntryPage 渲染空态，不摆假数据。
 *
 * 要填充时：给 <EntryPage> 传 facts（参数表），布局不用改。
 */

import EntryPage from "../parts/EntryPage.vue";

</script>

<template>
    <EntryPage
        summary="以朔望月为基本单位，数据来自 calendar.xlsx 的 290,654 个朔望月。"
        epoch="建元当月 = 1，可为负；月名形如「闰二月大」。"
        source="synodic.sqlite" />
</template>
