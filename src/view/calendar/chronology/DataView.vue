<script setup lang="ts">
/**
 * 年表·数据
 *
 * 分库 chronology.sqlite 有 9 张表（year / month 各配 parts、weeks、phenologies），
 * 本页按「年 / 月 / 分段 / 周 / 节气」分组展示，分组定义在 DataPage.vue。
 *
 * 现状：数据源缺失，chronology 表当前 0 行。
 */

import DataPage from "../parts/DataPage.vue";

</script>

<template>
    <DataPage
        state="loading"
        source="chronology.sqlite" />
</template>
