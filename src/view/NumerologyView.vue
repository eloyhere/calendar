<script setup lang="ts">
/**
 * 命理域出口；见 `src/component/DomainOutlet.vue` 的说明。
 *
 * 域级内容若要落地（命主信息栏——出生时刻是所有排盘页面的共同输入），
 * 改本文件的模板：把 `<DomainOutlet />` 包进 `ElContainer`，
 * 上方放一份共享的命主信息，下方留出口。
 */
import DomainOutlet from "../component/DomainOutlet.vue";
</script>

<template>
    <DomainOutlet />
</template>
