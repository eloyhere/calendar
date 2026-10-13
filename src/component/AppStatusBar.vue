<script setup lang="ts">
/**
 * 状态栏（新增，28px）。
 *
 * ## 为什么要有这一条
 *
 * `docs/ui-architecture.md` §5.4 给它的三个理由，逐条对应三段内容：
 *
 * | 段 | 内容                     | 解决什么                                                                 |
 * | -- | ------------------------ | ------------------------------------------------------------------------ |
 * | 左 | 库规模与建元             | 这一屏的"资历证明"，放常驻位置比放工作台更省点击                          |
 * | 中 | **当前视点**             | 用户必须随时知道"现在用的是哪套时间模型"（§2.1 第 7 条：心智模型基于信念） |
 * | 右 | 助手状态 + 运行中的工作流 | WCAG **4.1.3**：状态消息要能被程序化播报，且不抢焦点                     |
 *
 * ## 与页脚的区别
 *
 * 旧的 `AppFooter.vue` 放的是"数据规模 / 构建信息"——读一次就够的静态信息。
 * 这一条放的是**每页都要看**的动态信息，所以它取代了页脚；静态的构建信息
 * 移到 `/system/datasource`。
 *
 * ## 整条只读
 *
 * 这一条里**没有可点的东西**（除了运行中的工作流那一段，它是去运行记录的入口）。
 * 理由：它贴着窗口底边，是最容易被误点的地方（Fitts 定律说边缘目标最好命中，
 * 那也意味着误点代价最大）。所以它不抢焦点、不进 tab 顺序，`role="status"`。
 *
 * ## 高度 28 而不是 24
 *
 * WCAG **2.5.8** 要求指针目标至少 24×24 CSS px。28 给那唯一一个可点元素
 * （工作流进度）留了 2px 上下呼吸，同时不占掉内容高度。
 */

import { computed } from "vue";

import AppIcon from "./AppIcon.vue";
import { TOTAL_ROWS } from "../../shared/database-registry";
import { AssistantStatusLabels, useShellStore } from "../store/shell.store";

const shell = useShellStore();

/** 全库规模。来自登记表的实测合计，逐库的实时行数在工作台与 `/system/datasource`。 */
const scaleText = computed(() => `22 分库 · ${TOTAL_ROWS.toLocaleString("en-US")} 行`);

/** 助手状态的一句话，含补充说明。 */
const assistantText = computed(() => {
    const label = AssistantStatusLabels[shell.assistantStatus];
    return shell.assistantDetail.length > 0
        ? `${label.text} ${shell.assistantDetail}`
        : label.text;
});

/** 工作流进度：`3 / 7 步`。 */
const flowText = computed(() => {
    const flow = shell.runningFlow;
    return flow === null ? "" : `${flow.title} ${flow.done}/${flow.total} 步`;
});
</script>

<template>
    <footer class="app-statusbar" role="status" aria-live="polite">
        <!-- 左：规模与建元。建元是硬编码的口径（docs/design.md §2），不是查出来的 -->
        <span class="app-statusbar__cell app-statusbar__cell--dim">{{ scaleText }}</span>
        <span class="app-statusbar__sep">·</span>
        <span class="app-statusbar__cell app-statusbar__cell--dim">建元 -2696-03-11</span>

        <span class="app-statusbar__spring" />

        <!-- 中：当前视点。任何时间相关的页面都会写它，写时保持同一时刻只换表达 -->
        <span class="app-statusbar__cell app-statusbar__viewpoint numeral" :title="shell.pointText">
            {{ shell.pointText }}
        </span>

        <span class="app-statusbar__spring" />

        <!-- 右：运行中的工作流（可点，去运行记录） -->
        <RouterLink
            v-if="shell.runningFlow !== null"
            to="/agent/flow/run"
            class="app-statusbar__flow">
            <AppIcon name="Loading" />
            <span>{{ flowText }}</span>
        </RouterLink>

        <!-- 右：助手状态。图标 + 文字两通道（WCAG 1.4.1：不能只靠颜色） -->
        <span
            class="app-statusbar__cell"
            :class="`app-statusbar__cell--${AssistantStatusLabels[shell.assistantStatus].tone}`">
            <AppIcon name="MagicStick" />
            <span>{{ assistantText }}</span>
        </span>
    </footer>
</template>

<style scoped>
.app-statusbar {
    align-items: center;
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-secondary);
    display: flex;
    flex-shrink: 0;
    font-size: 12px;
    gap: 6px;
    height: 28px;
    /* 整条不可选中：它是状态，不是内容 */
    user-select: none;
}

.app-statusbar__spring {
    flex: 1 1 auto;
}

.app-statusbar__cell {
    align-items: center;
    display: inline-flex;
    gap: 4px;
    white-space: nowrap;
}

.app-statusbar__cell--dim {
    color: var(--el-text-color-placeholder);
}

.app-statusbar__cell--info {
    color: var(--el-text-color-secondary);
}

.app-statusbar__cell--success {
    color: var(--el-color-success);
}

.app-statusbar__cell--danger {
    color: var(--el-color-danger);
}

.app-statusbar__sep {
    color: var(--el-border-color-darker);
}

/*
 * 视点：唯一给足对比度的一段。它是这一条里信息量最大的一个字，
 * 用正文色而不是次要色（与 §9.3 的"说明用次要色、内容用正文色"一致）。
 */
.app-statusbar__viewpoint {
    color: var(--el-text-color-regular);
    max-width: 60vw;
    overflow: hidden;
    text-overflow: ellipsis;
}

.app-statusbar__flow {
    align-items: center;
    color: var(--el-color-primary);
    display: inline-flex;
    gap: 4px;
    padding: 0 4px;
    text-decoration: none;
}

.app-statusbar__flow:hover {
    text-decoration: underline;
}
</style>
