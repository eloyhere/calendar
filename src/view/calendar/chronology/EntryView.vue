<script setup lang="ts">
/**
 * 年表·简介
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
        summary="朝代、年号与事件的逐年对照表。"
        epoch="历史资料只精确到年：start 取 1 月 1 日、end 取 12 月 31 日。"
        source="chronology.sqlite" />
</template>
