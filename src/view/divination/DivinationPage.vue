<script setup lang="ts">
/**
 * 数术页容器：`/divination/:page`。按 `:page` 直接选组件（理由见 `AstrologyPage.vue`）。
 */

import { computed } from "vue";

import { useRoute } from "../../plugin";
import QimenView from "./QimenView.vue";
import LiurenView from "./LiurenView.vue";
import TaiyiView from "./TaiyiView.vue";
import MeihuaView from "./MeihuaView.vue";
import DayanView from "./DayanView.vue";
import LiuyaoView from "./LiuyaoView.vue";

const route = useRoute();

const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

const PAGES = {
    qimen: QimenView,
    liuren: LiurenView,
    taiyi: TaiyiView,
    meihua: MeihuaView,
    dayan: DayanView,
    liuyao: LiuyaoView
} as const;

const component = computed(() => PAGES[current.value as keyof typeof PAGES]);
</script>

<template>
    <component :is="component" v-if="component !== undefined" />

    <ElResult
        v-else
        icon="warning"
        title="没有这一页"
        :sub-title="`「${current}」不在数术域里。可用的有：奇门遁甲、大六壬、太乙神数、梅花易数、大衍筮法、六爻纳甲。`" />
</template>
