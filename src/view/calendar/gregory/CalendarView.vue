<script setup lang="ts">
/**
 * 格里高丽历·日历
 *
 * 内容留白：月历网格、闰月标记、节气叠加都还没画。
 * 现在 state 固定为 loading，用来看骨架屏；接上 store 后换成
 * `usePageState(() => store.fetchMonths(year))` 提供的 state 即可。
 *
 * 数据来源：gregory.sqlite。分库已建、装数待做。
 */

import CalendarPage from "../parts/CalendarPage.vue";

</script>

<template>
    <CalendarPage
        :year="1"
        state="loading"
        source="gregory.sqlite" />
</template>
