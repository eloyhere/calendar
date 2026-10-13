<script setup lang="ts">
/**
 * 导出（`/data/export`）：**本项目唯一用向导的地方**。
 *
 * ## 为什么这里可以用向导，别处不行
 *
 * `docs/ui-architecture.md` §2.3 第 13 条引 NN/g 的判据：
 * "**把向导用于新手用户或不常做的流程（例如配置与设置）**"。
 * 同一段还逐条列了向导的五个缺点——交互成本更高、**用户难以跨步骤转移或比较信息**、
 * **无法优雅中断**、可能阻塞应用的其他部分、限制用户的控制与创造力。
 *
 * 导出落在"低频 + 步骤有依赖（选库 → 选表 → 选列 → 选格式 → 导出）"那一侧，
 * 五个缺点在这里都不致命；而画布类工作（历法浏览、工作流编排）是高频且要跨步参照的，
 * 用向导就会踩满那五条。**这是判据，不是偏好。**
 *
 * ## 导出的边界
 *
 * 渲染进程没有写文件的权限（`node:sqlite` 在只读连接上跑，见 `main/database.ts`）。
 * 导出走的是 **dsh-os 的 `file.create` 动词**——它是 `mutating`，所以要 `allow`。
 * 于是"导出"这件事天然带一个授权面：用户点"导出"时明确知道要写一个文件，
 * 而不是某个后台操作悄悄落盘（HAX **G16 传达用户行为的后果**）。
 *
 * 文件路径要用户填：本应用不替用户选目录。默认值给当前工作目录下的一个文件名，
 * 用户可以改。
 */

import { computed, ref, watch } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import { queryModule } from "../../datasource/runner";
import type { Row } from "../../datasource/sqlite";
import { formatCount, useModuleStates, useTableColumns } from "../../state/use-calendar-query";

const { states } = useModuleStates();

/** 向导的当前步。 */
const step = ref(0);

/** 第一步：选库与表。 */
const module = ref("dynasty");
const table = ref("dynasty");

const tables = computed(() => states.value.find((item) => item.name === module.value)?.tables ?? []);

const { columns } = useTableColumns(module, table);

/** 第二步：选列。默认全选。 */
const picked = ref<string[]>([]);

/** 换表时把列全选上。 */
watch(
    columns,
    (list) => {
        picked.value = list.map((item) => item.name);
    },
    { immediate: true }
);

/** 第三步：格式与路径。 */
const format = ref<"csv" | "json">("csv");
const target = ref("");

/** 默认路径：当前工作目录下的一个文件名。用户可以改，但不必自己想名字。 */
watch(
    [module, table],
    ([currentModule, currentTable]) => {
        target.value = `./export-${currentModule}-${currentTable}.${format.value}`;
    },
    { immediate: true }
);

watch(format, (value) => {
    target.value = target.value.replace(/\.(csv|json)$/, `.${value}`);
});

/** 行数预览（前 100 行做导出——界面内导出不搬几百万行）。 */
const Limit = 100;
const preview = ref<Row[]>([]);
const busy = ref(false);
const message = ref("");
const failure = ref("");

/** 生成导出内容。 */
const content = computed(() => {
    const rows = preview.value;
    if (rows.length === 0) {
        return "";
    }
    const names = picked.value.length > 0 ? picked.value : columns.value.map((item) => item.name);

    if (format.value === "json") {
        return JSON.stringify(
            rows.map((row) => {
                const out: Record<string, string> = {};
                for (const name of names) {
                    const value = row[name];
                    out[name] = value === null || value === undefined ? "" : String(value);
                }
                return out;
            }),
            null,
            2
        );
    }

    /** CSV：表头 + 行。字段里有逗号或引号时按 RFC 4180 加引号。 */
    const escape = (text: string): string =>
        /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;

    const lines = [names.join(",")];
    for (const row of rows) {
        lines.push(
            names
                .map((name) => {
                    const value = row[name];
                    return escape(value === null || value === undefined ? "" : String(value));
                })
                .join(",")
        );
    }
    return lines.join("\n");
});

/** 第二步：跑一次预览查询，读出要导出的行。 */
const load = async (): Promise<void> => {
    busy.value = true;
    failure.value = "";
    try {
        const names = picked.value.length > 0 ? picked.value : ["*"];
        const projection = names.includes("*") ? "*" : names.map((name) => `"${name}"`).join(", ");
        preview.value = await queryModule(
            module.value,
            `SELECT ${projection} FROM "${table.value}" LIMIT ${Limit}`
        );
        message.value = `读到 ${preview.value.length} 行（上限 ${Limit} 行）`;
    } catch (error) {
        failure.value = error instanceof Error ? error.message : String(error);
        preview.value = [];
    } finally {
        busy.value = false;
    }
};

/** 第三步：写文件。走 dsh-os 的 `file.create`，它是写操作，要 `allow`。 */
const write = async (): Promise<void> => {
    if (content.value.length === 0) {
        failure.value = "还没有内容可写：先回到上一步取一次数据。";
        return;
    }

    busy.value = true;
    failure.value = "";
    message.value = "";

    const result = await window.desktop.os.invoke({
        verb: "file.create",
        args: [target.value, content.value, "utf-8"],
        // 写操作必须显式点头：`file.create` 在动词表里 `mutating: true`，
        // 缺 `--allow` 时命令层会回 E_PERMISSION 信封。
        allow: true
    });

    busy.value = false;

    if (result.ok) {
        message.value = `已写出 ${target.value}（${content.value.length} 字节）`;
        return;
    }
    failure.value =
        result.envelope?.error?.message ??
        result.note ??
        `写出失败（退出码 ${result.exitCode ?? "null"}），见下方原文`;
};

/** 上一步 / 下一步。 */
const next = async (): Promise<void> => {
    if (step.value === 1) {
        await load();
    }
    step.value = Math.min(step.value + 1, 2);
};

const back = (): void => {
    step.value = Math.max(step.value - 1, 0);
};
</script>

<template>
    <div class="export">
        <ElSteps :active="step" align-center finish-status="success" class="export__steps">
            <ElStep title="选数据" description="分库与表" />
            <ElStep title="选列" description="要带走的列" />
            <ElStep title="导出" description="格式与路径" />
        </ElSteps>

        <ElScrollbar class="export__body">
            <!-- 第一步：库与表。先问"要什么"，再问细节（表单降负荷的 Dependency 原则） -->
            <div v-if="step === 0" class="xy-panel">
                <h2 class="xy-panel-title">要导出哪个分库、哪张表</h2>
                <ElForm label-width="80px" label-position="left">
                    <ElFormItem label="分库">
                        <ElSelect v-model="module" class="export__field">
                            <ElOption
                                v-for="item in states"
                                :key="item.name"
                                :label="`${item.label}（${item.name}）· ${item.rows === null ? '—' : formatCount(item.rows)} 行`"
                                :value="item.name" />
                        </ElSelect>
                    </ElFormItem>
                    <ElFormItem label="表">
                        <ElSelect v-model="table" class="export__field">
                            <ElOption v-for="name in tables" :key="name" :label="name" :value="name" />
                        </ElSelect>
                    </ElFormItem>
                </ElForm>
                <p class="xy-note">
                    导出的是当前分库当前表的前 100 行。要几百万行的全量导出，
                    用 <code>database/combine.py</code> 合并成全库之后在命令行做——
                    界面里搬一亿行没有意义。
                </p>
            </div>

            <!-- 第二步：列。默认全选 -->
            <div v-else-if="step === 1" class="xy-panel">
                <h2 class="xy-panel-title">要带哪些列</h2>
                <ElCheckboxGroup v-model="picked" class="export__columns">
                    <ElCheckbox v-for="column in columns" :key="column.name" :value="column.name">
                        <span class="numeral">{{ column.name }}</span>
                    </ElCheckbox>
                </ElCheckboxGroup>
                <p class="xy-note">默认全选。取消勾选就少带一列——列名会在下一步的预览里核对。</p>
            </div>

            <!-- 第三步：格式、路径、执行 -->
            <div v-else class="xy-panel">
                <h2 class="xy-panel-title">格式与路径</h2>
                <ElForm label-width="80px" label-position="left">
                    <ElFormItem label="格式">
                        <ElRadioGroup v-model="format">
                            <ElRadioButton value="csv">CSV</ElRadioButton>
                            <ElRadioButton value="json">JSON</ElRadioButton>
                        </ElRadioGroup>
                    </ElFormItem>
                    <ElFormItem label="写到">
                        <ElInput v-model="target" class="export__field numeral" placeholder="./export.csv" />
                    </ElFormItem>
                </ElForm>

                <!--
                    后果前置：写文件是 mutating 动词，要显式授权。
                    HAX G16 要求"传达用户行为的后果"，所以这里把"会写一个文件、写在哪"
                    在按钮之前说清楚，而不是点完再看结果。
                -->
                <ElAlert
                    type="warning"
                    :closable="false"
                    show-icon
                    title="这一步会写文件"
                    :description="`即将用 dsh-os 的 file.create 写出 ${target}（${content.length} 字节）。写操作需要显式授权，所以下面那颗按钮就是你的点头。`" />

                <div class="export__actions">
                    <ElButton type="primary" :loading="busy" @click="write">
                        <AppIcon name="Download" />
                        <span>导出到 {{ target }}</span>
                    </ElButton>
                </div>

                <p v-if="message.length > 0" class="xy-note export__ok" role="status" aria-live="polite">
                    {{ message }}
                </p>
                <ElAlert
                    v-if="failure.length > 0"
                    type="error"
                    :closable="false"
                    show-icon
                    title="导出没有完成"
                    :description="failure" />
            </div>
        </ElScrollbar>

        <footer class="export__foot">
            <ElButton :disabled="step === 0" @click="back">上一步</ElButton>
            <ElButton v-if="step < 2" type="primary" :loading="busy" @click="next">下一步</ElButton>
        </footer>
    </div>
</template>

<style scoped>
.export {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.export__steps {
    flex-shrink: 0;
}

.export__body {
    flex: 1;
    min-height: 0;
}

.export__field {
    width: 360px;
}

.export__columns {
    display: grid;
    gap: 4px 16px;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.export__actions {
    margin-top: 14px;
}

.export__ok {
    color: var(--el-color-success);
}

.export__foot {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
    justify-content: flex-end;
}
</style>
