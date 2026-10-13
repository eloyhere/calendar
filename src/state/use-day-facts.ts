/**
 * 一天的历法事实：日历格子里每一行要显示的内容。
 *
 * ## 日期从 `gregory_month` 来，覆盖层从四张历法表来
 *
 * "这个月有哪些天"由 `state/use-calendar-month.ts` 从 `gregory_month` 读出
 * （那是稠密的月表；`temporal` 是事件表，2026 年 10 月只覆盖 18 天，不能铺日历）。
 * 本文件只负责把**农历、节气、月相、年干支**贴到那些天上。
 *
 * ## 覆盖层按 `absolute` 区间相交，不按日期
 *
 * 四张表都用 `[start, end]` 闭区间（`end = 下一段的 start - 1`）。
 * 所以"这一天属于哪个节气"是区间相交判断，而不是日期比较——
 * 节气是**精确时刻**，它落在哪一天由 `absolute` 决定，不由年月日决定。
 *
 * ## 这里**不吞异常**
 *
 * 早先每一路查询后面挂了 `.catch(() => [])`，本意是"某张表没有数据也能出图"。
 * 结果是主进程的 IPC 通道没接通时四路全静默失败，页面显示"这个时间窗口里
 * 没有历法数据"——**一个完全错误的原因被写成了一句像事实的话**。
 *
 * 现在错误直接抛给调用方，由 `useDayFacts` 收进 `error`，页面渲染错误态。
 * 真的"这张表在这个窗口里没有行"是**空数组**，不是异常，两者不该合并。
 */

import { ref, shallowRef, watch } from "vue";
import type { Ref } from "vue";

import { bigOf, booleanOf } from "../datasource/sqlite";
import { queryModule } from "../datasource/runner";
import { nthOfMonth } from "../entity/cell-labels";
import { keyOfCivil } from "../share/calendar/gregorian";
import type { CalendarDay } from "./use-calendar-month";

/** 一天的全部历法事实。 */
export interface DayFacts {
    /** `YYYY-MM-DD` */
    key: string;
    /** 这一天的起始 `absolute` */
    absolute: bigint;
    /** 公历年（天文纪年：公元前 2697 年写 -2696） */
    year: number;
    /** 公历月 */
    month: number;
    /** 公历日 */
    day: number;
    /** 朔望月序号（全局），没有时为 `null` */
    monthIndex: number | null;
    /** 农历月名（含"闰"字前缀） */
    lunarMonth: string | null;
    /** 农历日名 */
    lunarDay: string | null;
    /**
     * 这一天的月相**段**名。
     *
     * 它是段不是点：`phase` 表里"朔月"覆盖从朔到上弦之间的七八天。
     * 格子里不能每天都写它，否则一个月里四行字各重复七八遍，
     * 而真正每天在变的日干支反而没位置。要不要写由 `phaseBegins` 决定。
     */
    phase: string | null;
    /** 这一天是不是该月相段的**第一天**（朔 / 上弦 / 望 / 下弦 当天） */
    phaseBegins: boolean;
    /** 这一天的节气**段**名（如「霜降」） */
    solarTerm: string | null;
    /** 这一天是不是该节气的**交节当天** */
    solarTermBegins: boolean;
    /** 年干支，两字 */
    yearStemBranch: string;
}

/** 六十甲子。 */
function sexagenaryOf(index: number): string {
    const stems = "甲乙丙丁戊己庚辛壬癸";
    const branches = "子丑寅卯辰巳午未申酉戌亥";
    const n = ((index % 60) + 60) % 60;
    return `${stems[n % 10]}${branches[n % 12]}`;
}

/**
 * 把若干个覆盖层贴到给定的日期列表上。
 *
 * @param days 日期列表（来自 `gregory_month`），必须按 `absolute` 升序
 */
export async function loadDayFacts(days: readonly CalendarDay[]): Promise<Map<string, DayFacts>> {
    const map = new Map<string, DayFacts>();

    if (days.length === 0) {
        return map;
    }

    for (const day of days) {
        map.set(day.key, {
            key: day.key,
            absolute: day.absolute,
            year: day.year,
            month: day.month,
            day: day.day,
            monthIndex: null,
            lunarMonth: null,
            lunarDay: null,
            phase: null,
            phaseBegins: false,
            solarTerm: null,
            solarTermBegins: false,
            yearStemBranch: ""
        });
    }

    /** 每个日界在 `days` 里的下标（`days` 只覆盖窗口内的月份，所以要夹紧）。 */
    const indexAtOrBefore = (absolute: bigint): number => {
        let low = 0;
        let high = days.length - 1;
        let found = -1;
        while (low <= high) {
            const middle = (low + high) >> 1;
            if (days[middle].absolute <= absolute) {
                found = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }
        return found;
    };

    const from = days[0].absolute;
    const to = days[days.length - 1].absolute + 86_399n;
    const parameters = { from, to };

    const [months, terms, phases, years] = await Promise.all([
        // 农历：一个朔望月覆盖 29–30 天
        queryModule(
            "synodic",
            `SELECT "identity", "relative", "name", "leap", "start", "end"
             FROM "synodic_month"
             WHERE "end" >= :from AND "start" <= :to
             ORDER BY "start"`,
            parameters
        ),

        // 节气：一个节气覆盖约 15 天
        queryModule(
            "phenology",
            `SELECT "identity", "name", "start", "end"
             FROM "phenology"
             WHERE "end" >= :from AND "start" <= :to
             ORDER BY "start"`,
            parameters
        ),

        // 月相：朔/上弦/望/下弦，一个朔望月四条
        queryModule(
            "phase",
            `SELECT "identity", "name", "start", "end"
             FROM "phase"
             WHERE "end" >= :from AND "start" <= :to
             ORDER BY "start"`,
            parameters
        ),

        // 年干支：窗口跨年时最多 2–3 条
        queryModule(
            "tree",
            `SELECT "identity", "relative", "start", "end"
             FROM "tree_year"
             WHERE "end" >= :from AND "start" <= :to
             ORDER BY "start"`,
            parameters
        )
    ]);

    /**
     * 把一个区间铺到日格上。
     *
     * `begins` 只传给**第一天**，用来区分"这一天是交节当天"与
     * "这一天落在这个节气区间里"。前者才是格子上该写节气名的日子。
     */
    const spread = (start: bigint, end: bigint, apply: (cell: DayFacts, begins: boolean) => void): void => {
        const first = indexAtOrBefore(start);
        const last = indexAtOrBefore(end);
        if (last < 0) {
            return;
        }
        for (let index = Math.max(0, first); index <= last && index < days.length; index += 1) {
            const entry = days[index];
            const cell = map.get(entry.key);
            if (cell !== undefined) {
                apply(cell, index === Math.max(0, first));
            }
        }
    };

    /* 农历月：`name` 形如「正月小」，去掉末位的大小就是月名 */
    for (const row of months) {
        const leap = booleanOf(row.leap);
        const label = String(row.name ?? "").replace(/[大小]$/u, "");
        const monthName = `${leap ? "闰" : ""}${label}`;
        const start = bigOf(row.start);
        const end = bigOf(row.end);
        const monthIndex = Number(bigOf(row.relative));

        /*
         * 农历日名按**格子距月首的天数**补。
         *
         * 不能用"格子的 absolute 减月首 absolute"再除 86400：这个库的日界
         * 不保证等距（月首可能落在半天中间）。所以按日界数组的下标差算。
         */
        const first = indexAtOrBefore(start);
        for (let offset = 0; offset < 32; offset += 1) {
            const at = first + offset;
            if (at < 0 || at >= days.length) {
                break;
            }
            const entry = days[at];
            if (entry.absolute > end) {
                break;
            }
            const cell = map.get(entry.key);
            if (cell !== undefined) {
                cell.lunarMonth = monthName;
                cell.monthIndex = monthIndex;
                cell.lunarDay = nthOfMonth(offset + 1);
            }
        }
    }

    /* 节气 */
    for (const row of terms) {
        const name = String(row.name ?? "");
        spread(bigOf(row.start), bigOf(row.end), (cell, begins) => {
            cell.solarTerm = name;
            cell.solarTermBegins = begins;
        });
    }

    /* 月相。`name` 是「朔月/上弦/望月/下弦」，界面上写成「朔/上弦/望/下弦」 */
    for (const row of phases) {
        const name = String(row.name ?? "").replace(/月$/u, "");
        spread(bigOf(row.start), bigOf(row.end), (cell, begins) => {
            cell.phase = name;
            cell.phaseBegins = begins;
        });
    }

    /*
     * 年干支。
     *
     * `tree_year.relative` 是从 1 开始的干支年序号；建元当年为上元甲子，
     * 所以映射是 `relative - 1`（见 `share/calendar/sexagenary.ts`）。
     * 这里不写 `sexagenary(relative)`：那会隐含"`relative` 从 0 起"的假设，
     * 而它从 1 起——差一位的干支错在最不容易被发现的地方。
     */
    for (const row of years) {
        const text = sexagenaryOf(Number(bigOf(row.relative)) - 1);
        spread(bigOf(row.start), bigOf(row.end), (cell) => {
            cell.yearStemBranch = text;
        });
    }

    return map;
}

/**
 * 取一屏事实的响应式封装。
 *
 * 日期列表变化时重取；回来的不是最新一次请求就丢掉（翻月快按会并发多条查询，
 * 慢的那条后到会把新月份的数据覆盖成旧的）。
 */
export function useDayFacts(days: Ref<readonly CalendarDay[]>): {
    facts: Ref<Map<string, DayFacts>>;
    loading: Ref<boolean>;
    error: Ref<string>;
    reload: () => void;
} {
    const facts = shallowRef<Map<string, DayFacts>>(new Map());
    const loading = ref(false);
    const error = ref("");
    let sequence = 0;

    const load = (): void => {
        const current = days.value;
        if (current.length === 0) {
            facts.value = new Map();
            return;
        }

        sequence += 1;
        const token = sequence;
        loading.value = true;

        void loadDayFacts(current)
            .then((result) => {
                if (token !== sequence) {
                    return;
                }
                facts.value = result;
                error.value = "";
            })
            .catch((cause: unknown) => {
                if (token !== sequence) {
                    return;
                }
                facts.value = new Map();
                error.value = cause instanceof Error ? cause.message : String(cause);
            })
            .finally(() => {
                if (token === sequence) {
                    loading.value = false;
                }
            });
    };

    watch(
        () => `${days.value.length}:${days.value[0]?.key ?? ""}:${days.value[days.value.length - 1]?.key ?? ""}`,
        () => load(),
        { immediate: true }
    );

    return { facts, loading, error, reload: load };
}

/** 键的再导出，方便调用方不必同时 import 两个模块。 */
export { keyOfCivil };

