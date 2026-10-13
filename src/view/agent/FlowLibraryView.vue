<script setup lang="ts">
/**
 * 工作流定义库（`/agent/flow`）。
 *
 * ## 这一页的任务
 *
 * `docs/ui-architecture.md` §7.2 给它的定位是"我要跑哪个 / 我要新建"——
 * 高频、短停留。所以它是**列表**，不是画布。
 *
 * ## 依据
 *
 * | 设计                     | 依据                                                          |
 * | ------------------------ | ------------------------------------------------------------- |
 * | 用列表而不是画布          | §2.3 第 13 条：向导 / 画布按**频率**分流；列表页只做选择        |
 * | 表格首列是人类可读的名字   | §2.4 第 5 条（NN/g：首列应是可读标识，不是 mystery meat ID）   |
 * | 状态用文字 + 标签双通道   | WCAG **1.4.1**（颜色不能是唯一手段）                            |
 * | 步骤数 / 上次运行直排数字 | §2.4 第 4 条（长度与位置适合定量表达）                          |
 * | 空态说明"下一步做什么"     | §2.3 第 7 条（错误文案要说发生了什么 + 下一步）                 |
 */

import { computed } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import { useRouter } from "../../plugin";
import { relativeTime } from "../../entity/chat";
import { useFlowStore } from "../../store/flow.store";

const router = useRouter();
const flow = useFlowStore();

/** 列表行。 */
interface Row {
    id: string;
    name: string;
    description: string;
    steps: number;
    version: number;
    updatedAt: number;
    variables: number;
    lastOutcome: string;
    lastRunAt: number | null;
}

/** 按最近修改排序列出全部定义，附上"上次运行"。 */
const rows = computed<Row[]>(() =>
    flow.ordered.map((definition) => {
        const last = flow.lastRunOf(definition.id);
        return {
            id: definition.id,
            name: definition.name,
            description: definition.description,
            steps: definition.steps.length,
            version: definition.version,
            updatedAt: definition.updatedAt,
            variables: definition.variables.length,
            lastOutcome: last?.outcome ?? "从未运行",
            lastRunAt: last?.startedAt ?? null
        };
    })
);

/** 结局的中文与配色。两通道：文字 + 颜色。 */
const outcomeOf = (value: string): { text: string; tone: "success" | "danger" | "warning" | "info" } => {
    switch (value) {
        case "ok":
            return { text: "成功", tone: "success" };
        case "failed":
            return { text: "失败", tone: "danger" };
        case "cancelled":
            return { text: "已中断", tone: "warning" };
        case "running":
            return { text: "运行中", tone: "info" };
        default:
            return { text: "从未运行", tone: "info" };
    }
};

/** 新建并进编排器。 */
const create = (): void => {
    const definition = flow.create();
    void router.push(`/agent/flow/${definition.id}`);
};

/** 复制一条。 */
const duplicate = (id: string): void => {
    const copy = flow.duplicate(id);
    if (copy !== null) {
        void router.push(`/agent/flow/${copy.id}`);
    }
};

/** 导入旧版步骤表。 */
const importLegacy = (): void => {
    const imported = flow.importLegacy();
    if (imported !== null) {
        void router.push(`/agent/flow/${imported.id}`);
    }
};

/** 去编排器（那里能看到参数、变量与授权）。 */
const open = (id: string): void => {
    void router.push(`/agent/flow/${id}`);
};
</script>

<template>
    <PageShell
        :state="rows.length === 0 ? 'empty' : 'ready'"
        source="localStorage"
        empty-text="还没有工作流定义。点「新建工作流」开一条；如果之前用旧版的步骤表编过流程，点「导入旧步骤」把它接过来。"
        @retry="create">
        <div class="flow-library">
            <div class="flow-library__bar">
                <ElButton type="primary" @click="create">
                    <AppIcon name="Plus" />
                    <span>新建工作流</span>
                </ElButton>

                <ElButton v-if="flow.hasLegacy" @click="importLegacy">
                    <AppIcon name="Download" />
                    <span>导入旧步骤</span>
                </ElButton>

                <ElButton @click="$router.push('/agent/flow/run')">
                    <AppIcon name="List" />
                    <span>运行记录</span>
                </ElButton>

                <span class="flow-library__spring" />

                <span class="xy-dim">{{ rows.length }} 条定义</span>
            </div>

            <ElAlert
                type="info"
                :closable="false"
                show-icon
                title="运行前会看到什么"
                description="运行会调用 scripts/operation 的 dsh-os 命令层。写操作（写文件、改环境变量、操作窗口）在执行前会停下来请你确认，并在运行记录里留痕。"
                class="flow-library__hint" />

            <ElTable :data="rows" stripe class="flow-library__table">
                <ElTableColumn label="名字" min-width="220">
                    <template #default="{ row }">
                        <!--
                            首列是人类可读的名字，不是 id。
                            NN/g 的数据表准则（§2.4 第 5 条）："默认第一列应是人类可读的
                            记录标识，而不是自动生成的 mystery meat ID"。
                        -->
                        <button type="button" class="flow-library__name" @click="open(row.id)">
                            <AppIcon name="Connection" />
                            <span class="is-truncated">{{ row.name }}</span>
                        </button>
                        <p v-if="row.description" class="xy-dim flow-library__desc">{{ row.description }}</p>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="步骤" width="90" align="right">
                    <template #default="{ row }">
                        <span class="numeral">{{ row.steps }}</span>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="变量" width="90" align="right">
                    <template #default="{ row }">
                        <span class="numeral">{{ row.variables }}</span>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="版本" width="80" align="right">
                    <template #default="{ row }">
                        <span class="numeral xy-dim">v{{ row.version }}</span>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="上次运行" width="190">
                    <template #default="{ row }">
                        <ElTag :type="outcomeOf(row.lastOutcome).tone" size="small" effect="plain">
                            {{ outcomeOf(row.lastOutcome).text }}
                        </ElTag>
                        <span v-if="row.lastRunAt !== null" class="xy-dim flow-library__when">
                            {{ relativeTime(row.lastRunAt) }}
                        </span>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="修改于" width="130">
                    <template #default="{ row }">
                        <span class="xy-dim">{{ relativeTime(row.updatedAt) }}</span>
                    </template>
                </ElTableColumn>

                <ElTableColumn label="" width="160" align="right">
                    <template #default="{ row }">
                        <ElButton text size="small" @click="open(row.id)">
                            <AppIcon name="Edit" />
                            <span>编排</span>
                        </ElButton>
                        <ElButton text size="small" title="复制一份" @click="duplicate(row.id)">
                            <AppIcon name="DocumentCopy" />
                        </ElButton>
                        <ElPopconfirm
                            title="删掉这条定义？它的运行记录也会一起删。"
                            confirm-button-text="删"
                            cancel-button-text="算了"
                            @confirm="flow.remove(row.id)">
                            <template #reference>
                                <ElButton text size="small" type="danger" title="删除">
                                    <AppIcon name="Delete" />
                                </ElButton>
                            </template>
                        </ElPopconfirm>
                    </template>
                </ElTableColumn>
            </ElTable>

            <p class="xy-note">
                定义存在 <code>localStorage</code> 里（键
                <code>calendar.flow.definitions.v1</code>），所以重启还在。
                它还没有对应的表——<code>docs/design.md</code> 要求先改文档再改代码，
                等表结构定下来，持久化只改 store 一层。
            </p>
        </div>
    </PageShell>
</template>

<style scoped>
.flow-library {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.flow-library__bar {
    align-items: center;
    display: flex;
    gap: 8px;
}

/* "弹簧"：把计数推到最右 */
.flow-library__spring {
    flex: 1 1 auto;
}

.flow-library__hint {
    border-radius: 6px;
}

.flow-library__table {
    width: 100%;
}

/* 名字整块可点（Fitts 定律），不是只有文字可点 */
.flow-library__name {
    align-items: center;
    background: transparent;
    border: none;
    color: var(--el-color-primary);
    cursor: pointer;
    display: flex;
    font-size: 14px;
    gap: 6px;
    max-width: 100%;
    padding: 0;
    text-align: left;
}

.flow-library__name:hover {
    text-decoration: underline;
}

.flow-library__desc {
    margin: 2px 0 0;
}

.flow-library__when {
    margin-left: 6px;
}
</style>
