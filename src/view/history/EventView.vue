<script setup lang="ts">
/**
 * 历史事件：`/history/event`。
 *
 * 事件表 2,379 行，挂在朔望年上（`absolute` 与 `chronology` 同轴）。
 * 用 `DomainTable` 是因为这一页的形状就是"一张真实表格 + 口径"——
 * 再写一份表格代码只会多一处要同步维护的列宽与对齐规则。
 */

import DomainTable from "../../component/domain/DomainTable.vue";
</script>

<template>
    <DomainTable
        module="event"
        table="event"
        title="历史事件"
        note="事件挂在朔望年上，时间是全库统一的 absolute 轴，所以点进任何一页看到的「某年」都是同一个年。人物表与它分开，用 person 表关联。"
        order='"start"' />
</template>
