<script setup lang="ts">
/**
 * 年·回归年
 *
 * 太阳两次过春分点的时间长度。
 *
 * 内容留白：历年回归年长度表、与朔望年的偏差曲线都还没做。
 * 数据来源：tropical.sqlite（tropical_year / tropical_month，待装数）。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell state="loading" skeleton="table" source="tropical.sqlite" />
</template>
