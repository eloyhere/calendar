<script setup lang="ts">
/**
 * 历法工作区：`/calendar/:system/:view?`。
 *
 * ## 一条路由替掉 24 个页面文件
 *
 * 旧表把 8 套历法 × 3 个视图写成 24 条路由、24 个页面文件（`view/calendar/<实体>/`
 * 下的三件套），而它们的形状**完全相同**。`docs/ui-architecture.md` §4.3.2 把它压成
 * 一条参数化路由，形状来自 `src/entity/calendar.ts` 的 `CalendarSystems` 登记表。
 *
 * 省下的不只是文件数。旧结构下"新增一套历法"要动 4 处（路由 3 条 + 3 个页面文件 +
 * 菜单 + 侧栏），现在只动登记表一行。
 *
 * ## 非法参数不重定向
 *
 * `:system` 不在登记表里时渲染 `ElResult` 空态并给出出口，**不 redirect**。
 * 理由：重定向会把拼错的地址掩盖掉——用户输入 `/calendar/synodik` 会被悄悄带到
 * 朔望历，他会以为地址是对的。而 `/:pathMatch(.*)*` 那条兜底已经承担了
 * "写错的地址回工作台"的职责，两条兜底叠加只会让人搞不清是哪条生效了。
 *
 * 这也与 `docs/research.md` §3 第 7 条一致：**空态与错误必须分开**。
 *
 * ## 三栏高度怎么传下来
 *
 * `PageShell` 传 `scroll=false`：三页里有两页（日历、数据）要自己分配高度
 * （日历的月格要撑满、数据表要固定表头），让外层套一层 `ElScrollbar` 会把
 * "内容有多长"变成"表格有多长"。
 */

import { computed, watch } from "vue";

import PageShell from "../../component/PageShell.vue";
import AppIcon from "../../component/AppIcon.vue";
import CalendarEntry from "./parts/CalendarEntry.vue";
import CalendarGrid from "./parts/CalendarGrid.vue";
import CalendarData from "./parts/CalendarData.vue";
import { useRoute, useRouter } from "../../plugin";
import { CalendarSystems, CalendarViews, DefaultCalendarView, isCalendarViewId, systemOf } from "../../entity/calendar";

const route = useRoute();
const router = useRouter();

/** 当前体系；非法为 `undefined`。 */
const system = computed(() => systemOf(String(route.params.system ?? "")));

/** 当前视图；非法时退回默认视图（但仍然保留在 URL 上，不重写地址）。 */
const view = computed(() => {
    const raw = route.params.view;
    const id = Array.isArray(raw) ? raw[0] : raw;
    return isCalendarViewId(id) ? id : DefaultCalendarView;
});

/** 视图为空时（`/calendar/synodic`）补上默认视图的地址，让 URL 与界面一致。 */
watch(
    () => [system.value?.id, route.params.view] as const,
    ([id, raw]) => {
        if (id === undefined || raw !== undefined) {
            return;
        }
        void router.replace(`/calendar/${id}/${DefaultCalendarView}`);
    },
    { immediate: true }
);

/** 页头与窗口标题：参数化路由的标题由页面写（路由表里只有「历法工作区」）。 */
watch(
    () => system.value?.label,
    (label) => {
        if (label !== undefined) {
            document.title = `${label} · 轩辕历法`;
        }
    },
    { immediate: true }
);

/** 切体系或切视图。 */
const go = (systemId: string, viewId: string = view.value): void => {
    void router.push(`/calendar/${systemId}/${viewId}`);
};

const goView = (viewId: string): void => {
    if (system.value !== undefined) {
        go(system.value.id, viewId);
    }
};
</script>

<template>
    <!-- 非法 :system：空态 + 出口。不是错误，所以用 ElResult 而不是红色告警 -->
    <ElResult
        v-if="system === undefined"
        icon="warning"
        title="没有这套历法"
        :sub-title="`地址里的「${route.params.system}」不在历法登记表里。可用的有：${CalendarSystems.map((item) => item.label).join('、')}。`"
        class="calendar-system__missing">
        <template #extra>
            <ElButton type="primary" @click="router.push('/calendar/synodic')">
                去看朔望历
            </ElButton>
            <ElButton @click="router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell v-else :state="'ready'" :card="false" :scroll="false">
        <div class="calendar-system">
            <!--
                第一层切换器：历法体系（8 项）。
                页内切换而不是三级菜单——`docs/ui-architecture.md` §2.2 第 3 条
                （渐进披露的两层规则）与第 4 条（Hick 定律的分组策略）。
            -->
            <div class="calendar-system__bar">
                <ElSegmented
                    :model-value="system.id"
                    :options="CalendarSystems.map((item) => ({ label: item.label, value: item.id }))"
                    @update:model-value="(value: string | number | boolean) => go(String(value))" />

                <span class="calendar-system__spring" />

                <!--
                    第二层：视图（简介 / 日历 / 数据）。与 URL 同步，所以可以直接分享地址。
                -->
                <ElTabs
                    :model-value="view"
                    class="calendar-system__views"
                    @update:model-value="(value: string | number) => goView(String(value))">
                    <ElTabPane v-for="item in CalendarViews" :key="item.id" :name="item.id">
                        <template #label>
                            <span class="calendar-system__view-label">
                                <AppIcon :name="item.icon" />
                                <span>{{ item.label }}</span>
                            </span>
                        </template>
                    </ElTabPane>
                </ElTabs>
            </div>

            <!-- 说明条：这一页在看什么。与视图切换联动，不重复页头已经说过的 -->
            <ElAlert
                :title="`${system.label} · ${CalendarViews.find((item) => item.id === view)?.description ?? ''}`"
                type="info"
                :closable="false"
                show-icon
                class="calendar-system__hint" />

            <div class="calendar-system__body">
                <CalendarEntry v-if="view === 'entry'" :system="system" />
                <CalendarGrid v-else-if="view === 'calendar'" :system="system" />
                <CalendarData v-else :system="system" />
            </div>
        </div>
    </PageShell>
</template>

<style scoped>
.calendar-system__missing {
    margin-top: 48px;
}

/*
 * 这一页与对话页同样是"吃掉整屏"的布局：内容区不滚，内部分块各自滚。
 * 撑满一律用 `flex: 1` 而不是 `height: 100%`——弹性分配来的高度是 `auto`，
 * 百分比高度在里面解析不出确定值（这条踩过，见 AppShell 的说明）。
 */
.calendar-system {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.calendar-system__bar {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 16px;
}

.calendar-system__spring {
    flex: 1 1 auto;
}

/*
 * `ElTabs` 自带一条占位很高的头部（约 40px）与底部边距。
 * 这里只当切换器用，所以压掉它的下边距与内容区——真正的内容在下面自己渲染。
 */
.calendar-system__views {
    flex-shrink: 0;
}

.calendar-system__views :deep(.el-tabs__header) {
    margin: 0;
}

.calendar-system__views :deep(.el-tabs__content) {
    display: none;
}

.calendar-system__view-label {
    align-items: center;
    display: inline-flex;
    gap: 4px;
}

.calendar-system__hint {
    border-radius: 6px;
    flex-shrink: 0;
}

.calendar-system__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
}
</style>
