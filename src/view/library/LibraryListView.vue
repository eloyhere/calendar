<script setup lang="ts">
/**
 * 文献列表：`/library/:page`。四页共用（差异只有"哪个时代、哪个地域"）。
 *
 * ## 一条文献的呈现顺序
 *
 * ```
 * 书名（大）          作者 · 年代（次）
 * 「它解决了什么」——这是这一页存在的理由
 * 相关：朔望历 / 闰月 / 回归年（可点的标签）
 * ```
 *
 * 把 `why` 放在书名下面而不是塞进折叠区：一本只列书名与作者的书目对读者没有用，
 * 有用的信息是"我该为了什么去读它"。
 *
 * ## 搜索是高亮的，不是过滤的
 *
 * 用过滤会把"没有结果"变成一屏空白，用户不知道自己是不是打错了。
 * 高亮保留全部条目但把匹配处标出来，同时给命中数——这样"没找到"与"这个词不在这页"
 * 是两件看得出来的事。
 */

import { computed, ref } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import type { LibraryPage } from "../../entity/library";

interface Props {
    /** 这一页的登记项 */
    page: LibraryPage;
}

const props = defineProps<Props>();

/** 搜索词。 */
const query = ref("");

/** 命中数。 */
const hits = computed(() => {
    const needle = query.value.trim().toLowerCase();
    if (needle.length === 0) {
        return props.page.items.length;
    }
    return props.page.items.filter((item) =>
        [item.title, item.original ?? "", item.author, item.why, ...item.relates]
            .join(" ")
            .toLowerCase()
            .includes(needle)
    ).length;
});

/** 一条是否命中。 */
const isHit = (item: (typeof props.page.items)[number]): boolean => {
    const needle = query.value.trim().toLowerCase();
    if (needle.length === 0) {
        return true;
    }
    return [item.title, item.original ?? "", item.author, item.why, ...item.relates]
        .join(" ")
        .toLowerCase()
        .includes(needle);
};
</script>

<template>
    <div class="lib">
        <header class="lib__head">
            <div>
                <h1 class="lib__title">{{ props.page.title }}</h1>
                <p class="lib__note">{{ props.page.note }}</p>
            </div>

            <div class="lib__search">
                <ElInput v-model="query" placeholder="搜书名、作者、关键词" clearable class="lib__input">
                    <template #prefix><AppIcon name="Search" /></template>
                </ElInput>
                <span class="xy-dim numeral">{{ hits }} / {{ props.page.items.length }}</span>
            </div>
        </header>

        <ElScrollbar class="lib__scroll">
            <ul class="lib__list">
                <li
                    v-for="item in props.page.items"
                    :key="item.title"
                    class="lib__item"
                    :class="{ 'is-dim': !isHit(item) }">
                    <div class="lib__item-head">
                        <h2 class="lib__book">{{ item.title }}</h2>
                        <span v-if="item.original !== undefined" class="lib__original">{{ item.original }}</span>
                    </div>

                    <p class="lib__meta numeral">{{ item.author }} · {{ item.era }}</p>
                    <p class="lib__why">{{ item.why }}</p>

                    <div class="lib__tags">
                        <ElTag v-for="tag in item.relates" :key="tag" size="small" effect="plain">{{ tag }}</ElTag>
                    </div>
                </li>
            </ul>
        </ElScrollbar>
    </div>
</template>

<style scoped>
.lib {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.lib__head {
    align-items: flex-start;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 12px 16px;
}

.lib__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.lib__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 76ch;
}

.lib__search {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.lib__input {
    width: 220px;
}

.lib__scroll {
    flex: 1;
    min-height: 0;
}

.lib__list {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    list-style: none;
    margin: 0;
    padding: 14px 16px 20px;
}

.lib__item {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
    transition: border-color var(--xy-duration-fast) var(--xy-ease);
}

.lib__item:hover {
    border-color: var(--el-color-primary-light-5);
}

/* 未命中：降一档但留着。过滤会把"没找到"变成一屏空白，用户不知道是不是自己打错了 */
.lib__item.is-dim {
    opacity: 0.4;
}

.lib__item-head {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.lib__book {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.lib__original {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    font-style: italic;
}

.lib__meta {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    margin: 3px 0 0;
}

.lib__why {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-sm);
    line-height: var(--xy-leading-normal);
    margin: 8px 0 0;
}

.lib__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
}
</style>
