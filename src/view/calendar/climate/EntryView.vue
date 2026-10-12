<script setup lang="ts">
/**
 * 节气表·简介
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
        summary="节气与物候的时刻表，是朔望月与回归年之间的桥。"
        epoch="分主节气 / 主中气 / 副节中气三类，kind = 1 / 2 / 3。"
        source="climate.sqlite" />
</template>
