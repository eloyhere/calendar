<script setup lang="ts">
/**
 * 系统域的页容器：`/system/:page`。
 *
 * ## 四页各自的依据
 *
 * | 页         | 内容                              | 依据                                          |
 * | ---------- | --------------------------------- | --------------------------------------------- |
 * | 性能       | 查询耗时、缓存命中、内存占用      | §6.7；**一瞥即知**，不做实时曲线（§2.2 第 12 条） |
 * | 数据信息   | 22 个分库的表结构、行数、构建时间  | §6.7；也是旧 `/performance/datasource` 的落点  |
 * | 权限与审计 | 持久授权规则、默认策略、审计尾部   | §6.7；HAX **G17 提供全局控制**                 |
 * | 设置       | 快捷键表、界面偏好、环境自检       | §6.7；WCAG **3.2.6**（帮助入口位置固定）        |
 *
 * ## 为什么"权限与审计"必须在界面上
 *
 * `docs/ui-architecture.md` §7.5 给的理由：工作流会执行 `mutating` 动词
 * （写文件、改环境变量、操作窗口）。这些动作必须有**可查的授权面**——
 * 用户要能看到"谁批准过什么、什么时候批的"。HAX 的 **G17**（提供全局控制）
 * 与 **G16**（传达后果）都指向同一件事：授权不能只发生在一个一时的弹窗里。
 *
 * `dsh-os` 已经把它做好了（`permission.list` / `query` / `audit` / `grant` / `revoke`），
 * 这一页要做的只是**把它显示出来**。
 */

import { computed, ref, watch } from "vue";

import DomainPages from "../../component/DomainPages.vue";
import PageShell from "../../component/PageShell.vue";
import SystemPerformance from "./SystemPerformance.vue";
import SystemDatasource from "./SystemDatasource.vue";
import SystemPermission from "./SystemPermission.vue";
import SystemSetting from "./SystemSetting.vue";
import { useRoute } from "../../plugin";
import { DOMAIN_BY_ID } from "../../entity/domain";
import { useModuleStates } from "../../state/use-calendar-query";

const route = useRoute();

/** 当前页 id。 */
const current = computed(() => {
    const raw = route.params.page;
    return String(Array.isArray(raw) ? raw[0] : raw);
});

/** 系统域登记项。 */
const domain = DOMAIN_BY_ID.get("system")!;

/** 当前页；非法为 `undefined`。 */
const page = computed(() => domain.pages.find((item) => item.path === `/system/${current.value}`));

/** 窗口标题。 */
watch(
    () => page.value?.title,
    (label) => {
        if (label !== undefined) {
            document.title = `${label} · 系统 · 轩辕历法`;
        }
    },
    { immediate: true }
);

/** 切页重挂载。 */
const pageKey = ref(current.value);
watch(current, (value) => {
    pageKey.value = value;
});

/** 一句话规模说明。 */
const { states } = useModuleStates();
const note = computed(() => {
    const missing = states.value.filter((item) => !item.present).length;
    return missing === 0 ? "22 个分库全部就位" : `${missing} 个分库缺文件`;
});
</script>

<template>
    <ElResult
        v-if="page === undefined"
        icon="warning"
        title="没有这一页"
        :sub-title="`系统域没有「${current}」。可用的有：${domain.pages.map((item) => item.title).join('、')}。`"
        class="system-page__missing">
        <template #extra>
            <ElButton type="primary" @click="$router.push('/system/performance')">去看性能</ElButton>
            <ElButton @click="$router.push('/')">回工作台</ElButton>
        </template>
    </ElResult>

    <PageShell v-else :state="'ready'" :card="false" :scroll="false">
        <div class="system-page">
            <DomainPages :domain="domain" :current="`/system/${current}`" :note="note" />

            <ElScrollbar class="system-page__body">
                <SystemPerformance v-if="current === 'performance'" :key="pageKey" />
                <SystemDatasource v-else-if="current === 'datasource'" :key="pageKey" />
                <SystemPermission v-else-if="current === 'permission'" :key="pageKey" />
                <SystemSetting v-else :key="pageKey" />
            </ElScrollbar>
        </div>
    </PageShell>
</template>

<style scoped>
.system-page__missing {
    margin-top: 48px;
}

.system-page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
}

.system-page__body {
    flex: 1;
    min-height: 0;
}
</style>
