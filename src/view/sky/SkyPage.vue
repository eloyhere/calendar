<script setup lang="ts">
/**
 * 天象页容器：`/sky/:page`。按 `:page` 直接选组件（理由见 `AstrologyPage.vue`）。
 */

import { computed } from "vue";

import { useRoute } from "../../plugin";
import SkyPlaneView from "./SkyPlaneView.vue";
import SkyProjectionView from "./SkyProjectionView.vue";

const route = useRoute();

const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

const PAGES = {
    plane: SkyPlaneView,
    projection: SkyProjectionView
} as const;

const component = computed(() => PAGES[current.value as keyof typeof PAGES]);
</script>

<template>
    <component :is="component" v-if="component !== undefined" />

    <ElResult
        v-else
        icon="warning"
        title="没有这一页"
        :sub-title="`「${current}」不在天象域里。可用的有：复平面、地表投影。`" />
</template>
