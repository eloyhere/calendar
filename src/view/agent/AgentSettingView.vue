<script setup lang="ts">
/**
 * 智能体设置：品牌（厂商）+ 模型 + API Key + 预设。
 *
 * ## 为什么这是一页，而不是一个弹窗
 *
 * 它有三组互相牵连的东西：厂商 → 该厂商的模型列表 → 用哪个模型。
 * 塞进弹窗会让"换一个厂商看看它有哪些模型"这个过程反复关闭—打开。
 * 独立成页之后，左列厂商、中列模型、右列预设与密钥，三件事同时可见。
 *
 * ## API Key 存在哪里
 *
 * **不进渲染进程的状态、不进 localStorage、不进 Redux/Pinia 的持久化。**
 * 本页只把用户输入的那一串交给主进程，由主进程用 Electron 的 `safeStorage`
 * （Windows 上是 DPAPI，绑定当前用户账户）加密后写进用户数据目录，
 * 渲染进程此后只能拿到"有没有配、配的是哪家的哪个前缀"，拿不回明文。
 *
 * 这不是本项目自创的规矩：Electron 官方安全清单明确要求
 * "不要在前端存储密钥"，而 `safeStorage` 是它给出的方案。见
 * <https://www.electronjs.org/docs/latest/api/safe-storage>。
 *
 * ## 预设
 *
 * "预设"= 一组（品牌 + 模型 + 参数）的命名组合。用户在对话页要切的是**用途**
 * （"快速问答" / "深度推理" / "长文写作"），不是型号名。型号会过时，
 * 用途不会——这是给设置页减负的主要手段。
 */

import { computed, ref } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { AGENT_PRESETS, AGENT_VENDORS, vendorOf } from "../../entity/agent";
import { useAgentStore } from "../../store/agent.store";

const agent = useAgentStore();

/** 当前编辑的品牌。 */
const vendorId = ref(agent.selectedVendor);

/** 当前输入框里的密钥（只在内存里活到点"保存"为止）。 */
const keyDraft = ref("");

/** 当前选中的预设。 */
const presetId = ref(agent.selectedPreset);

/** 当前品牌。 */
const vendor = computed(() => vendorOf(vendorId.value));

/** 这个品牌已经配了密钥没有。 */
const hasKey = computed(() => agent.hasKey(vendorId.value));

/** 当前选中的模型（用于在选择器下方显示它的定位说明）。 */
const pickedModel = computed(() => vendor.value?.models.find((item) => item.id === agent.selectedModel));

/** 当前选中的预设。 */
const pickedPreset = computed(() => AGENT_PRESETS.find((item) => item.id === presetId.value));

/** 选择品牌时清空输入框——把 A 家的键粘到 B 家是最常见的一类错误。 */
const pickVendor = (id: string): void => {
    vendorId.value = id;
    keyDraft.value = "";
};

/** 保存密钥。只传出去，不留下来。 */
const saveKey = (): void => {
    if (keyDraft.value.trim().length === 0) {
        return;
    }
    agent.saveKey(vendorId.value, keyDraft.value.trim());
    keyDraft.value = "";
};

/** 撤销密钥。 */
const clearKey = (): void => {
    agent.clearKey(vendorId.value);
};

/** 选中预设。 */
const pickPreset = (id: string): void => {
    presetId.value = id;
    agent.selectPreset(id);
};
</script>

<template>
    <PageShell :state="'ready'" :card="false" :scroll="false">
        <div class="setting">
            <header class="setting__head">
                <div>
                    <h1 class="setting__title">智能体设置</h1>
                    <p class="setting__sub">
                        品牌决定去哪儿取模型；预设决定"什么时候用哪个模型"。
                        API Key 由主进程加密保管，界面只显示配没配。
                    </p>
                </div>
                <div class="setting__current">
                    <span class="xy-dim">当前</span>
                    <ElTag type="primary" effect="plain" size="small">
                        {{ vendorOf(agent.selectedVendor)?.label ?? "未选" }}
                    </ElTag>
                    <ElTag effect="plain" size="small" class="numeral">{{ agent.selectedModel }}</ElTag>
                </div>
            </header>

            <div class="setting__body">
                <!-- ① 品牌 -->
                <section class="setting__col">
                    <h2 class="xy-panel-title">品牌</h2>
                    <p class="xy-note setting__col-note">
                        都是 OpenAI 兼容接口的走同一套调用；本地推理（Ollama / LM Studio）
                        不需要密钥。
                    </p>

                    <!--
                        品牌：**选择器**，不是按钮列表。
                        12 个品牌竖排要占满一列且要滚；选择器一行，
                        而且键盘输入能直接过滤（打两个字母就跳到位）。
                        密钥状态写在选项文案里——那是"选之前要看的"信息。
                    -->
                    <ElSelect
                        :model-value="vendorId"
                        class="setting__select"
                        filterable
                        @update:model-value="(value: string | number | boolean | undefined) => pickVendor(String(value))">
                        <ElOption
                            v-for="item in AGENT_VENDORS"
                            :key="item.id"
                            :value="item.id"
                            :label="item.label">
                            <span class="setting__option">
                                <span class="setting__option-name">{{ item.label }}</span>
                                <span class="setting__option-meta">
                                    {{ item.local ? "本地" : agent.hasKey(item.id) ? "已配密钥" : "未配密钥" }}
                                </span>
                            </span>
                        </ElOption>
                    </ElSelect>
                </section>

                <!-- ② 模型 + 密钥 -->
                <section class="setting__col setting__col--wide">
                    <h2 class="xy-panel-title">{{ vendor?.label ?? "模型" }}</h2>

                    <template v-if="vendor !== undefined">
                        <p class="xy-note setting__col-note">{{ vendor.note }}</p>

                        <ElForm label-width="94px" label-position="left" class="setting__form">
                            <ElFormItem label="接口地址">
                                <ElInput
                                    :model-value="vendor.baseUrl"
                                    readonly
                                    class="numeral"
                                    placeholder="由品牌决定">
                                    <template #append>
                                        <ElTooltip content="复制" placement="top">
                                            <AppIcon name="DocumentCopy" />
                                        </ElTooltip>
                                    </template>
                                </ElInput>
                            </ElFormItem>

                            <ElFormItem label="API Key">
                                <div class="setting__key">
                                    <ElInput
                                        v-model="keyDraft"
                                        type="password"
                                        show-password
                                        :disabled="vendor.local"
                                        :placeholder="
                                            vendor.local
                                                ? '本地推理不需要密钥'
                                                : hasKey
                                                  ? '已保存（重新输入可覆盖）'
                                                  : vendor.keyHint
                                        " />
                                    <ElButton
                                        type="primary"
                                        :disabled="vendor.local || keyDraft.trim().length === 0"
                                        @click="saveKey">
                                        保存
                                    </ElButton>
                                    <ElButton v-if="hasKey" @click="clearKey">撤销</ElButton>
                                </div>
                            </ElFormItem>

                            <ElFormItem label="获取密钥">
                                <ElLink :href="vendor.consoleUrl" type="primary" target="_blank">
                                    {{ vendor.consoleLabel }}
                                    <AppIcon name="Top" />
                                </ElLink>
                            </ElFormItem>
                        </ElForm>

                        <h3 class="setting__sub-title">模型</h3>
                        <p class="xy-note setting__col-note">
                            列表来自品牌登记表。实际可用性以厂商控制台为准——
                            这里不给"测试连接"，因为一次成功的握手不能证明
                            该模型在你的账号下可用，那种绿勾会误导人。
                        </p>

                        <!-- 模型：选择器。档位与 id 写在选项里，定位说明在下面单独显示 -->
                        <ElSelect
                            :model-value="agent.selectedModel"
                            class="setting__select"
                            filterable
                            @update:model-value="(value: string | number | boolean | undefined) => agent.selectModel(String(value))">
                            <ElOption
                                v-for="model in vendor.models"
                                :key="model.id"
                                :value="model.id"
                                :label="`${model.label}（${model.tier}）`">
                                <span class="setting__option">
                                    <span class="setting__option-name">{{ model.label }}</span>
                                    <span class="setting__option-meta">{{ model.tier }} · {{ model.id }}</span>
                                </span>
                            </ElOption>
                        </ElSelect>

                        <!-- 选中模型的定位说明：它是"选之前要读的"，所以放在选择器正下方 -->
                        <p v-if="pickedModel !== undefined" class="xy-note setting__model-note">
                            {{ pickedModel.note }}
                        </p>
                    </template>
                </section>

                <!-- ③ 预设 -->
                <section class="setting__col">
                    <h2 class="xy-panel-title">预设</h2>
                    <p class="xy-note setting__col-note">
                        预设是一组"品牌 + 模型 + 参数"的命名组合。对话页切的是**用途**，
                        不是型号——型号会过时，用途不会。
                    </p>

                    <!--
                        预设：选择器。
                        预设是"一组（品牌 + 模型 + 参数）的命名组合"，用户在对话页切的是
                        **用途**而不是型号——所以选项文案给"用途"，型号放在下面一行显示。
                    -->
                    <ElSelect
                        :model-value="presetId"
                        class="setting__select"
                        @update:model-value="(value: string | number | boolean | undefined) => pickPreset(String(value))">
                        <ElOption
                            v-for="preset in AGENT_PRESETS"
                            :key="preset.id"
                            :value="preset.id"
                            :label="preset.label">
                            <span class="setting__option">
                                <span class="setting__option-name">{{ preset.label }}</span>
                                <span class="setting__option-meta">{{ preset.useFor }}</span>
                            </span>
                        </ElOption>
                    </ElSelect>

                    <p v-if="pickedPreset !== undefined" class="xy-note setting__model-note">
                        {{ pickedPreset.useFor }}<br />
                        <span class="numeral">{{ pickedPreset.vendor }} · {{ pickedPreset.model }}</span>
                    </p>
                </section>
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.setting {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
}

.setting__head {
    align-items: flex-start;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--xy-hairline);
    display: flex;
    flex-shrink: 0;
    gap: 16px;
    justify-content: space-between;
    padding: 14px 16px;
}

.setting__title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-xl);
    font-weight: var(--xy-weight-semibold);
    margin: 0;
}

.setting__sub {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-xs);
    line-height: var(--xy-leading-snug);
    margin: 4px 0 0;
    max-width: 62ch;
}

.setting__current {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 6px;
}

.setting__body {
    display: flex;
    flex: 1;
    gap: 12px;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
}

.setting__col {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-lg);
    flex-shrink: 0;
    padding: 14px;
    width: 300px;
}

.setting__col--wide {
    flex: 1;
    min-width: 0;
    width: auto;
}

.setting__col-note {
    margin-bottom: 12px;
}

/* 选择器占满所在列 */
.setting__select {
    width: 100%;
}

/*
 * 选项内部：左边是名字、右边是附注（密钥状态 / 档位 / 用途）。
 *
 * 附注用 placeholder 色且字号更小——它是**辅助信息**，
 * 抢了名字的注意力会让下拉难扫。
 */
.setting__option {
    align-items: baseline;
    display: flex;
    gap: 10px;
    justify-content: space-between;
}

.setting__option-name {
    color: var(--el-text-color-primary);
}

.setting__option-meta {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

/* 选中模型 / 预设的说明文字 */
.setting__model-note {
    margin-top: 6px;
}

.setting__vendor {
    align-items: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--xy-radius-md);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    padding: 8px 10px;
    text-align: left;
    width: 100%;
}

.setting__vendor:hover {
    background: var(--el-fill-color-light);
}

.setting__vendor.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-5);
}

.setting__vendor-name {
    color: var(--el-text-color-regular);
    font-size: var(--xy-font-sm);
}

.setting__form {
    margin-bottom: 8px;
}

.setting__key {
    display: flex;
    gap: 8px;
    width: 100%;
}

.setting__sub-title {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-sm);
    font-weight: var(--xy-weight-semibold);
    margin: 18px 0 6px;
}

.setting__models {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
}

.setting__model {
    background: var(--el-bg-color);
    border: 1px solid var(--xy-hairline);
    border-radius: var(--xy-radius-md);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 11px;
    text-align: left;
}

.setting__model:hover {
    border-color: var(--el-color-primary-light-5);
}

.setting__model.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
}

.setting__model-head {
    align-items: center;
    display: flex;
    gap: 6px;
    justify-content: space-between;
}

.setting__model-name {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-sm);
    font-weight: var(--xy-weight-medium);
}

.setting__model-id {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}

.setting__model-note {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-2xs);
    line-height: var(--xy-leading-snug);
    margin: 0;
}

.setting__preset {
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--xy-radius-md);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    text-align: left;
    width: 100%;
}

.setting__preset:hover {
    background: var(--el-fill-color-light);
}

.setting__preset.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-5);
}

.setting__preset-name {
    color: var(--el-text-color-primary);
    font-size: var(--xy-font-sm);
    font-weight: var(--xy-weight-medium);
}

.setting__preset-use {
    color: var(--el-text-color-secondary);
    font-size: var(--xy-font-2xs);
}

.setting__preset-model {
    color: var(--el-text-color-placeholder);
    font-size: var(--xy-font-2xs);
}
</style>
