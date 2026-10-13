<script setup lang="ts">
/**
 * 大衍筮法：`/divination/dayan`。
 *
 * ## 这一页是真算的
 *
 * 揲蓍法的**每一步都是确定的分堆规则**，没有流派分歧：
 *
 * 1. 五十根蓍草，取出一根不用（"大衍之数五十，其用四十有九"）；
 * 2. **三变成一爻**：每变把草随机分成两堆，从右堆挂一，然后四根一组地数，
 *    取余数（余 0 作 4）；第一变去掉 5 或 9 根，第二三变各去掉 4 或 8 根；
 * 3. **十八变成一卦**（六爻 × 三变）。
 *
 * 一爻三变之后剩下的组数只能是 24 / 28 / 32 / 36，除以 4 得 6/7/8/9：
 * **6 老阴（变）、7 少阳、8 少阴、9 老阳（变）**。
 *
 * ## 随机性是刻意的
 *
 * 蓍草起卦的本质是"用物理随机数避免人的选择"。所以这里用
 * `crypto.getRandomValues` 而不是 `Math.random`——前者不可预测，后者可被种子推回。
 * 这不是安全考虑，是**仪式性**考虑：一条能被复现的随机序列就不是起卦了。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";

/** 一爻的四个可能值。 */
interface Line {
    /** 6 老阴 / 7 少阳 / 8 少阴 / 9 老阳 */
    value: number;
    /** 三变之后剩下的组数（24 / 28 / 32 / 36） */
    groups: number;
    /** 三变各去掉的根数 */
    removed: [number, number, number];
}

/** 一次揲蓍：三变成一爻。 */
function drawLine(): Line {
    let remaining = 49;
    const removed: number[] = [];

    for (let change = 0; change < 3; change += 1) {
        /*
         * 分二：把当前的草随机分成两堆。
         *
         * `crypto.getRandomValues` 取一个均匀随机偏移。**左堆不能为空也不能全占**
         * （"挂一"要从右堆取，两堆都得有草），所以范围是 1 … remaining-1。
         */
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        const left = (buffer[0] % (remaining - 1)) + 1;

        // 挂一：从右堆取一根夹在指间
        let right = remaining - left - 1;

        // 揲四：两堆各自四根一组地数，取余（余 0 作 4）
        const leftRemainder = left % 4 === 0 ? 4 : left % 4;
        right = right % 4 === 0 ? 4 : right % 4;

        const taken = 1 + leftRemainder + right;
        removed.push(taken);
        remaining -= taken;
    }

    return {
        value: remaining / 4,
        groups: remaining,
        removed: [removed[0], removed[1], removed[2]] as [number, number, number]
    };
}

/** 六爻（自下而上）。 */
const lines = ref<Line[]>([]);

/** 起一卦：十八变。 */
const cast = (): void => {
    lines.value = Array.from({ length: 6 }, () => drawLine());
};

/** 爻名。 */
const lineName = (value: number): string =>
    value === 6 ? "老阴" : value === 7 ? "少阳" : value === 8 ? "少阴" : "老阳";

/** 是否动爻。 */
const isMoving = (value: number): boolean => value === 6 || value === 9;

/** 阴阳：7 与 9 为阳。 */
const isYang = (value: number): boolean => value === 7 || value === 9;

/** 本卦的六条线（自上而下显示）。 */
const display = computed(() => [...lines.value].reverse());

/** 变卦：动爻取反。 */
const changed = computed(() =>
    [...lines.value].map((line) => (isMoving(line.value) ? (isYang(line.value) ? 8 : 7) : line.value))
);

/** 动爻数量。 */
const movingCount = computed(() => lines.value.filter((line) => isMoving(line.value)).length);
</script>

<template>
    <PageShell :state="'ready'" :card="false" :scroll="true">
        <div class="dy">
            <header class="dy__head">
                <div>
                    <h1 class="dy__title">大衍筮法</h1>
                    <p class="dy__note">
                        五十根蓍草，取一不用，其用四十有九。**三变成一爻、十八变成一卦**：
                        每变分二、挂一、揲四、归奇。三变后所余只能是 24/28/32/36，
                        除以四得 6 老阴、7 少阳、8 少阴、9 老阳——**6 与 9 为动爻**。
                    </p>
                </div>
                <ElButton type="primary" @click="cast">揲蓍起卦</ElButton>
            </header>

            <ElEmpty v-if="lines.length === 0" description="还没有起卦。点右上角的「揲蓍起卦」。" />

            <div v-else class="dy__body">
                <section class="dy__panel">
                    <h2 class="xy-panel-title">本卦（自下而上，第 1 爻在底）</h2>
                    <div class="dy__lines">
                        <div v-for="(line, index) in display" :key="`l-${index}`" class="dy__line">
                            <span class="dy__line-no numeral">{{ 6 - index }}</span>

                            <span class="dy__line-figure">
                                <i v-if="isYang(line.value)" class="dy__solid" :class="{ 'is-moving': isMoving(line.value) }" />
                                <template v-else>
                                    <i class="dy__broken" :class="{ 'is-moving': isMoving(line.value) }" />
                                    <i class="dy__broken" :class="{ 'is-moving': isMoving(line.value) }" />
                                </template>
                            </span>

                            <span class="dy__line-name">
                                {{ lineName(line.value) }}
                                <span class="numeral xy-dim">{{ line.value }}</span>
                                <ElTag v-if="isMoving(line.value)" size="small" type="danger" effect="plain">动</ElTag>
                            </span>

                            <span class="dy__line-detail xy-dim numeral">
                                三变各去 {{ line.removed.join(" / ") }}，余 {{ line.groups }} 根（{{ line.groups / 4 }} 组）
                            </span>
                        </div>
                    </div>
                </section>

                <aside class="dy__aside">
                    <section class="dy__panel">
                        <h2 class="xy-panel-title">变卦</h2>
                        <p class="xy-note">
                            动爻取反。{{ movingCount }} 个动爻。
                        </p>
                        <div class="dy__changed">
                            <span v-for="(value, index) in [...changed].reverse()" :key="`c-${index}`" class="dy__line-figure">
                                <i v-if="isYang(value)" class="dy__solid" />
                                <template v-else>
                                    <i class="dy__broken" /><i class="dy__broken" />
                                </template>
                            </span>
                        </div>
                    </section>

                    <section class="dy__panel">
                        <h2 class="xy-panel-title">概率</h2>
                        <p class="xy-note">
                            三变的余数不是均匀的：**老阳（9）的概率只有 3/16，少阴（8）有 7/16**。
                            这就是"蓍草起卦比铜钱起卦更重阴"那件事的算术来源——
                            铜钱法三枚同掷，四象各 1/4，而蓍草法不是。
                        </p>
                        <ElDescriptions :column="1" border size="small">
                            <ElDescriptionsItem label="老阴 6">1 / 16</ElDescriptionsItem>
                            <ElDescriptionsItem label="少阳 7">5 / 16</ElDescriptionsItem>
                            <ElDescriptionsItem label="少阴 8">7 / 16</ElDescriptionsItem>
                            <ElDescriptionsItem label="老阳 9">3 / 16</ElDescriptionsItem>
                        </ElDescriptions>
                    </section>

                    <section class="dy__panel">
                        <h2 class="xy-panel-title">未实现</h2>
                        <ul class="dy__todo">
                            <li>卦名与卦辞：要一部六十四卦的卦爻辞文本</li>
                            <li>之卦的取用规则（一爻动看爻辞、多爻动看卦辞等）</li>
                        </ul>
                        <p class="xy-note">
                            这一页给出的是**卦象本身**（本卦、变卦、动爻），这是揲蓍法唯一确定的部分。
                        </p>
                    </section>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.dy {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dy__head {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
}

.dy__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.dy__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 86ch;
}

.dy__body {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) 340px;
}

.dy__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.dy__aside {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.dy__lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.dy__line {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 22px 130px 110px 1fr;
}

.dy__line-no {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    text-align: right;
}

.dy__line-figure {
    align-items: center;
    display: flex;
    gap: 8px;
    height: 12px;
}

.dy__solid {
    background: var(--el-text-color-primary);
    height: 10px;
    width: 100%;
}

.dy__broken {
    background: var(--el-text-color-primary);
    height: 10px;
    width: 46%;
}

/* 动爻：用主色。这是整张卦里唯一会变的部分 */
.dy__solid.is-moving,
.dy__broken.is-moving {
    background: var(--el-color-danger);
}

.dy__line-name {
    align-items: center;
    color: var(--el-text-color-regular);
    display: inline-flex;
    font-size: var(--xy-font-sm);
    gap: 6px;
}

.dy__changed {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
}

.dy__todo {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-relaxed);
    margin: 0;
    padding-left: 18px;
}
</style>
