<script setup lang="ts">
/**
 * 节气表·数据
 *
 * 分库 climate.sqlite 有 9 张表（year / month 各配 parts、weeks、phenologies），
 * 本页按「年 / 月 / 分段 / 周 / 节气」分组展示，分组定义在 DataPage.vue。
 *
 * 现状：climate 表已装 1,743,926 行；climate_year / climate_month 待生成。
 */

import DataPage from "../parts/DataPage.vue";

</script>

<template>
    <DataPage
        state="loading"
        source="climate.sqlite" />
</template>
