<script setup lang="ts">
/**
 * 历法域出口；见 `src/component/DomainOutlet.vue` 的说明。
 *
 * 域级内容若要落地（历法切换器、统一的历表工具栏……），改本文件的模板，
 * 不要改 `DomainOutlet`——那会同时影响智能体、命理、年、性能四个域。
 */
import DomainOutlet from "../component/DomainOutlet.vue";
</script>

<template>
    <DomainOutlet />
</template>
