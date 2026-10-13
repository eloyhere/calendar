<script setup lang="ts">
/**
 * 排盘页脚手架：命理与数术各页共用的骨架。
 *
 * ## 它固定了哪几件事
 *
 * 四张命理盘与六种数术课的**输入完全相同**（一个时刻 + 地点 + 两条口径），
 * 输出也共享同一层"已算出的历法事实"（年/月/日/时四柱、节气、真太阳时）。
 * 所以这一层抽出来：上面是 `MomentPicker`，中间是**四柱条**，
 * 下面是各页自己的盘面（默认插槽）。
 *
 * ## 四柱条是刻意的公共部分
 *
 * 不论奇门还是紫微，"这个时刻的四柱是什么"都是第一步，而且它由库直接给出
 * （换年点是立春、换月点是交节，都是 `tree_year` / `tree_month` 的精确时刻）。
 * 每页各画一遍就会出现"八字页说寅月、奇门页说卯月"这种不一致。
 *
 * ## 未实现的算法必须写在页面上
 *
 * 数术诸页里有一部分（奇门超接置闰、太乙积年、六壬三传的取法）
 * 各家分歧很大，且需要更多史料核对。这些页面会**明确写出"这一部分尚未实现"**，
 * 而不是画一个看起来完整、实际是编的盘面。数据可推是这个项目的立身之本。
 */

import { computed } from "vue";

import MomentPicker from "./MomentPicker.vue";
import type { MomentFacts, MomentInput } from "../../state/use-moment";
import { BRANCHES } from "../../share/calendar/sexagenary";

interface Props {
    /** 页标题 */
    title: string;
    /** 一句话说清这一页算什么、依据什么 */
    note: string;
    /** 起课输入（`v-model`） */
    moment: MomentInput;
    /** 派生事实；未算出时为 `null` */
    facts: MomentFacts | null;
    /** 加载中 */
    loading?: boolean;
    /** 出错信息 */
    error?: string;
    /** 尚未实现的部分，逐条列出；为空表示这一页是完整的 */
    todo?: readonly string[];
    /** 口径依据（书名等） */
    basis?: string;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    error: "",
    todo: () => [],
    basis: ""
});

const emit = defineEmits<{
    "update:moment": [value: MomentInput];
}>();

/** 四柱。 */
const pillars = computed(() => {
    const facts = props.facts;
    if (facts === null) {
        return [];
    }
    return [
        { label: "年柱", value: facts.yearPillar, note: "换年点为立春" },
        { label: "月柱", value: facts.monthPillar, note: `所处节气：${facts.solarTerm}` },
        { label: "日柱", value: facts.dayPillar, note: facts.notes.find((item) => item.label === "换日规则")?.value ?? "" },
        { label: "时柱", value: facts.hourPillar, note: `${BRANCHES[facts.hourBranch]}时` }
    ];
});

const momentProxy = computed({
    get: () => props.moment,
    set: (value: MomentInput) => emit("update:moment", value)
});
</script>

<template>
    <div class="scaffold">
        <header class="scaffold__head">
            <div>
                <h1 class="scaffold__title">{{ props.title }}</h1>
                <p class="scaffold__note">{{ props.note }}</p>
            </div>
            <span v-if="props.loading" class="xy-dim">排盘中…</span>
            <ElTag v-if="props.basis.length > 0" effect="plain" size="small">{{ props.basis }}</ElTag>
        </header>

        <ElScrollbar class="scaffold__scroll">
            <div class="scaffold__inner">
                <MomentPicker v-model="momentProxy" :notes="props.facts?.notes ?? []" />

                <ElAlert v-if="props.error.length > 0" type="error" :closable="false" :title="props.error" />

                <!-- 四柱条：所有盘面的公共第一步 -->
                <section v-if="pillars.length > 0" class="scaffold__pillars">
                    <div v-for="pillar in pillars" :key="pillar.label" class="scaffold__pillar">
                        <span class="scaffold__pillar-label">{{ pillar.label }}</span>
                        <span class="scaffold__pillar-value">{{ pillar.value }}</span>
                        <span class="scaffold__pillar-note xy-dim">{{ pillar.note }}</span>
                    </div>
                </section>

                <!-- 各页自己的盘面 -->
                <slot />

                <!--
                    未实现的部分：**写在页面上**，不藏在注释里。
                    数术里有几处的取法各家分歧很大，画一个"看起来完整"的盘面
                    比留白更糟——用户会拿它当依据。
                -->
                <section v-if="props.todo.length > 0" class="scaffold__todo">
                    <h2 class="xy-panel-title">这一页尚未实现的部分</h2>
                    <ul class="scaffold__todo-list">
                        <li v-for="item in props.todo" :key="item">{{ item }}</li>
                    </ul>
                    <p class="xy-note">
                        上面列出的部分**没有**在本页实现。原因通常是各家取法分歧大、
                        需要更多史料核对，或者依赖本项目还没有的数据。
                        列在这里而不是画一个占位的盘面——那种盘面会被当成依据用。
                    </p>
                </section>
            </div>
        </ElScrollbar>
    </div>
</template>

<style scoped>
.scaffold {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.scaffold__head {
    align-items: center;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 12px;
    justify-content: space-between;
    padding: 8px 12px;
}

.scaffold__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.scaffold__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 82ch;
}

.scaffold__scroll {
    flex: 1;
    min-height: 0;
}

.scaffold__inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px 14px;
}

.scaffold__pillars {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(4, 1fr);
}

/*
 * 四柱：竖排、从上到下是干与支。
 * 传统排法是竖排右起，横排也可以，但**必须对齐**——四柱错位一格就全读错了。
 */
/*
 * 四柱卡：**横排一行**而不是竖排四张高卡。
 *
 * 四柱是四个两字（"丙午"），竖排 + 28px 字号会让它占掉一屏的三分之一，
 * 而它是排盘的第一步、不是结论。横排成一行之后标签在左、干支在右，
 * 四个柱子只占 40px 高，且**列对齐**——对齐是四柱的硬要求。
 */
.scaffold__pillar {
    align-items: baseline;
    background: var(--el-fill-color-lighter);
    border-radius: var(--xy-radius-md);
    display: flex;
    gap: 6px;
    padding: 5px 10px;
}

.scaffold__pillar-label {
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
    font-size: var(--xy-font-2xs);
}

.scaffold__pillar-value {
    color: var(--el-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    letter-spacing: 0.06em;
    line-height: 1.2;
}

/* 副注（换柱依据）跟在干支后面，不再单独占一行 */
.scaffold__pillar-note {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.scaffold__todo {
    background: var(--el-color-warning-light-9);
    border: 1px solid var(--el-color-warning-light-5);
    border-radius: var(--xy-radius-md);
    padding: 8px 10px;
}

.scaffold__todo-list {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-sm);
    line-height: var(--xy-leading-relaxed);
    margin: 0;
    padding-left: 20px;
}
</style>
