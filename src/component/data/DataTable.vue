<script setup lang="ts">
/**
 * 任意表的浏览器：列 + 行 + 分页 + 列显示/隐藏。
 *
 * ## 为什么需要它
 *
 * 本应用有 22 个分库、上百张表，而它们的内容页形状是同一个：一张表 + 一次查询。
 * 每个页面各写一遍 `<ElTable>` 的话，「首列该放什么」「筛选状态怎么显示」
 * 「列重排能不能拖」这些**在 `docs/ui-architecture.md` §2.4 第 5 条里明确规定的规则**
 * 就会分散到十几个文件里，改一条要改十几处。
 *
 * ## 它照哪几条规则实现
 *
 * NN/g 的《数据表：四大用户任务》（§2.4 第 5 条，已核实）里有三条是**硬要求**，
 * 这里逐条落地：
 *
 * 1. **默认第一列应是人类可读的记录标识**，而不是自动生成的「mystery meat」ID。
 *    所以本组件把 `identity` / `absolute` 这类内部主键**排在最后**，让 `name` /
 *    `label` / `title` 这类列打头（顺序由 `primaryColumns` 决定）；
 * 2. **冻结表头行**（`ElTable` 的 `height` 属性一给就固定表头）、斑马纹、
 *    整行悬停高亮——帮助用户在移动视线时保持位置；
 * 3. **列显示/隐藏必须容易完成，且对不使用拖放的用户也可访问**。
 *    所以这里提供的是一个**列菜单**（点选）而不是拖列头，并且显示"已隐藏 N 列"；
 *    同时提供「上移 / 下移」按钮来重排列顺序——WCAG **2.5.7** 要求拖拽必须
 *    有单指针替代，而拖列头在 NN/g 那里也被点名"无障碍性差"。
 *
 * ## 数字列
 *
 * 按 `alignment` 与等宽字体处理：历表里全是 4~5 位年份与时分秒，
 * 比例字体下数字宽度不一，列会对不齐（`src/assets/main.css` 的 `.numeral` 就是为此而设）。
 */

import { computed, ref, watch } from "vue";

import AppIcon from "../AppIcon.vue";
import type { TableColumn } from "./table-column";
import type { Row } from "../../datasource/sqlite";

interface Props {
    /** 行数据 */
    rows: readonly Row[];
    /** 全部列 */
    columns: readonly TableColumn[];
    /**
     * 打头的列名，按顺序。
     *
     * 这一项是"第一列应放人类可读标识"那条规则的落点：调用方把
     * `name` / `label` 之类的列放进来，内部主键自然被挤到后面。
     */
    primaryColumns?: readonly string[];
    /** 表格高度；给了才固定表头（`ElTable` 的约定） */
    height?: number | string;
    /** 是否显示列菜单 */
    configurable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    primaryColumns: () => [],
    height: "100%",
    configurable: true
});

/** 用户调整过的列顺序；空数组表示用默认顺序。 */
const order = ref<string[]>([]);

/** 被隐藏的列。 */
const hidden = ref<string[]>([]);

/** 默认列顺序：打头列在前，其余按传入顺序。 */
const defaultOrder = computed<string[]>(() => {
    const names = props.columns.map((column) => column.name);
    const head = props.primaryColumns.filter((name) => names.includes(name));
    return [...head, ...names.filter((name) => !head.includes(name))];
});

/** 实际顺序。 */
const effectiveOrder = computed<string[]>(() => {
    const base = order.value.length > 0 ? order.value : defaultOrder.value;
    // 列集合变了（换了一张表）时，把新出现的列补到末尾、去掉不存在的
    const known = props.columns.map((column) => column.name);
    return [...base.filter((name) => known.includes(name)), ...known.filter((name) => !base.includes(name))];
});

/** 打头列的默认宽度：标识列要够宽，剩下的自适应。 */
const headWidth = computed(() => (props.primaryColumns.length > 1 ? 180 : 220));

/** 可见列，按实际顺序。 */
const visibleColumns = computed(() =>
    effectiveOrder.value
        .filter((name) => !hidden.value.includes(name))
        .map((name) => props.columns.find((column) => column.name === name))
        .filter((column): column is TableColumn => column !== undefined)
);

/** 换数据源（换表）时清掉用户调整。 */
watch(
    () => props.columns.map((column) => column.name).join(","),
    () => {
        order.value = [];
        hidden.value = [];
    }
);

/** 把一列上移/下移一格。 */
const move = (name: string, delta: number): void => {
    const list = [...effectiveOrder.value];
    const index = list.indexOf(name);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) {
        return;
    }
    [list[index], list[target]] = [list[target], list[index]];
    order.value = list;
};

/** 恢复默认列顺序与全部可见。 */
const reset = (): void => {
    order.value = [];
    hidden.value = [];
};

/** 单元格取值：`bigint` 要转成字符串再显示，否则 `ElTable` 会显示成 `[object]`。 */
const cellOf = (row: Row, name: string): string => {
    const value = row[name];
    if (value === null || value === undefined) {
        return "";
    }
    return typeof value === "bigint" ? value.toString() : String(value);
};

/** 数字列格式化：整数加千分位，其余原样。 */
const displayOf = (row: Row, column: TableColumn): string => {
    const text = cellOf(row, column.name);
    if (!column.numeric || text === "" || !/^-?\d+$/.test(text)) {
        return text;
    }
    return Number(text).toLocaleString("en-US");
};
</script>

<template>
    <div class="data-table">
        <div v-if="props.configurable" class="data-table__toolbar">
            <!--
                筛选状态要有清晰的视觉提示（NN/g 数据表那条）。
                这里的状态有"够"：隐藏了 N 列、顺序被改过，都写出来。
            -->
            <span v-if="hidden.length > 0" class="xy-chip">
                已隐藏 {{ hidden.length }} 列
            </span>
            <span v-if="order.length > 0" class="xy-chip">列顺序已调整</span>
            <span class="xy-dim">{{ props.rows.length }} 行</span>

            <span class="data-table__spring" />

            <ElButton v-if="hidden.length > 0 || order.length > 0" text size="small" @click="reset">
                恢复默认
            </ElButton>

            <ElPopover :width="260" trigger="click" placement="bottom-end">
                <template #reference>
                    <ElButton text size="small">
                        <AppIcon name="Operation" />
                        <span>列</span>
                    </ElButton>
                </template>

                <ul class="data-table__picker">
                    <li v-for="(name, index) in effectiveOrder" :key="name">
                        <ElCheckbox
                            :model-value="!hidden.includes(name)"
                            @update:model-value="
                                (value: string | number | boolean) =>
                                    (hidden = value ? hidden.filter((item) => item !== name) : [...hidden, name])
                            " />
                        <span class="data-table__picker-name is-truncated">{{ name }}</span>

                        <!-- 上移 / 下移：拖列头的单指针替代（WCAG 2.5.7） -->
                        <ElButton
                            link
                            size="small"
                            :disabled="index === 0"
                            aria-label="上移"
                            @click="move(name, -1)">
                            <AppIcon name="Top" />
                        </ElButton>
                        <ElButton
                            link
                            size="small"
                            :disabled="index === effectiveOrder.length - 1"
                            aria-label="下移"
                            @click="move(name, 1)">
                            <AppIcon name="Bottom" />
                        </ElButton>
                    </li>
                </ul>
            </ElPopover>
        </div>

        <ElTable
            :data="props.rows as Row[]"
            stripe
            highlight-current-row
            :height="props.height"
            class="data-table__grid">
            <ElTableColumn
                v-for="(column, index) in visibleColumns"
                :key="column.name"
                :label="column.label ?? column.name"
                :width="column.width ?? (index === 0 ? headWidth : undefined)"
                :min-width="column.width ?? (index === 0 ? headWidth : 140)"
                :align="column.numeric ? 'right' : 'left'"
                :class-name="column.numeric ? 'numeral' : undefined">
                <template #default="{ row }">
                    <span :class="{ numeral: column.numeric }">{{ displayOf(row as Row, column) }}</span>
                </template>
            </ElTableColumn>
        </ElTable>
    </div>
</template>

<style scoped>
.data-table {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.data-table__toolbar {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    padding-bottom: 8px;
}

/* "弹簧"：把右侧的动作推到最右 */
.data-table__spring {
    flex: 1 1 auto;
}

.data-table__grid {
    flex: 1;
    min-height: 0;
    width: 100%;
}

.data-table__picker {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    max-height: 320px;
    overflow-y: auto;
    padding: 0;
}

.data-table__picker li {
    align-items: center;
    display: flex;
    gap: 6px;
}

.data-table__picker-name {
    flex: 1;
    font-size: 12px;
    min-width: 0;
}
</style>
