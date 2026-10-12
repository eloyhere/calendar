<script setup lang="ts">
/**
 * 轩辕历·数据
 *
 * 分库 natural.sqlite 有 9 张表（year / month 各配 parts、weeks、phenologies），
 * 本页按「年 / 月 / 分段 / 周 / 节气」分组展示，分组定义在 DataPage.vue。
 *
 * 现状：分库已建、装数待做。
 */

import DataPage from "../parts/DataPage.vue";

</script>

<template>
    <DataPage
        state="loading"
        source="natural.sqlite" />
</template>
