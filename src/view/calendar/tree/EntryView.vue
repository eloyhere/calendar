<script setup lang="ts">
/**
 * 干支历·简介
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
        summary="以干支纪年月日，与朔望月、节气相互对照。"
        epoch="干支自建元日起循环。"
        source="tree.sqlite" />
</template>
