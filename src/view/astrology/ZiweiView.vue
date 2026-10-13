<script setup lang="ts">
/**
 * 紫微斗数：`/astrology/ziwei`。
 *
 * 十二宫的**框架**已按标准排法画出（固定宫位、顺时针地支），
 * 安星（十四主星、四化、六吉六煞）尚未实现——原因写在页面上的待办里。
 */

import { ref } from "vue";

import ChartScaffold from "../../component/domain/ChartScaffold.vue";
import { BRANCHES } from "../../share/calendar/sexagenary";
import type { MomentInput } from "../../state/use-moment";
import { defaultMomentInput, deriveMoment } from "../../state/use-moment";

const moment = ref<MomentInput>(defaultMomentInput());
const facts = ref<Awaited<ReturnType<typeof deriveMoment>>>(null);
const loading = ref(false);
const error = ref("");

const derive = async (): Promise<void> => {
    loading.value = true;
    try {
        facts.value = await deriveMoment(moment.value);
        error.value = "";
    } catch (cause) {
        error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
        loading.value = false;
    }
};

void derive();

/** 十二宫的固定地支顺序（寅起，顺时针）。 */
const PALACES = ["命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄", "迁移", "交友", "官禄", "田宅", "福德", "父母"];
</script>

<template>
    <ChartScaffold
        title="紫微斗数"
        note="十二宫的宫位与地支是固定的（寅宫起命宫，顺时针排十二宫）；命宫的落宫由生月与生时决定。下方的宫位格按标准排法画出，星曜尚未安入。"
        basis="紫微斗数全书"
        :moment="moment"
        :facts="facts"
        :loading="loading"
        :error="error"
        :todo="[
            '命宫与身宫的定位：需要「生月 + 生时」的固定表（寅起正月、子时起）',
            '十二宫顺时针安宫：宫位名随命宫落宫轮转',
            '十四主星安星：紫微系（紫微、天机、太阳…）按生日与五行局起紫微',
            '四化（化禄 / 化权 / 化科 / 化忌）：按生年天干取',
            '六吉六煞与杂曜',
            '大限与流年：大限起运岁数按五行局定'
        ]"
        @update:moment="
            (value: MomentInput) => {
                moment = value;
                void derive();
            }
        ">
        <section class="ziwei">
            <h2 class="xy-panel-title">十二宫（框架）</h2>
            <p class="xy-note">
                这是**宫位骨架**，不是排盘结果。地支位置是固定的；宫名要等命宫定下来才能轮转，
                而命宫定位属于待办第一项。画出来的意义是让用户看清"盘面是十二格"这件事，
                以及地支的排列方向。
            </p>

            <div class="ziwei__grid">
                <div v-for="(branch, index) in BRANCHES" :key="branch" class="ziwei__cell">
                    <span class="ziwei__branch">{{ branch }}</span>
                    <span class="ziwei__palace xy-dim">{{ PALACES[index] }}</span>
                    <span class="ziwei__empty xy-dim">未安星</span>
                </div>
            </div>
        </section>
    </ChartScaffold>
</template>

<style scoped>
.ziwei {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    padding: 12px 14px;
}

.ziwei__grid {
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(4, 1fr);
    margin-top: 10px;
}

.ziwei__cell {
    align-items: center;
    aspect-ratio: 1;
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
}

.ziwei__branch {
    color: var(--el-color-primary);
    font-size: var(--xy-font-2xl);
    font-weight: var(--xy-weight-semibold);
}

.ziwei__palace {
    font-size: var(--xy-font-xs);
}

.ziwei__empty {
    border-top: 1px dashed var(--xy-hairline);
    font-size: var(--xy-font-2xs);
    padding-top: 3px;
}
</style>
