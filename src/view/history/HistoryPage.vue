<script setup lang="ts">
/**
 * 历史页容器：`/history/:page`。按 `:page` 直接选组件（理由见 `AstrologyPage.vue`）。
 */

import { computed } from "vue";

import { useRoute } from "../../plugin";
import CycleView from "./CycleView.vue";
import DynastyView from "./DynastyView.vue";
import EventView from "./EventView.vue";

const route = useRoute();

const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

const PAGES = {
    cycle: CycleView,
    dynasty: DynastyView,
    event: EventView
} as const;

const component = computed(() => PAGES[current.value as keyof typeof PAGES]);
</script>

<template>
    <component :is="component" v-if="component !== undefined" />

    <ElResult
        v-else
        icon="warning"
        title="没有这一页"
        :sub-title="`「${current}」不在历史域里。可用的有：皇极经世、朝代与年号、历史事件。`" />
</template>
