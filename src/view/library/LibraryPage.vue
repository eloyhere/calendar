<script setup lang="ts">
/**
 * 文献页容器：`/library/:page`。按 `:page` 直接选组件（理由见 `AstrologyPage.vue`）。
 *
 * 四页共用一个组件（`LibraryListView`），差异只有"哪个时代、哪个地域"——
 * 把这两个维度当参数传给同一个列表，比写四个文件少三份拷贝。
 */

import { computed } from "vue";

import { useRoute } from "../../plugin";
import { LIBRARY_PAGES, libraryPageOf } from "../../entity/library";
import LibraryListView from "./LibraryListView.vue";

const route = useRoute();

const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

const page = computed(() => libraryPageOf(current.value));
</script>

<template>
    <LibraryListView v-if="page !== undefined" :page="page" />

    <ElResult
        v-else
        icon="warning"
        title="没有这一页"
        :sub-title="`「${current}」不在文献域里。可用的有：${LIBRARY_PAGES.map((item) => item.title).join('、')}。`" />
</template>
