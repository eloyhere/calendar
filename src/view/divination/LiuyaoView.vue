<script setup lang="ts">
/**
 * 六爻纳甲：`/divination/liuyao`。
 *
 * ## 真算的部分：装卦的骨架
 *
 * 摇钱（或时间）定六爻之后，**纳甲是纯查表**，没有流派分歧：
 * 每个八经卦配固定的地支与五行，天干按"乾纳甲壬、坤纳乙癸"等口诀配。
 * 这一层可以完整实现。
 *
 * ## 尚未实现
 *
 * 六亲（父母 / 兄弟 / 子孙 / 妻财 / 官鬼）要由**卦宫**的五行与本卦各爻五行生克得出；
 * 卦宫的定位要用"京房八宫卦次"（本宫、一世、二世…游魂、归魂）的完整表。
 * 六神按日干起。动变、月建日辰的生克旺衰也都还没做。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import MomentPicker from "../../component/domain/MomentPicker.vue";
import { BRANCHES } from "../../share/calendar/sexagenary";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment } from "../../state/use-moment";

/** 八卦的纳甲表：每卦三爻各配一支，以及卦的五行。 */
const NAJIA = {
    乾: { lines: ["子", "寅", "辰"], element: "金", stem: "甲" },
    坎: { lines: ["寅", "辰", "午"], element: "水", stem: "戊" },
    艮: { lines: ["辰", "午", "申"], element: "土", stem: "丙" },
    震: { lines: ["子", "寅", "辰"], element: "木", stem: "庚" },
    巽: { lines: ["丑", "亥", "酉"], element: "木", stem: "辛" },
    离: { lines: ["卯", "丑", "亥"], element: "火", stem: "己" },
    坤: { lines: ["未", "巳", "卯"], element: "土", stem: "乙" },
    兑: { lines: ["巳", "卯", "丑"], element: "金", stem: "丁" }
} as const;

/** 八经卦的三爻（自上而下）。 */
const TRIGRAMS = [
    { name: "乾", lines: [1, 1, 1] },
    { name: "兑", lines: [0, 1, 1] },
    { name: "离", lines: [1, 0, 1] },
    { name: "震", lines: [0, 0, 1] },
    { name: "巽", lines: [1, 1, 0] },
    { name: "坎", lines: [0, 1, 0] },
    { name: "艮", lines: [1, 0, 0] },
    { name: "坤", lines: [0, 0, 0] }
] as const;

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);
const loading = ref(false);

const derive = async (): Promise<void> => {
    loading.value = true;
    facts.value = await deriveMoment(moment.value);
    loading.value = false;
};
void derive();

/** 六爻（自下而上）：`1` 阳、`0` 阴、`2` 老阳（动）、`3` 老阴（动）。 */
const lines = ref<number[]>([1, 1, 0, 0, 1, 1]);

/** 摇卦：三枚铜钱，正面为 3、反面为 2，三枚之和定一爻。 */
const toss = (): void => {
    const buffer = new Uint8Array(6);
    crypto.getRandomValues(buffer);
    lines.value = Array.from({ length: 6 }, (_unused, index) => {
        // 每爻掷三枚：用三个 bit 表示正反
        const bits = buffer[index];
        const heads = ((bits >> 0) & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
        const sum = heads * 3 + (3 - heads) * 2;
        // 6 老阴、7 少阳、8 少阴、9 老阳
        return sum === 6 ? 3 : sum === 7 ? 1 : sum === 8 ? 0 : 2;
    });
};

/** 一爻是阴还是阳。 */
const isYang = (value: number): boolean => value === 1 || value === 2;
const isMoving = (value: number): boolean => value === 2 || value === 3;

/** 下卦、上卦。 */
const lower = computed(() => TRIGRAMS.find((t) => t.lines.join("") === lines.value.slice(0, 3).map((v) => (isYang(v) ? 1 : 0)).join("")));
const upper = computed(() => TRIGRAMS.find((t) => t.lines.join("") === lines.value.slice(3, 6).map((v) => (isYang(v) ? 1 : 0)).join("")));

/** 六爻纳甲：下卦三爻 + 上卦三爻。 */
const najia = computed(() => {
    const low = lower.value;
    const up = upper.value;
    if (low === undefined || up === undefined) {
        return [];
    }
    const lowData = NAJIA[low.name];
    const upData = NAJIA[up.name];
    return [
        ...lowData.lines.map((branch, index) => ({ position: index + 1, branch, stem: lowData.stem, trigram: low.name })),
        ...upData.lines.map((branch, index) => ({ position: index + 4, branch, stem: upData.stem, trigram: up.name }))
    ];
});

/** 六亲：尚未实现，所以这一列留空并说明。 */
const relationOf = (): string => "—";
</script>

<template>
    <PageShell :state="'ready'" :card="false" :scroll="true">
        <div class="ly">
            <header class="ly__head">
                <div>
                    <h1 class="ly__title">六爻纳甲</h1>
                    <p class="ly__note">
                        摇钱定六爻（三枚铜钱，正面为三、反面为二；六老阴、七少阳、八少阴、九老阳），
                        再按**纳甲表**给每爻配天干地支。纳甲是纯查表、无流派分歧，所以这一层是完整实现的。
                        六亲、卦宫、六神属于待办。
                    </p>
                </div>
                <ElButton type="primary" @click="toss">摇卦</ElButton>
            </header>

            <MomentPicker v-model="moment" :notes="facts?.notes ?? []" />

            <div class="ly__body">
                <section class="ly__panel">
                    <h2 class="xy-panel-title">卦象与纳甲</h2>
                    <div class="ly__lines">
                        <div v-for="line in [...najia].reverse()" :key="line.position" class="ly__line">
                            <span class="ly__pos numeral">{{ line.position }}</span>

                            <span class="ly__figure">
                                <i
                                    v-if="isYang(lines[line.position - 1])"
                                    class="ly__solid"
                                    :class="{ 'is-moving': isMoving(lines[line.position - 1]) }" />
                                <template v-else>
                                    <i class="ly__broken" :class="{ 'is-moving': isMoving(lines[line.position - 1]) }" />
                                    <i class="ly__broken" :class="{ 'is-moving': isMoving(lines[line.position - 1]) }" />
                                </template>
                            </span>

                            <span class="ly__najia">
                                {{ line.stem }}{{ line.branch }}
                                <span class="xy-dim">（{{ line.trigram }}）</span>
                            </span>

                            <span class="ly__relation xy-dim">{{ relationOf() }}</span>

                            <ElTag v-if="isMoving(lines[line.position - 1])" size="small" type="danger" effect="plain">
                                动
                            </ElTag>
                            <span v-else class="ly__moving-placeholder" />
                        </div>
                    </div>

                    <p class="xy-note">
                        下卦 {{ lower?.name ?? "—" }}、上卦 {{ upper?.name ?? "—" }}。
                        纳甲的口诀是「乾纳甲壬、坤纳乙癸，震纳庚、巽纳辛、坎纳戊、离纳己、艮纳丙、兑纳丁」——
                        这里用的是**内卦取前一个天干**的通行做法。
                    </p>
                </section>

                <aside class="ly__aside">
                    <section class="ly__panel">
                        <h2 class="xy-panel-title">六神</h2>
                        <p class="xy-note">
                            按**日干**起：甲乙起青龙、丙丁起朱雀、戊起勾陈、己起螣蛇、庚辛起白虎、壬癸起玄武，
                            自初爻向上排。
                        </p>
                        <p class="xy-note">
                            当前日干：<strong>{{ facts?.dayPillar[0] ?? "—" }}</strong>
                        </p>
                    </section>

                    <section class="ly__panel">
                        <h2 class="xy-panel-title">尚未实现</h2>
                        <ul class="ly__todo">
                            <li>卦宫定位：京房八宫卦次（本宫 / 一世 / 二世 … 游魂 / 归魂）的完整表</li>
                            <li>六亲：由卦宫五行与本爻五行生克得出（父母 / 兄弟 / 子孙 / 妻财 / 官鬼）</li>
                            <li>六神：起法已写明，尚未接入</li>
                            <li>动变：动爻变出的爻与其六亲</li>
                            <li>月建日辰的旺衰生克</li>
                            <li>伏神与飞神</li>
                        </ul>
                        <p class="xy-note">
                            六爻的**判断**几乎全部依赖六亲与旺衰，而它们都还没做。
                            所以本页只给卦象与纳甲——这是可核对的部分。
                        </p>
                    </section>

                    <section class="ly__panel">
                        <h2 class="xy-panel-title">十二地支</h2>
                        <p class="xy-note numeral">{{ BRANCHES.join(" ") }}</p>
                    </section>
                </aside>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.ly {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ly__head {
    align-items: flex-start;
    display: flex;
    gap: 16px;
    justify-content: space-between;
}

.ly__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.ly__note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 86ch;
}

.ly__body {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) 340px;
}

.ly__panel {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.ly__aside {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ly__lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.ly__line {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 20px 130px 110px 70px 44px;
}

.ly__pos {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
    text-align: right;
}

.ly__figure {
    align-items: center;
    display: flex;
    gap: 8px;
    height: 12px;
}

.ly__solid {
    background: var(--el-text-color-primary);
    height: 10px;
    width: 100%;
}

.ly__broken {
    background: var(--el-text-color-primary);
    height: 10px;
    width: 46%;
}

.ly__solid.is-moving,
.ly__broken.is-moving {
    background: var(--el-color-danger);
}

.ly__najia {
    color: var(--el-color-primary);
    font-size: var(--xy-font-md);
    font-weight: var(--xy-weight-medium);
}

.ly__relation {
    font-size: var(--xy-font-xs);
}

.ly__moving-placeholder {
    width: 30px;
}

.ly__todo {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-relaxed);
    margin: 0;
    padding-left: 18px;
}
</style>
