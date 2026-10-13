<script setup lang="ts">
/**
 * 梅花易数：`/divination/meihua`。
 *
 * ## 这一页是真算的
 *
 * 梅花易数的起卦规则**完全确定**，没有流派分歧，所以可以完整实现：
 *
 * | 起法       | 上卦       | 下卦       | 动爻       |
 * | ---------- | ---------- | ---------- | ---------- |
 * | 时间起卦   | 年+月+日   | +时        | 三者之和   |
 * | 数字起卦   | 第一个数   | 第二个数   | 两数之和   |
 *
 * 都取除以 8 的余数（0 作 8）定卦，除以 6 的余数（0 作 6）定动爻。
 * 然后由本卦 + 动爻推出**互卦**与**变卦**，再按体用分判吉凶。
 *
 * ## 先天八卦数
 *
 * 乾一、兑二、离三、震四、巽五、坎六、艮七、坤八。
 * 这是邵雍的先天次序，与后天八卦的方位数不同——用错就会得到另一张卦。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import MomentPicker from "../../component/domain/MomentPicker.vue";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment } from "../../state/use-moment";
import { BRANCHES } from "../../share/calendar/sexagenary";

/** 先天八卦：数 → 卦。 */
const BAGUA = [
    { name: "乾", symbol: "☰", nature: "天", lines: [1, 1, 1] },
    { name: "兑", symbol: "☱", nature: "泽", lines: [1, 1, 0] },
    { name: "离", symbol: "☲", nature: "火", lines: [1, 0, 1] },
    { name: "震", symbol: "☳", nature: "雷", lines: [1, 0, 0] },
    { name: "巽", symbol: "☴", nature: "风", lines: [0, 1, 1] },
    { name: "坎", symbol: "☵", nature: "水", lines: [0, 1, 0] },
    { name: "艮", symbol: "☶", nature: "山", lines: [0, 0, 1] },
    { name: "坤", symbol: "☷", nature: "地", lines: [0, 0, 0] }
] as const;

/** 数 → 卦（余数 0 作 8）。 */
const guaOf = (value: number) => BAGUA[((value - 1) % 8 + 8) % 8];

/** 六十四卦名。索引 = 上卦 × 8 + 下卦（先天次序）。 */
const HEXAGRAM_NAMES: Record<string, string> = {
    乾乾: "乾为天", 乾兑: "天泽履", 乾离: "天火同人", 乾震: "天雷无妄", 乾巽: "天风姤", 乾坎: "天水讼", 乾艮: "天山遁", 乾坤: "天地否",
    兑乾: "泽天夬", 兑兑: "兑为泽", 兑离: "泽火革", 兑震: "泽雷随", 兑巽: "泽风大过", 兑坎: "泽水困", 兑艮: "泽山咸", 兑坤: "泽地萃",
    离乾: "火天大有", 离兑: "火泽睽", 离离: "离为火", 离震: "火雷噬嗑", 离巽: "火风鼎", 离坎: "火水未济", 离艮: "火山旅", 离坤: "火地晋",
    震乾: "雷天大壮", 震兑: "雷泽归妹", 震离: "雷火丰", 震震: "震为雷", 震巽: "雷风恒", 震坎: "雷水解", 震艮: "雷山小过", 震坤: "雷地豫",
    巽乾: "风天小畜", 巽兑: "风泽中孚", 巽离: "风火家人", 巽震: "风雷益", 巽巽: "巽为风", 巽坎: "风水涣", 巽艮: "风山渐", 巽坤: "风地观",
    坎乾: "水天需", 坎兑: "水泽节", 坎离: "水火既济", 坎震: "水雷屯", 坎巽: "水风井", 坎坎: "坎为水", 坎艮: "水山蹇", 坎坤: "水地比",
    艮乾: "山天大畜", 艮兑: "山泽损", 艮离: "山火贲", 艮震: "山雷颐", 艮巽: "山风蛊", 艮坎: "山水蒙", 艮艮: "艮为山", 艮坤: "山地剥",
    坤乾: "地天泰", 坤兑: "地泽临", 坤离: "地火明夷", 坤震: "地雷复", 坤巽: "地风升", 坤坎: "地水师", 坤艮: "地山谦", 坤坤: "坤为地"
};

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);

/** 数字起卦用的两个数。 */
const numberA = ref(17);
const numberB = ref(29);

/** 起卦方式。 */
const mode = ref<"time" | "number">("time");

const derive = async (): Promise<void> => {
    facts.value = await deriveMoment(moment.value);
};
void derive();

/** 上卦、下卦、动爻的原始数。 */
const raw = computed(() => {
    if (mode.value === "number") {
        return { upper: numberA.value, lower: numberB.value, moving: numberA.value + numberB.value };
    }
    const f = facts.value;
    if (f === null) {
        return null;
    }
    // 年取地支序（子 1 … 亥 12），月日时取数值
    const yearBranch = BRANCHES.indexOf(f.yearPillar[1]) + 1;
    const month = moment.value.month;
    const day = moment.value.day;
    const hourBranch = f.hourBranch + 1;
    return {
        upper: yearBranch + month + day,
        lower: yearBranch + month + day + hourBranch,
        moving: yearBranch + month + day + hourBranch
    };
});

/** 卦。 */
const chart = computed(() => {
    const value = raw.value;
    if (value === null) {
        return null;
    }
    const upper = guaOf(value.upper);
    const lower = guaOf(value.lower);
    const movingLine = ((value.moving - 1) % 6 + 6) % 6 + 1;

    // 六爻数组：下卦三爻在前，上卦三爻在后，索引 0 = 初爻
    const original = [...lower.lines, ...upper.lines];

    // 变卦：动爻取反
    const changed = original.map((line, index) => (index === movingLine - 1 ? (line === 1 ? 0 : 1) : line));

    // 互卦：二三四爻为下卦，三四五爻为上卦
    const mutualLower = [original[1], original[2], original[3]];
    const mutualUpper = [original[2], original[3], original[4]];

    const nameOf = (lines: number[]): string => {
        const down = BAGUA.find((gua) => gua.lines.join("") === lines.slice(0, 3).join(""));
        const up = BAGUA.find((gua) => gua.lines.join("") === lines.slice(3, 6).join(""));
        return up === undefined || down === undefined ? "—" : (HEXAGRAM_NAMES[`${up.name}${down.name}`] ?? "—");
    };

    return {
        upper,
        lower,
        movingLine,
        original,
        changed,
        mutual: [...mutualLower, ...mutualUpper],
        originalName: nameOf(original),
        changedName: nameOf(changed),
        mutualName: nameOf([...mutualLower, ...mutualUpper])
    };
});

/** 体用：动爻所在的卦为「用」，另一卦为「体」。 */
const bodyUse = computed(() => {
    const value = chart.value;
    if (value === null) {
        return null;
    }
    const movingInUpper = value.movingLine > 3;
    return {
        body: movingInUpper ? value.lower : value.upper,
        use: movingInUpper ? value.upper : value.lower,
        note: movingInUpper ? "动爻在上卦，故上卦为用、下卦为体" : "动爻在下卦，故下卦为用、上卦为体"
    };
});

void PageShell;
</script>

<template>
    <PageShell :state="'ready'" :card="false" :scroll="true">
        <div class="mh">
            <header class="mh__head">
                <div>
                    <h1 class="mh__title">梅花易数</h1>
                    <p class="mh__note">
                        起卦规则完全确定、无流派分歧，所以这一页是**完整实现**的：
                        取数 → 除八定上下卦 → 除六定动爻 → 推互卦与变卦 → 分体用。
                        八卦用**先天数**（乾一兑二离三震四巽五坎六艮七坤八）。
                    </p>
                </div>
                <ElRadioGroup v-model="mode" size="small">
                    <ElRadioButton value="time">时间起卦</ElRadioButton>
                    <ElRadioButton value="number">数字起卦</ElRadioButton>
                </ElRadioGroup>
            </header>

            <MomentPicker v-if="mode === 'time'" v-model="moment" />

            <div v-else class="mh__numbers">
                <span class="mh__numbers-label">起两个数</span>
                <ElInputNumber v-model="numberA" :min="1" :controls="false" class="mh__number" />
                <ElInputNumber v-model="numberB" :min="1" :controls="false" class="mh__number" />
                <span class="xy-dim">第一个数定上卦，第二个定下卦，两数之和定动爻</span>
            </div>

            <section v-if="chart !== null" class="mh__result">
                <div class="mh__card">
                    <span class="mh__card-label">本卦</span>
                    <span class="mh__card-name">{{ chart.originalName }}</span>
                    <div class="mh__lines">
                        <span
                            v-for="(line, index) in [...chart.original].reverse()"
                            :key="`o-${index}`"
                            class="mh__line"
                            :class="{ 'is-broken': line === 0, 'is-moving': 6 - index === chart.movingLine }">
                            <i v-if="line === 1" class="mh__solid" />
                            <template v-else>
                                <i class="mh__broken" /><i class="mh__broken" />
                            </template>
                        </span>
                    </div>
                    <span class="xy-dim">动爻：第 {{ chart.movingLine }} 爻（自下而上）</span>
                </div>

                <div class="mh__card">
                    <span class="mh__card-label">互卦</span>
                    <span class="mh__card-name">{{ chart.mutualName }}</span>
                    <div class="mh__lines">
                        <span
                            v-for="(line, index) in [...chart.mutual].reverse()"
                            :key="`m-${index}`"
                            class="mh__line"
                            :class="{ 'is-broken': line === 0 }">
                            <i v-if="line === 1" class="mh__solid" />
                            <template v-else>
                                <i class="mh__broken" /><i class="mh__broken" />
                            </template>
                        </span>
                    </div>
                    <span class="xy-dim">二三四爻为下、三四五爻为上</span>
                </div>

                <div class="mh__card">
                    <span class="mh__card-label">变卦</span>
                    <span class="mh__card-name">{{ chart.changedName }}</span>
                    <div class="mh__lines">
                        <span
                            v-for="(line, index) in [...chart.changed].reverse()"
                            :key="`c-${index}`"
                            class="mh__line"
                            :class="{ 'is-broken': line === 0 }">
                            <i v-if="line === 1" class="mh__solid" />
                            <template v-else>
                                <i class="mh__broken" /><i class="mh__broken" />
                            </template>
                        </span>
                    </div>
                    <span class="xy-dim">动爻取反</span>
                </div>
            </section>

            <section v-if="bodyUse !== null" class="mh__body">
                <h2 class="xy-panel-title">体用</h2>
                <div class="mh__body-row">
                    <div class="mh__body-item">
                        <span class="mh__body-label">体</span>
                        <span class="mh__body-value">{{ bodyUse.body.symbol }} {{ bodyUse.body.name }}（{{ bodyUse.body.nature }}）</span>
                    </div>
                    <div class="mh__body-item">
                        <span class="mh__body-label">用</span>
                        <span class="mh__body-value">{{ bodyUse.use.symbol }} {{ bodyUse.use.name }}（{{ bodyUse.use.nature }}）</span>
                    </div>
                </div>
                <p class="xy-note">{{ bodyUse.note }}。体用定了才能论生克——生体为吉、克体为凶。</p>
                <p class="xy-note">
                    **未实现**：体用之间的五行生克判断与卦名断辞。前者需要八卦的五行属性与生克表
                    （表已在 `share/calendar/sexagenary.ts`），后者要一部卦辞文本。这一页给出的是
                    **卦象本身**，不是结论。
                </p>
            </section>
        </div>
    </PageShell>
</template>

<style scoped>
.mh {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.mh__head {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
}

.mh__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.mh__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 84ch;
}

.mh__numbers {
    align-items: center;
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 14px;
}

.mh__numbers-label {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
}

.mh__number {
    width: 96px;
}

.mh__result {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(3, 1fr);
}

.mh__card {
    align-items: center;
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
}

.mh__card-label {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
    letter-spacing: 0.1em;
}

.mh__card-name {
    color: var(--el-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
}

.mh__lines {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 120px;
}

.mh__line {
    align-items: center;
    display: flex;
    gap: 6px;
    height: 10px;
    justify-content: center;
}

.mh__solid {
    background: var(--el-text-color-primary);
    height: 8px;
    width: 100%;
}

.mh__broken {
    background: var(--el-text-color-primary);
    height: 8px;
    width: 42%;
}

/* 动爻：用主色标出。这是整张卦里唯一会变的爻，必须一眼看到 */
.mh__line.is-moving .mh__solid,
.mh__line.is-moving .mh__broken {
    background: var(--el-color-danger);
}

.mh__body {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.mh__body-row {
    display: flex;
    gap: 24px;
}

.mh__body-item {
    align-items: baseline;
    display: flex;
    gap: 8px;
}

.mh__body-label {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

.mh__body-value {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-lg);
}
</style>
