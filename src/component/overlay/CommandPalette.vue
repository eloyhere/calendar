<script setup lang="ts">
/**
 * 命令面板（`Ctrl+K`）。
 *
 * ## 没有可核验的权威规范
 *
 * `docs/ui-architecture.md` §2.3 第 20 条写得很直白：NN/g 与 Electron 官方都**没有**
 * 命令面板的设计规范文章。所以这里是**本项目自定的约定**，不宣称有文献依据。
 * 它解决的是一个具体需求：9 项一级导航、26 项菜单条目，靠侧栏逐层点太慢，
 * 需要一个"任意页直达任意页"的入口。
 *
 * ## 它不管助手
 *
 * 助手有自己的入口（`Ctrl+/` + 侧栏底部 + 顶栏右侧）。把助手也塞进命令面板
 * 会让"问一句话"变成两步，而 §2.3 第 1 条的实测结论是用户想要**更少**的步骤。
 *
 * ## 键盘
 *
 * | 键            | 动作                     |
 * | ------------- | ------------------------ |
 * | `↑` / `↓`     | 移动选中                 |
 * | `Enter`       | 跳到选中项               |
 * | `Esc`         | 关闭（由 `AppShell` 处理） |
 *
 * 列表项用 `role="option"` + `aria-selected`，容器 `role="listbox"`：
 * 面板是"选一个然后跳走"，语义上是列表框而不是一组链接。
 */

import { computed, nextTick, ref, watch } from "vue";

import AppIcon from "../AppIcon.vue";
import type { IconName } from "../../plugin";
import { useShellStore } from "../../store/shell.store";

/** 一个可跳转的目标。 */
interface PaletteItem {
    title: string;
    path: string;
    description: string | null;
    icon: IconName | null;
}

interface Props {
    /** 候选目标，由 `AppShell` 从菜单树拍平而来 */
    items: readonly PaletteItem[];
}

const props = withDefaults(defineProps<Props>(), {});

const emit = defineEmits<{
    /** 用户选了某一项 */
    go: [path: string];
}>();

const shell = useShellStore();

/** 查询串。 */
const query = ref("");

/** 当前选中的下标。 */
const cursor = ref(0);

const input = ref<HTMLInputElement | null>(null);

/**
 * 过滤。
 *
 * 匹配标题与说明，**不区分大小写**。不做模糊匹配的排序算法：26 项候选，
 * 直接包含匹配够快也够准；引入模糊匹配的代价是"为什么这一项排前面"变得
 * 无法解释，而用户只需要一眼看到目标。
 */
const results = computed<PaletteItem[]>(() => {
    const needle = query.value.trim().toLowerCase();
    if (needle.length === 0) {
        return [...props.items];
    }

    return props.items.filter(
        (item) =>
            item.title.toLowerCase().includes(needle) ||
            (item.description ?? "").toLowerCase().includes(needle) ||
            item.path.toLowerCase().includes(needle)
    );
});

/** 选中项回到第一项：换了查询串之后旧下标可能越界。 */
watch(query, () => {
    cursor.value = 0;
});

/** 打开时清空查询、聚焦、重置选中。 */
watch(
    () => shell.paletteOpen,
    async (open) => {
        if (!open) {
            return;
        }
        query.value = "";
        cursor.value = 0;
        await nextTick();
        input.value?.focus();
    }
);

/** 选中项越界时夹回来（结果数变少的情况）。 */
watch(results, (list) => {
    if (cursor.value >= list.length) {
        cursor.value = 0;
    }
});

const pick = (index: number): void => {
    const item = results.value[index];
    if (item === undefined) {
        return;
    }
    shell.closePalette();
    emit("go", item.path);
};

const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        cursor.value = Math.min(cursor.value + 1, results.value.length - 1);
        return;
    }
    if (event.key === "ArrowUp") {
        event.preventDefault();
        cursor.value = Math.max(cursor.value - 1, 0);
        return;
    }
    if (event.key === "Enter") {
        event.preventDefault();
        pick(cursor.value);
    }
};
</script>

<template>
    <ElDialog
        v-model="shell.paletteOpen"
        width="560px"
        top="12vh"
        :show-close="false"
        :with-header="false"
        class="command-palette">
        <div class="command-palette__box">
            <div class="command-palette__input">
                <AppIcon name="Search" />
                <input
                    ref="input"
                    v-model="query"
                    class="command-palette__field"
                    type="text"
                    placeholder="跳到任意页面……"
                    aria-label="搜索页面"
                    @keydown="onKeydown" />
                <span class="command-palette__hint">Esc 关闭</span>
            </div>

            <!-- 列表框语义：面板是"选一个然后跳走" -->
            <ul class="command-palette__list" role="listbox" aria-label="页面">
                <li
                    v-for="(item, index) in results"
                    :key="item.path"
                    class="command-palette__item"
                    :class="{ 'is-active': index === cursor }"
                    role="option"
                    :aria-selected="index === cursor"
                    @mouseenter="cursor = index"
                    @click="pick(index)">
                    <AppIcon v-if="item.icon" :name="item.icon" />
                    <span class="command-palette__title">{{ item.title }}</span>
                    <span class="command-palette__path">{{ item.path }}</span>
                </li>

                <li v-if="results.length === 0" class="command-palette__empty">
                    没有匹配的页面
                </li>
            </ul>
        </div>
    </ElDialog>
</template>

<style scoped>
.command-palette__box {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.command-palette__input {
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    gap: 8px;
    padding-bottom: 10px;
}

/*
 * 输入框：原生 `input` 而不是 `ElInput`。
 *
 * 面板的输入框要**吃掉全部键盘事件**（尤其 `↓` / `Enter`），而 `ElInput`
 * 会包一层自己的事件转发，`@keydown` 的时机与 `v-model` 的更新之间会插一帧。
 * 原生的可控性更好，样式也只有三条。
 */
.command-palette__field {
    background: transparent;
    border: none;
    color: var(--el-text-color-primary);
    flex: 1;
    font-size: 15px;
    outline: none;
}

.command-palette__field::placeholder {
    color: var(--el-text-color-placeholder);
}

.command-palette__hint {
    color: var(--el-text-color-placeholder);
    font-size: 11px;
}

.command-palette__list {
    display: flex;
    flex-direction: column;
    list-style: none;
    margin: 0;
    max-height: 52vh;
    overflow-y: auto;
    padding: 0;
}

.command-palette__item {
    align-items: center;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding: 8px 10px;
}

.command-palette__item.is-active {
    background: var(--el-fill-color-light);
}

.command-palette__title {
    color: var(--el-text-color-primary);
    font-size: 14px;
}

.command-palette__path {
    color: var(--el-text-color-placeholder);
    font-family: var(--el-font-family-mono, monospace);
    font-size: 11px;
    margin-left: auto;
}

.command-palette__empty {
    color: var(--el-text-color-placeholder);
    font-size: 13px;
    padding: 16px 10px;
    text-align: center;
}
</style>
