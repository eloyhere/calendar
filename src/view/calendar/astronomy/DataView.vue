<script setup lang="ts">
/**
 * 天文历·数据
 *
 * 分库 astronomy.sqlite 有 9 张表（year / month 各配 parts、weeks、phenologies），
 * 本页按「年 / 月 / 分段 / 周 / 节气」分组展示，分组定义在 DataPage.vue。
 *
 * 现状：换算法则待实现，astronomy_year / astronomy_month 目前都是空表。
 */

import DataPage from "../parts/DataPage.vue";

</script>

<template>
    <DataPage
        state="loading"
        source="astronomy.sqlite" />
</template>
