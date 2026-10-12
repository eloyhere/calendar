<script setup lang="ts">
/**
 * 智能体·工作流
 *
 * 把多次对话编排成可复用的流程。
 *
 * 内容留白：节点画布（ElSplitter 左树右画布）、节点参数表单、运行记录都还没做。
 * 现在用 PageShell 的 form 骨架占位。
 */

import PageShell from "../../component/PageShell.vue";

</script>

<template>
    <PageShell state="loading" skeleton="form" source="工作流定义" />
</template>
