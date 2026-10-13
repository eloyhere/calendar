<script setup lang="ts">
/**
 * 时间输入：命理六页共用的那一套。
 *
 * ## 为什么要统一
 *
 * `docs/ui-architecture.md` §6.5 的第 1 条要求：**所有排盘的输入沿用同一套时间输入组件**，
 * 且"公历 / 农历 / 年号 / 干支"四模式要**记住上次选择 + 显式切换**，不平铺四个等价选项。
 *
 * 依据是两条：
 *
 * - §2.2 第 8 条（一致性）：同一件事在六页里必须长一样，否则用户每换一页就要重学一遍；
 * - §2.2 第 4 条（Hick 定律）：四种时间表达是"高 n 决策"，应当给推荐模式（记住上次）
 *   加一个显式切换，而不是每次让用户从四个等价选项里挑。
 *
 * ## 视点写进状态栏
 *
 * 选完时刻之后要写 `shell.store` 的 `point`——状态栏中间那一段靠它显示
 * "现在用的是哪套时间模型"（§5.4）。这样用户在历法 / 年表 / 命理之间切换时，
 * **视点不丢**：他一直在看同一时刻，只是换了种表达。
 *
 * ## 农历 / 干支的换算还没实现
 *
 * 目前只有公历输入是真的（`<input type="datetime-local">`），
 * 另外三个模式会说明"换算待实现"而不是编一个看起来对的日期——
 * `docs/research.md` §5 立过这条规矩：占位内容必须让人一眼看出是占位。
 */

import { computed, ref } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { useShellStore } from "../../store/shell.store";

const shell = useShellStore();

/** 四种时间表达。值与 `docs/design.md` 的实体对应。 */
const Modes = [
    { id: "gregorian", label: "公历", icon: "Sunny", hint: "proleptic 格里高利历，允许 0 年与负数年" },
    { id: "calendar", label: "本历", icon: "Guide", hint: "以建元 -2696-03-11 为起点的轩辕历" },
    { id: "era", label: "年号", icon: "Collection", hint: "朝代 + 年号 + 年序，如「贞观四年」" },
    { id: "sexagenary", label: "干支", icon: "Connection", hint: "六十甲子，如「庚寅年 己卯月」" }
] as const;

type ModeId = (typeof Modes)[number]["id"];

/**
 * 当前模式。
 *
 * **记住上次选择**：存在 `localStorage`，跨页面与会话都保留。
 * 这是 §2.2 第 4 条要求的"默认给推荐模式"的落点。
 */
const StorageKey = "calendar.numerology.time-mode.v1";

const mode = ref<ModeId>((localStorage.getItem(StorageKey) as ModeId | null) ?? "gregorian");

const pick = (id: ModeId): void => {
    mode.value = id;
    localStorage.setItem(StorageKey, id);
};

/** 公历输入值。 */
const gregorian = ref("");

/** 当前模式的说明。 */
const hint = computed(() => Modes.find((item) => item.id === mode.value)?.hint ?? "");

/** 公历是否可用（另外三个模式的换算法则还没实现）。 */
const convertible = computed(() => mode.value === "gregorian");

/**
 * 提交：把选定的时刻写进状态栏的视点。
 *
 * `absolute` 暂时留 `null`：`jdn(时刻) - jdn(建元) + 1` 的换算需要一个历法换算模块，
 * 而它还没写（见 `src/temporal/` 下的接口定义）。写一个假的 `absolute` 比留空更糟——
 * 状态栏会显示一个不对的时刻，而用户没有理由怀疑它。
 */
const apply = (): void => {
    if (gregorian.value.length === 0) {
        return;
    }
    shell.setPoint({
        absolute: null,
        gregorian: gregorian.value.replace("T", " "),
        calendar: null,
        sexagenary: null,
        from: "命理 · 时间输入"
    });
};

/** 清空视点。 */
const clear = (): void => {
    gregorian.value = "";
    shell.setPoint({ absolute: null, gregorian: null, calendar: null, sexagenary: null, from: null });
};
</script>

<template>
    <div class="time-input">
        <!-- 模式切换：一个分段控件，不平铺四个等价选项 -->
        <ElSegmented
            :model-value="mode"
            :options="Modes.map((item) => ({ label: item.label, value: item.id }))"
            @update:model-value="(value: string | number | boolean) => pick(String(value) as ModeId)" />

        <p class="xy-dim time-input__hint">
            <AppIcon :name="Modes.find((item) => item.id === mode)?.icon ?? 'Sunny'" />
            {{ hint }}
        </p>

        <div class="time-input__row">
            <input
                v-if="convertible"
                v-model="gregorian"
                class="time-input__field numeral"
                type="datetime-local"
                aria-label="公历时刻"
                @change="apply" />

            <!--
                未实现的三个模式：给一句实话，不给一个看起来能用的输入框。
                `ElAlert` 而不是禁用输入框——禁用的控件不解释自己为什么禁用。
            -->
            <ElAlert
                v-else
                type="info"
                :closable="false"
                show-icon
                title="这个表达的换算法则还没实现"
                :description="`${hint}。实体与分库已经就位，缺的是换算函数；在那之前请用公历输入。`" />

            <ElButton v-if="convertible" type="primary" :disabled="gregorian.length === 0" @click="apply">
                设为当前视点
            </ElButton>
            <ElButton v-if="shell.point.from !== null" text @click="clear">清空</ElButton>
        </div>

        <!-- 当前视点回显：与状态栏是同一个数据源，不另存一份 -->
        <p v-if="shell.point.from !== null" class="xy-note time-input__point" role="status" aria-live="polite">
            当前视点：{{ shell.pointText }}
            <span class="xy-dim">（{{ shell.point.from }}）</span>
        </p>
    </div>
</template>

<style scoped>
.time-input {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.time-input__hint {
    align-items: center;
    display: flex;
    gap: 6px;
    margin: 0;
}

.time-input__row {
    align-items: center;
    display: flex;
    gap: 8px;
}

.time-input__field {
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    color: var(--el-text-color-regular);
    font-size: 14px;
    height: 32px;
    padding: 0 10px;
    width: 240px;
}

.time-input__field:focus-visible {
    border-color: var(--el-color-primary);
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 1px;
}

.time-input__point {
    margin: 0;
}
</style>
