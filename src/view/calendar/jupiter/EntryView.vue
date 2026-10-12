<script setup lang="ts">
/**
 * 木星历·简介
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
        summary="以木星视运动周期定年的历法。"
        epoch="年长取木星会合周期，建元与天文历对齐。"
        source="jupiter.sqlite" />
</template>
