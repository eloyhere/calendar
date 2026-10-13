<script setup lang="ts">
/**
 * 工作台（`/`）。
 *
 * ## 这一页帮用户完成什么思考任务
 *
 * Tufte 的第一原则（`docs/ui-architecture.md` §2.4 第 6 条，已核实其原话）：
 * "信息展示的目的是**辅助思考**，所以首先要问：这些展示被用来帮助的是哪些思考任务？"
 *
 * 工作台的任务只有一个：**"这个库现在什么状态、我上次做到哪"**。所以它只放四块，
 * 一块不多：
 *
 * | 块       | 回答什么                                     | 依据                        |
 * | -------- | -------------------------------------------- | --------------------------- |
 * | 库规模   | 一共多少库、多少行、有没有缺文件              | §6.1                        |
 * | 数据健康 | 逐个分库的行数与状态，零行/缺文件要能一眼看出 | §2.2 第 12 条（警觉递减）   |
 * | 最近活动 | 我最近在做什么                                | §2.1 第 3 条（外部记忆）    |
 * | 继续     | 上次停在哪                                    | §2.2 第 13 条（前瞻记忆）   |
 *
 * ## 明确不做的事
 *
 * - **不做"控制中心"式的图表墙**。Tufte 的原话点名要避免"使命控制中心、
 *   战略空军司令部、驾驶舱、仪表盘、星际迷航这类用力过猛的隐喻"（§2.4 第 6 条）；
 * - **不做实时曲线**。持续注意会随时间下降（§2.2 第 12 条，警觉递减），
 *   这一页要的是"一瞥即知"，不是"盯着看"；
 * - **不用饼图 / 环形图 / 指针盘**。颜色不能编码数量，面积与角度不适合定量表达
 *   （§2.4 第 4 条）；
 * - **不做积分 / 连续天数 / 成就徽章**（§2.2 第 15 条）。
 *
 * ## 数字都是现查的
 *
 * 22 个分库的行数来自 `desktop.calendar.modules()`——它逐个 `COUNT(*)`。
 * 不读 `docs/design.md` 里那份构建期快照：实测已经对不上（那份文档说六个历法
 * 是零行，实际它们都有数据）。界面回答的是"现在有多少行"。
 */

import { computed } from "vue";

import PageShell from "../component/PageShell.vue";
import AppIcon from "../component/AppIcon.vue";
import { useRouter } from "../plugin";
import { relativeTime } from "../entity/chat";
import { CalendarSystems } from "../entity/calendar";
import { useChatStore } from "../store/chat.store";
import { useShellStore } from "../store/shell.store";
import { formatCount, useModuleStates } from "../state/use-calendar-query";

const router = useRouter();
const chat = useChatStore();
const shell = useShellStore();

chat.ensureReady();

const { states, state, error, reload } = useModuleStates();

/** 四个统计卡片的数值。 */
const summary = computed(() => {
    const list = states.value;
    const present = list.filter((item) => item.present);
    const total = list.reduce((sum, item) => sum + (item.rows ?? 0), 0);

    return [
        { label: "分库", value: list.length, unit: "个", note: "登记在 shared/database-registry.ts" },
        { label: "总行数", value: total, unit: "行", note: "各库主表实时 COUNT(*)" },
        { label: "已装数", value: present.length, unit: "个", note: "磁盘上找得到 .sqlite" },
        { label: "待构建", value: list.length - present.length, unit: "个", note: "缺文件，不是零行" }
    ];
});

/**
 * 表格行。
 *
 * 按行数**降序**：小表（3 行的 `primary`、28 行的 `encounter`）排在后面——
 * 它们不该占据注意力，但也不能被藏起来（`docs/ui-architecture.md` §3.1 的
 * 结论是"小表不独立成页，当作附属面板"，不是"不显示"）。
 */
const rows = computed(() =>
    [...states.value]
        .map((item) => ({
            ...item,
            // 状态合并成三档，与 §6.1 的"零行不是错误"一致
            tone: !item.present ? "danger" : item.problem !== null ? "danger" : (item.rows ?? 0) === 0 ? "info" : "success",
            status: !item.present
                ? "缺文件"
                : item.problem !== null
                  ? "打不开"
                  : (item.rows ?? 0) === 0
                    ? "零行"
                    : "已装数"
        }))
        .sort((left, right) => (right.rows ?? -1) - (left.rows ?? -1))
);

/** 最近会话（跨模式，按最后活动倒序，取 5 条）。 */
const recentSessions = computed(() =>
    [...chat.state.sessions]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 5)
);

/** 最近一次活动的会话，用来做"继续"。 */
const lastSession = computed(() => recentSessions.value[0] ?? null);

/** 跳转。 */
const go = (path: string): void => {
    void router.push(path);
};

/** 打开一条会话：切到它所属模式的对话页。 */
const openSession = (id: string, channel: string): void => {
    chat.selectSession(channel as never, id);
    void router.push(`/agent/chat/${channel}`);
};
</script>

<template>
    <PageShell
        :state="state"
        :error-text="error"
        source="src/sqlite/"
        empty-text="22 个分库都还没有装数；先运行 python database/build.py calendar.xlsx --out src/sqlite"
        @retry="reload">
        <!-- ① 库规模：四张卡。数字直排，不画图（§2.4 第 4 条：长度与位置才适合定量） -->
        <ElRow :gutter="16" class="workspace__summary">
            <ElCol v-for="item in summary" :key="item.label" :span="6">
                <ElCard shadow="never" class="workspace__stat">
                    <ElStatistic :title="item.label" :value="item.value" :suffix="item.unit" />
                    <p class="xy-dim workspace__stat-note">{{ item.note }}</p>
                </ElCard>
            </ElCol>
        </ElRow>

        <ElRow :gutter="16">
            <ElCol :span="16">
                <!-- ② 数据健康：逐个分库。零行与缺文件是两件事，标签分开 -->
                <div class="xy-panel workspace__panel">
                    <h2 class="xy-panel-title">数据健康</h2>

                    <ElTable :data="rows" stripe max-height="420" class="workspace__table">
                        <ElTableColumn prop="label" label="分库" width="120" />
                        <ElTableColumn prop="name" label="模块" width="130" class-name="numeral">
                            <template #default="{ row }">
                                <span class="numeral xy-chip">{{ row.name }}</span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn prop="rows" label="行数" width="130" align="right">
                            <template #default="{ row }">
                                <span class="numeral">
                                    {{ row.rows === null ? "—" : formatCount(row.rows) }}
                                </span>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn label="状态" width="100">
                            <template #default="{ row }">
                                <!--
                                    状态不只靠颜色：标签有文字（WCAG 1.4.1），
                                    并且三档的文字本身就说清了原因。
                                -->
                                <ElTag :type="row.tone" size="small" effect="plain">
                                    {{ row.status }}
                                </ElTag>
                            </template>
                        </ElTableColumn>
                        <ElTableColumn prop="note" label="说明" min-width="200">
                            <template #default="{ row }">
                                <ElText size="small" :type="row.tone === 'success' ? 'info' : 'warning'">
                                    {{ row.problem ?? row.note }}
                                </ElText>
                            </template>
                        </ElTableColumn>
                    </ElTable>

                    <p class="xy-note">
                        行数是**实时**的：主进程逐个 <code>COUNT(*)</code> 各库的主表。
                        零行不是错误——那说明数据源缺失或换算法则未实现，
                        界面上不该报红（<code>docs/ui-architecture.md</code> §2.3 第 7 条）。
                    </p>
                </div>
            </ElCol>

            <ElCol :span="8">
                <!-- ③ 继续：前瞻记忆。提醒要落在用户本来就会看的地方 -->
                <div v-if="lastSession" class="xy-panel workspace__panel">
                    <h2 class="xy-panel-title">继续</h2>
                    <p class="xy-note workspace__continue-title">{{ lastSession.title }}</p>
                    <p class="xy-dim">
                        {{ lastSession.summary }} · {{ relativeTime(lastSession.updatedAt) }}
                    </p>
                    <ElButton
                        type="primary"
                        class="workspace__continue-button"
                        @click="openSession(lastSession.id, lastSession.channel)">
                        <AppIcon name="ArrowRight" />
                        <span>接着聊</span>
                    </ElButton>
                </div>

                <!-- ④ 最近活动：外部记忆 -->
                <div class="xy-panel workspace__panel">
                    <h2 class="xy-panel-title">最近会话</h2>

                    <ElEmpty v-if="recentSessions.length === 0" description="还没有会话" :image-size="60" />

                    <ul v-else class="workspace__list">
                        <li v-for="session in recentSessions" :key="session.id">
                            <button
                                type="button"
                                class="workspace__list-item"
                                @click="openSession(session.id, session.channel)">
                                <span class="workspace__list-title is-truncated">{{ session.title }}</span>
                                <span class="xy-dim">{{ relativeTime(session.updatedAt) }}</span>
                            </button>
                        </li>
                    </ul>
                </div>

                <!-- 历法体系：八套的入口，比侧栏更快到"数据"页 -->
                <div class="xy-panel workspace__panel">
                    <h2 class="xy-panel-title">历法体系</h2>
                    <div class="workspace__systems">
                        <ElButton
                            v-for="system in CalendarSystems"
                            :key="system.id"
                            text
                            size="small"
                            @click="go(`/calendar/${system.id}`)">
                            <AppIcon :name="system.icon" />
                            <span>{{ system.label }}</span>
                        </ElButton>
                    </div>
                </div>
            </ElCol>
        </ElRow>

        <!-- 视点提示：工作台不设定视点，但要让用户知道状态栏那一段是空的 -->
        <p v-if="shell.point.absolute === null" class="xy-note workspace__footnote">
            状态栏中间的「当前视点」在打开历法或年表页之后才会填上。
        </p>
    </PageShell>
</template>

<style scoped>
.workspace__summary {
    margin-bottom: 16px;
}

.workspace__stat {
    text-align: center;
}

.workspace__stat-note {
    margin: 6px 0 0;
}

.workspace__panel {
    margin-bottom: 16px;
}

.workspace__table {
    width: 100%;
}

.workspace__continue-title {
    color: var(--el-text-color-primary);
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px;
}

.workspace__continue-button {
    margin-top: 12px;
    width: 100%;
}

.workspace__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    list-style: none;
    margin: 0;
    padding: 0;
}

/*
 * 列表项整行可点（Fitts 定律：整块可点，不要只让文字命中）。
 * 用 `button` 而不是 `div`：它本来就是一个动作。
 */
.workspace__list-item {
    align-items: baseline;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    gap: 8px;
    justify-content: space-between;
    padding: 7px 8px;
    text-align: left;
    width: 100%;
}

.workspace__list-item:hover {
    background: var(--el-fill-color-light);
}

.workspace__list-title {
    color: var(--el-text-color-regular);
    font-size: 13px;
}

.workspace__systems {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.workspace__footnote {
    margin-top: 0;
}
</style>
