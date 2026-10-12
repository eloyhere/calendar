<script setup lang="ts">
/**
 * 天文历·日历
 *
 * 内容留白：月历网格、闰月标记、节气叠加都还没画。
 * 现在 state 固定为 loading，用来看骨架屏；接上 store 后换成
 * `usePageState(() => store.fetchMonths(year))` 提供的 state 即可。
 *
 * 数据来源：astronomy.sqlite。换算法则待实现，astronomy_year / astronomy_month 目前都是空表。
 */

import CalendarPage from "../parts/CalendarPage.vue";

</script>

<template>
    <CalendarPage
        :year="1"
        state="loading"
        source="astronomy.sqlite" />
</template>
