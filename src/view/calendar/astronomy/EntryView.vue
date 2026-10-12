<script setup lang="ts">
/**
 * 天文历·简介
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
        summary="按天文历法的规则定建元，是其余历法的基准。"
        epoch="-2696-03-11 01:45:49（当天为第 1 日）"
        source="astronomy.sqlite" />
</template>
