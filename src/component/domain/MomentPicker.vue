<script setup lang="ts">
/**
 * 起课输入：一个时刻 + 一个地点 + 两条口径。
 *
 * ## 为什么口径是输入的一部分
 *
 * 研究里命理软件最集中的抱怨是"**它悄悄替我选了一个规则**，而我不知道是哪个"：
 * 真太阳时校不校、子时怎么换日、闰月怎么标。这些选择会改变排出来的盘，
 * 所以它们必须是**看得见的输入**，不是藏在设置里的选项。
 *
 * 所以这一栏把三件事并排放在同一行，任何一项改了，下面的"口径"立刻跟着变。
 *
 * ## 一处输入，处处可用
 *
 * 六种数术、四张命理盘共用同一份输入（`state/use-moment.ts` 的共享状态）。
 * 用户在八字页输完时刻，切到六爻不该重输——研究里被夸的正是这一点。
 */

import { computed } from "vue";

import type { MomentInput } from "../../state/use-moment";
import AppIcon from "../AppIcon.vue";

interface Props {
    /** 输入（`v-model`） */
    modelValue: MomentInput;
    /** 派生出的口径说明；还没算出来时为空数组 */
    notes?: readonly { label: string; value: string }[];
}

const props = withDefaults(defineProps<Props>(), { notes: () => [] });

const emit = defineEmits<{
    "update:modelValue": [value: MomentInput];
}>();

/** 改一个字段。 */
const set = <K extends keyof MomentInput>(field: K, value: MomentInput[K]): void => {
    emit("update:modelValue", { ...props.modelValue, [field]: value });
};

/** 表单里的年（`ElInputNumber` 只吃数字）。 */
const year = computed({
    get: () => props.modelValue.year,
    set: (value: number | undefined) => set("year", Math.trunc(value ?? 2000))
});

const month = computed({
    get: () => props.modelValue.month,
    set: (value: number | undefined) => set("month", Math.min(12, Math.max(1, Math.trunc(value ?? 1))))
});

const day = computed({
    get: () => props.modelValue.day,
    set: (value: number | undefined) => set("day", Math.min(31, Math.max(1, Math.trunc(value ?? 1))))
});

/**
 * 时间。`ElTimePicker` 给的是 `Date`，取它的时分即可——
 * 日期部分丢掉，因为这个控件只负责"几点几分"。
 */
const time = computed({
    get: () => {
        const date = new Date();
        date.setHours(props.modelValue.hour, props.modelValue.minute, 0, 0);
        return date;
    },
    set: (value: Date | null) => {
        if (value === null) {
            return;
        }
        emit("update:modelValue", {
            ...props.modelValue,
            hour: value.getHours(),
            minute: value.getMinutes()
        });
    }
});

/** 经度。`null` 表示不校真太阳时。 */
const longitude = computed({
    get: () => props.modelValue.longitude,
    set: (value: number | undefined) =>
        set("longitude", value === undefined || Number.isNaN(value) ? null : value)
});

/** 回到"此刻"。 */
const now = (): void => {
    const current = new Date();
    emit("update:modelValue", {
        ...props.modelValue,
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        day: current.getDate(),
        hour: current.getHours(),
        minute: current.getMinutes()
    });
};
</script>

<template>
    <div class="moment">
        <div class="moment__row">
            <ElInputNumber v-model="year" :min="-9999" :max="13500" :controls="false" class="moment__year" />
            <span class="moment__unit">年</span>

            <ElInputNumber v-model="month" :min="1" :max="12" :controls="false" class="moment__num" />
            <span class="moment__unit">月</span>

            <ElInputNumber v-model="day" :min="1" :max="31" :controls="false" class="moment__num" />
            <span class="moment__unit">日</span>

            <ElTimePicker v-model="time" format="HH:mm" :clearable="false" class="moment__time" />

            <ElButton text size="small" @click="now">
                <AppIcon name="Clock" />
                <span>此刻</span>
            </ElButton>
        </div>

        <div class="moment__row">
            <span class="moment__label">经度</span>
            <ElInputNumber
                v-model="longitude"
                :min="-180"
                :max="180"
                :precision="2"
                :controls="false"
                placeholder="东经为正，留空则不校真太阳时"
                class="moment__lon" />

            <span class="moment__label">性别</span>
            <ElRadioGroup
                :model-value="props.modelValue.gender"
                size="small"
                @update:model-value="(value: string | number | boolean | undefined) => set('gender', String(value) === 'female' ? 'female' : 'male')">
                <ElRadioButton value="male">男</ElRadioButton>
                <ElRadioButton value="female">女</ElRadioButton>
            </ElRadioGroup>

            <!--
                换日规则是**一句说明**，不是一组选项。

                一个时辰是两个整小时，子时就是 23:00–01:00。
                把 23:00–24:00 切出来当"早子时"、00:00–01:00 当"晚子时"，
                等于只把子时劈成两半，另外十一个时辰都不拆——
                同一条时间轴上只有它享受特殊待遇，这件事没有依据。
                所以规则唯一，写出来让用户能核对即可。
            -->
            <ElTooltip content="一个时辰两个整小时，子时不拆；23:00 起算次日" placement="top">
                <span class="moment__label">换日</span>
            </ElTooltip>
            <span class="moment__fixed">23:00 起算次日</span>
        </div>

        <!--
            口径行：把三项换算的**结果**写出来。
            这一行的价值在于"可核对"——用户看到 10:00 变成 07:50，就知道软件做了什么，
            而不是拿到一个无法验证的盘。
        -->
        <dl v-if="props.notes.length > 0" class="moment__notes">
            <div v-for="note in props.notes" :key="note.label" class="moment__note">
                <dt>{{ note.label }}</dt>
                <dd class="numeral">{{ note.value }}</dd>
            </div>
        </dl>
    </div>
</template>

<style scoped>
.moment {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
}

/* 两行控件并成一行：年月日时分与经度、性别、子时规则都是**短值**，
   分两行占的是纯高度。1440 宽下这一行放得下 */
.moment__row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

.moment__label {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    margin-left: 6px;
}

/* 固定的口径值：不是控件，所以不给它控件的观感 */
.moment__fixed {
    background: var(--el-fill-color-lighter);
    border-radius: var(--xy-radius-sm);
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-2xs);
    padding: 2px 8px;
}

.moment__unit {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-xs);
}

.moment__year {
    width: 78px;
}

.moment__num {
    width: 48px;
}

.moment__time {
    width: 92px;
}

.moment__lon {
    width: 88px;
}

.moment__notes {
    border-top: 1px dashed var(--xy-hairline);
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    padding-top: 6px;
}

.moment__note {
    align-items: baseline;
    display: flex;
    gap: 4px;
}

.moment__note dt {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

.moment__note dd {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-2xs);
    margin: 0;
}
</style>
