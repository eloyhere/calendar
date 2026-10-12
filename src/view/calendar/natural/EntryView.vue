<script setup lang="ts">
/**
 * 轩辕历·简介
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
        summary="传统纪年的上溯口径，黄帝元年与项目建元相衔接。"
        epoch="黄帝元年 = -2697，衔接建元 -2696-03-11。"
        source="natural.sqlite" />
</template>
