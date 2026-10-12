<script setup lang="ts">
/**
 * 朔望历·数据
 *
 * 分库 synodic.sqlite 有 9 张表（year / month 各配 parts、weeks、phenologies），
 * 本页按「年 / 月 / 分段 / 周 / 节气」分组展示，分组定义在 DataPage.vue。
 *
 * 现状：数据已装：synodic_calendar_year 23,500 行、synodic_month 290,654 行。
 */

import DataPage from "../parts/DataPage.vue";

</script>

<template>
    <DataPage
        state="loading"
        source="synodic.sqlite" />
</template>
