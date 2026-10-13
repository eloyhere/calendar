<script setup lang="ts">
/**
 * 命理页容器：`/astrology/:page`。
 *
 * ## 为什么直接 switch，而不是嵌套 `<RouterView/>`
 *
 * 早先这里写成"域出口 + 子路由"的形状（`<RouterView/>` 透传），但路由表里
 * `/astrology/:page` 下**没有子路由**——于是 `<RouterView/>` 渲染出空，
 * 四张盘的路径全部白屏。
 *
 * 参数化路由本来就不该再嵌一层：`:page` 已经把"哪一页"编码进去了，
 * 再让 vue-router 去匹配一次是多余的。这里按 `:page` 直接选组件，
 * 与 `view/calendar/CalendarSystemView.vue` 按 `:system` 取值是同一个做法。
 */

import { computed } from "vue";

import { useRoute } from "../../plugin";
import BaziView from "./BaziView.vue";
import ZiweiView from "./ZiweiView.vue";
import QizhengView from "./QizhengView.vue";
import HoroscopeView from "./HoroscopeView.vue";

const route = useRoute();

const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** `:page` → 组件。 */
const PAGES = {
    bazi: BaziView,
    ziwei: ZiweiView,
    qizheng: QizhengView,
    horoscope: HoroscopeView
} as const;

const component = computed(() => PAGES[current.value as keyof typeof PAGES]);
</script>

<template>
    <component :is="component" v-if="component !== undefined" />

    <ElResult
        v-else
        icon="warning"
        title="没有这一页"
        :sub-title="`「${current}」不在命理域里。可用的有：八字、紫微斗数、七政四余、西方星盘。`" />
</template>
