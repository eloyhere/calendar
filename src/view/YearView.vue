<script setup lang="ts">
/**
 * 年域出口；见 `src/component/DomainOutlet.vue` 的说明。
 *
 * 「年」目前只有回归年一条路由。与历法域的区别在于视角：历法域按"历法体系"
 * 组织（天文历、木星历……），年域按"年的定义"组织（回归年、恒星年……），
 * 同一个量在不同历法下的取值将来可以在这里横向对照。
 */
import DomainOutlet from "../component/DomainOutlet.vue";
</script>

<template>
    <DomainOutlet />
</template>
