<script setup lang="ts">
/**
 * 性能·数据信息
 *
 * 22 个分库的表结构、行数与构建时间。
 *
 * 内容留白：分库清单现在是 OverviewView 里的常量表，尚未抽成数据源；
 * 抽出来以后本页直接复用同一份数据，无需重复维护。
 *
 * 本页用错误态占位：它读的是 22 个 .sqlite 的 _meta 表，
 * 任何一个文件缺失都要让用户看得见原因并能重试，
 * 这正是 ErrorState 存在的意义（页面上可以直接点「重试」看效果）。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell
        state="error"
        skeleton="table"
        source="src/sqlite/*.sqlite"
        error-text="读取 _meta 失败：22 个分库中尚有 6 个为空库（chronology / astronomy / gregory / jupiter / natural / tree / tropical），来源见 docs/design.md §3。" />
</template>
