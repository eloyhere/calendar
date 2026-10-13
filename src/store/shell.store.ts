/**
 * 界面状态 store：外壳自己的那一份状态。
 *
 * ## 为什么单独一个 store
 *
 * `docs/ui-architecture.md` §5 的外壳有三件"跨页面活着"的东西：
 *
 * 1. **侧栏折叠**（`Ctrl+B`）——在任意页面切换，换页不该弹回展开；
 * 2. **助手抽屉与命令面板的开关**——它们是外壳层的覆盖物，页面只管触发；
 * 3. **状态栏的内容**——当前视点、助手状态、运行中的工作流，任何页面都能写。
 *
 * 三件事的共同点是"**不属于任何一个页面**"。放进页面里，换页就丢；
 * 放进 `AppShell` 的局部 `ref` 里，子页面又够不着。所以归 store。
 *
 * ## 为什么不并进 `store.ts` 的实体 store
 *
 * `src/store/store.ts` 的 `defineEntityStore` 是**读穿缓存**，它假设背后有一条
 * `service -> repository -> sqlite` 的链路，数据是构建期产物。
 * 界面状态三样都不成立——它没有表、要立刻可写、而且换页必须保留。
 * 与 `chat.store.ts` 不用那个工厂是同一个理由。
 */

import { defineStore } from "pinia";
import { computed, ref } from "vue";

/* -------------------------------------------------------------------------- */
/* 视点                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 当前视点：用户此刻在看哪一刻。
 *
 * `docs/ui-architecture.md` §5.4 要求状态栏常驻显示"现在用的是哪套时间模型"，
 * 这样用户在历法之间切换时不会失去参照（§2.1 第 7 条：心智模型基于信念而非事实）。
 *
 * 历法页、年表页、命理页都会写它；写的时候**保持同一时刻**，只换表达——
 * 这正是"切换历法时保持同一视点"那条要求的落点。
 */
export interface ObservationPoint {
    /**
     * 全库统一的时间主键（`temporal.absolute`）。
     *
     * `null` 表示还没有视点（刚启动、还没打开任何时间相关的页面）。
     * 用 `bigint` 而不是 `number`：最小值实测到 `-230466297600`，
     * 虽然这个量级放进 `number` 还安全，但它是全库唯一的 8 字节整数主键，
     * 转成 `number` 就多一处可能失真的地方。
     */
    absolute: bigint | null;
    /** 公历表达，如 `0630-03-15` */
    gregorian: string | null;
    /** 本历（轩辕历）表达，如 `贞观四年二月十九` */
    calendar: string | null;
    /** 干支表达，如 `庚寅年 己卯月 甲子日` */
    sexagenary: string | null;
    /** 这个视点是谁写的，用于状态栏显示来源（`历法 · 朔望历`） */
    from: string | null;
}

/** 空的视点。 */
const blankPoint: ObservationPoint = {
    absolute: null,
    gregorian: null,
    calendar: null,
    sexagenary: null,
    from: null
};

/* -------------------------------------------------------------------------- */
/* 助手状态                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 助手的当前状态。
 *
 * `docs/ui-architecture.md` §5.4 与 WCAG **4.1.3** 要求助手的状态是**状态消息**：
 * 不抢焦点、由 `role="status"` 播报。所以它是一份共享状态而不是每个页面各写一行字。
 */
export type AssistantStatus = "idle" | "retrieving" | "generating" | "done" | "failed";

/** 助手状态的一句话说明与语气。 */
export const AssistantStatusLabels: Record<AssistantStatus, { text: string; tone: "info" | "success" | "danger" }> = {
    idle: { text: "空闲", tone: "info" },
    retrieving: { text: "正在检索", tone: "info" },
    generating: { text: "正在生成", tone: "info" },
    done: { text: "已完成", tone: "success" },
    failed: { text: "出错了", tone: "danger" }
};

/* -------------------------------------------------------------------------- */
/* store                                                                       */
/* -------------------------------------------------------------------------- */

export const useShellStore = defineStore("shell", () => {
    /* ── 侧栏 ─────────────────────────────────────────────────────────────── */

    /**
     * 侧栏是否折叠。
     *
     * `docs/ui-architecture.md` §5.3：折叠后只留图标（48px）。
     * 初始值按窗口宽度定：1280px 以下默认折叠——默认窗口是 1440×720，
     * 在这个宽度上展开的 220px 侧栏会把三栏对话页的中栏压到 900px 以下。
     */
    const collapsed = ref(typeof window !== "undefined" && window.innerWidth < 1280);

    const toggleSidebar = (): void => {
        collapsed.value = !collapsed.value;
    };

    /* ── 覆盖物 ───────────────────────────────────────────────────────────── */

    /**
     * 助手抽屉。
     *
     * `docs/ui-architecture.md` §5.5：任意页 `Ctrl+/` 唤起，`Esc` 关闭，
     * 关闭后焦点回到唤起按钮。这里只存开关，焦点管理在组件里做
     * （store 不该碰 DOM）。
     */
    const assistantOpen = ref(false);

    /**
     * 命令面板（`Ctrl+K`）。
     *
     * §2.3 第 20 条已写明：命令面板**没有可核验的权威规范**，
     * 这里的 `Ctrl+K` 是本项目自定的约定。它解决的是"任意页直达任意页"。
     */
    const paletteOpen = ref(false);

    const openAssistant = (): void => {
        assistantOpen.value = true;
        paletteOpen.value = false;
    };

    const closeAssistant = (): void => {
        assistantOpen.value = false;
    };

    const toggleAssistant = (): void => {
        if (assistantOpen.value) {
            closeAssistant();
            return;
        }
        openAssistant();
    };

    const openPalette = (): void => {
        paletteOpen.value = true;
        assistantOpen.value = false;
    };

    const closePalette = (): void => {
        paletteOpen.value = false;
    };

    const togglePalette = (): void => {
        if (paletteOpen.value) {
            closePalette();
            return;
        }
        openPalette();
    };

    /* ── 状态栏 ───────────────────────────────────────────────────────────── */

    /** 当前视点。 */
    const point = ref<ObservationPoint>({ ...blankPoint });

    const setPoint = (next: ObservationPoint): void => {
        point.value = next;
    };

    /** 助手状态。 */
    const assistantStatus = ref<AssistantStatus>("idle");

    /** 助手状态的一句话补充（"正在检索 3 个库"里的"3 个库"）。 */
    const assistantDetail = ref("");

    const setAssistantStatus = (status: AssistantStatus, detail = ""): void => {
        assistantStatus.value = status;
        assistantDetail.value = detail;
    };

    /**
     * 正在运行的工作流。
     *
     * 状态栏右侧显示它，`docs/ui-architecture.md` §7.4 要求"运行状态常驻可见、
     * 中断是一等按钮"——那个按钮在编排器里，状态栏这里只报进度。
     */
    const runningFlow = ref<{ id: string; title: string; done: number; total: number } | null>(null);

    const setRunningFlow = (value: { id: string; title: string; done: number; total: number } | null): void => {
        runningFlow.value = value;
    };

    /* ── 派生 ─────────────────────────────────────────────────────────────── */

    /** 状态栏左侧的视点文案；没有视点时显示占位。 */
    const pointText = computed(() => {
        const current = point.value;
        const parts: string[] = [];
        if (current.gregorian !== null) {
            parts.push(`公历 ${current.gregorian}`);
        }
        if (current.calendar !== null) {
            parts.push(current.calendar);
        }
        if (current.sexagenary !== null) {
            parts.push(current.sexagenary);
        }
        return parts.length > 0 ? parts.join(" · ") : "尚未选定时刻";
    });

    return {
        collapsed,
        toggleSidebar,

        assistantOpen,
        paletteOpen,
        openAssistant,
        openPalette,
        closeAssistant,
        closePalette,
        toggleAssistant,
        togglePalette,

        point,
        setPoint,
        pointText,
        assistantStatus,
        assistantDetail,
        setAssistantStatus,
        runningFlow,
        setRunningFlow
    };
});

/** 页面把这份状态透传给子组件时用的类型。 */
export type ShellStore = ReturnType<typeof useShellStore>;
