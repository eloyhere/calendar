<script setup lang="ts">
/**
 * 格里高丽历·简介
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
        summary="公历（proleptic 格里高利历）；全部历表的时间戳都以它表示。"
        epoch="儒略日 0 之前按 proleptic 规则回推，允许 0 年与负数年。"
        source="gregory.sqlite" />
</template>
