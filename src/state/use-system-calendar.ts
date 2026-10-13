/**
 * 某一套历法**自己的**年月：年序号、月名、月的起讫。
 *
 * ## 为什么必须有这一层
 *
 * 八套历法最初被做成"同一个公历月历换标签"，于是它们的页面长得一模一样——
 * 用户一眼看不出朔望历与干支历有什么区别。这是错的：
 *
 * - **轩辕历**以建元（前 2697 年 3 月 11 日）为第 1 年，所以公历 2026 年是它的 **4723 年**；
 * - **干支历**的"年"是干支（丙午），"月"以交节划分（酉月）；
 * - **节气表**的"月"是节气（秋分、寒露…），一年 24 个；
 * - **木星历**的"月"是岁星十二次里的次，一年只有 12 个但每个约 361 天；
 * - **回归历**的月是黄道十二宫。
 *
 * 这些划分**本来就在各自的 `*_year` / `*_month` 表里**，界面不该自己算，
 * 也不该拿公历的月冒充。
 *
 * ## 字段口径（八套历法通用）
 *
 * | 表            | 字段                                                    |
 * | ------------- | ------------------------------------------------------- |
 * | `<sys>_year`  | `relative` = 本历第几年；`start`/`end` = 年界           |
 * | `<sys>_month` | `ordinal` = 年内第几月；`name` = 月名；`start`/`end`     |
 *
 * `relative` 就是**本历的年号**（轩辕历 4723、木星历 399、干支历 4718）。
 * 各家的年份起点不同，所以它们的数字不同——这正是"突出各自特点"的落点。
 */

import { computed, ref, watch } from "vue";
import type { Ref } from "vue";

import { bigOf, booleanOf } from "../datasource/sqlite";
import { queryModule } from "../datasource/runner";

/** 一套历法在一个时刻上的自我表达。 */
export interface SystemMoment {
    /**
     * 本历**自己的**年份数字。
     *
     * 取 `<sys>_year.absolute` 列——那一列才是各表真正的年份
     * （格里高利/干支表给公历年，轩辕历给建元起算的年号，木星历给自己的计数）。
     * **不要用 `relative`**：它只是该表内的相对序号（格里高利历 2026 那行的
     * `relative` 是 4722，直接显示会得到"第 4722 年"）。
     */
    ownYear: number;
    /**
     * 该时刻所在的**公历年**。
     *
     * 从 `gregory_month` 取，任何历法都能拿到。用于那些以公历为参照的历法
     * （天文历、回归历、节气表）以及干支年的推算。
     */
    ceYear: number;
    /** 表内的相对序号。保留是为了与旧代码比对，界面不要直接显示它 */
    yearNumber: number;
    /** 年界的 `absolute` */
    yearStart: bigint;
    /** 年界的结束 `absolute` */
    yearEnd: bigint;
    /** 这一年有几个"月" */
    monthsInYear: number;
    /** 这一年的月是不是闰出来的（朔望历用） */
    yearLeap: boolean;
    /** 当前月的序号（年内） */
    monthOrdinal: number;
    /** 当前月的名字（八月小 / 酉月 / 秋分 / 二月 …） */
    monthName: string;
    /** 当前月是不是闰月 */
    monthLeap: boolean;
    /** 当前月的起讫 */
    monthStart: bigint;
    monthEnd: bigint;
    /** 当前月有多少天 */
    monthLength: number;
    /** 本时刻在这个月里是第几天（从 1 起） */
    dayInMonth: number;
}

/**
 * 分库与表名的对应。
 *
 * 只有 `synodic` 的年表叫 `synodic_calendar_year`（表名带 `calendar_`），
 * 其余七套都是 `<sys>_year`。这个例外来自构建脚本，所以写死在这里而不是拼字符串。
 */
const TABLES: Record<string, { module: string; year: string; month: string }> = {
    natural: { module: "natural", year: "natural_year", month: "natural_month" },
    synodic: { module: "synodic", year: "synodic_calendar_year", month: "synodic_month" },
    gregory: { module: "gregory", year: "gregory_year", month: "gregory_month" },
    astronomy: { module: "astronomy", year: "astronomy_year", month: "astronomy_month" },
    /*
     * 木星历读**回归表**，不读它自己的 `jupiter_*`。
     *
     * 方案 A 把木星历的「年」定为**回归年**（365.242190 天），
     * 而库里 `jupiter_year` 的长度是 **4332 天**——那是木星的**恒星周期**，不是年。
     * 既然年改了口径，月就必须跟着改成回归月的实长（约 30.44 天），
     * 否则会出现"年 365 天、月 361 天、一年 12 个月"这种加起来不等于一年的表。
     *
     * 原来的 `jupiter_year` / `jupiter_month` **没有删**：实测 4332.5 天与木星公转
     * 周期（4332.589 天）吻合，是有效数据，作为「木星恒星年」在页面上另起一行显示，
     * 仍可在 `/calendar/table/jupiter` 逐行查看。
     */
    jupiter: { module: "tropical", year: "tropical_year", month: "tropical_month" },
    tropical: { module: "tropical", year: "tropical_year", month: "tropical_month" },
    tree: { module: "tree", year: "tree_year", month: "tree_month" },
    climate: { module: "climate", year: "climate_year", month: "climate_month" }
};

/** 取一套历法的表名。 */
export const tablesOf = (systemId: string): { module: string; year: string; month: string } | undefined =>
    TABLES[systemId];

/**
 * 读某一时刻在某套历法里的年月表达。
 *
 * @param absolute 时刻的 `absolute`
 */
export async function loadSystemMoment(systemId: string, absolute: bigint): Promise<SystemMoment | null> {
    const tables = TABLES[systemId];
    if (tables === undefined) {
        return null;
    }

    const parameters = { a: absolute };

    /* 年表里真正表示年份的列：朔望历叫 `gregorian_year`，其余叫 `absolute` */
    const yearColumn = tables.year === "synodic_calendar_year" ? "gregorian_year" : "absolute";

    const [yearRows, monthRows, gregoryRows] = await Promise.all([
        queryModule(
            tables.module,
            `SELECT "relative", "${yearColumn}" AS ownYear, "start", "end", "lengthOfMonth", "leap"
             FROM "${tables.year}" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            parameters
        ),
        queryModule(
            tables.module,
            `SELECT "ordinal", "name", "leap", "start", "end", "lengthOfDay"
             FROM "${tables.month}" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            parameters
        ),
        /*
         * 公历年：从 `gregory_month` 取。
         *
         * 任何历法都需要它——干支年要按公历年推、以公历为参照的历法直接显示它。
         * 查的是 `gregory` 分库（不是本历的分库），所以模块名写死。
         */
        queryModule(
            "gregory",
            `SELECT "year" AS gregorianYear FROM "gregory_month" WHERE "start" <= :a AND "end" >= :a LIMIT 1`,
            parameters
        )
    ]);

    const year = yearRows[0];
    const month = monthRows[0];
    if (year === undefined || month === undefined) {
        return null;
    }

    /*
     * `gregory_month.year` 是"公历年 + 10000"，减回去才是年份。
     *
     * 取不到时退回本历自己的年份——**这是兜底而不是等价**：
     * 格里高利历的公历年与轩辕历的年号是两个不同的数，兜底只保证不崩，
     * 正常路径上 `gregory_month` 一定有对应行。
     */
    const gregorianYear =
        gregoryRows[0] === undefined
            ? Number(bigOf(year.ownYear))
            : Number(bigOf(gregoryRows[0].gregorianYear)) - 10_000;

    const monthStart = bigOf(month.start);
    return {
        ownYear: Number(bigOf(year.ownYear)),
        ceYear: gregorianYear,
        yearNumber: Number(bigOf(year.relative)),
        yearStart: bigOf(year.start),
        yearEnd: bigOf(year.end),
        monthsInYear: Number(bigOf(year.lengthOfMonth)),
        yearLeap: booleanOf(year.leap),
        monthOrdinal: Number(bigOf(month.ordinal)),
        monthName: String(month.name ?? ""),
        monthLeap: booleanOf(month.leap),
        monthStart,
        monthEnd: bigOf(month.end),
        monthLength: Number(bigOf(month.lengthOfDay)),
        // 月内第几天：按 absolute 差算。月内的日界是等距的（一天 86400 秒）
        dayInMonth: Number((absolute - monthStart) / 86_400n) + 1
    };
}

/**
 * 读某一年的**全部月**，用于在右栏列出这一年的月表。
 *
 * 这是"突出各自特点"的关键一块：朔望历一年 12–13 个月、节气表 24 个月、
 * 木星历 12 个月但每个 361 天——把月名与天数列出来，差异一眼可见。
 */
export async function loadSystemMonths(systemId: string, yearStart: bigint, yearEnd: bigint): Promise<
    { ordinal: number; name: string; leap: boolean; lengthOfDay: number; start: bigint; end: bigint }[]
> {
    const tables = TABLES[systemId];
    if (tables === undefined) {
        return [];
    }

    const rows = await queryModule(
        tables.module,
        `SELECT "ordinal", "name", "leap", "lengthOfDay", "start", "end"
         FROM "${tables.month}" WHERE "start" >= :from AND "start" <= :to ORDER BY "start"`,
        { from: yearStart, to: yearEnd }
    );

    return rows.map((row) => ({
        ordinal: Number(bigOf(row.ordinal)),
        name: String(row.name ?? ""),
        leap: booleanOf(row.leap),
        lengthOfDay: Number(bigOf(row.lengthOfDay)),
        start: bigOf(row.start),
        end: bigOf(row.end)
    }));
}

/** 响应式封装：光标（`absolute`）或历法变化时重取。 */
export function useSystemMoment(
    systemId: Ref<string>,
    absolute: Ref<bigint>
): {
    moment: Ref<SystemMoment | null>;
    months: Ref<Awaited<ReturnType<typeof loadSystemMonths>>>;
    loading: Ref<boolean>;
    error: Ref<string>;
} {
    const moment = ref<SystemMoment | null>(null);
    const months = ref<Awaited<ReturnType<typeof loadSystemMonths>>>([]);
    const loading = ref(false);
    const error = ref("");
    let sequence = 0;

    const load = (): void => {
        sequence += 1;
        const token = sequence;
        loading.value = true;

        void loadSystemMoment(systemId.value, absolute.value)
            .then(async (result) => {
                if (token !== sequence) {
                    return;
                }
                moment.value = result;
                error.value = "";
                if (result !== null) {
                    const list = await loadSystemMonths(systemId.value, result.yearStart, result.yearEnd);
                    if (token === sequence) {
                        months.value = list;
                    }
                } else {
                    months.value = [];
                }
            })
            .catch((cause: unknown) => {
                if (token !== sequence) {
                    return;
                }
                moment.value = null;
                months.value = [];
                error.value = cause instanceof Error ? cause.message : String(cause);
            })
            .finally(() => {
                if (token === sequence) {
                    loading.value = false;
                }
            });
    };

    watch([systemId, absolute], load, { immediate: true });

    return { moment, months, loading, error };
}

/** 把 `absolute` 落在某个月的第几天算成"初一 / 初二…"这套农历日名。 */
export const lunarDayName = (nth: number): string => {
    const names = [
        "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
        "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
        "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
    ];
    return names[nth - 1] ?? `${nth}`;
};

/**
 * 月内的日序显示：不同历法用不同习惯。
 *
 * @param dayInMonth 本历这个月的第几天
 * @param monthName 本历的月名（月首那一格写它）
 * @param lunarDay 农历日名（来自 `synodic`，任何历法都能拿到）
 * @param civilDay 公历日
 *
 * ## 为什么要传 `civilDay`
 *
 * 格里高利历与回归历的"月内第几天"**恰好等于公历日**，于是格子会显示成
 * `10 / 10` —— 第二行零信息量。这种情况改显示农历日，那才是有用的东西，
 * 也正是中式公历台历的排法（大数字公历、小字农历）。
 *
 * 判断"相等"而不是按历法 id 写死：与公历对齐的历法不止一套，
 * 按 id 写死会在新增历法时漏掉。
 */
export const dayLabelOf = (
    systemId: string,
    dayInMonth: number,
    monthName: string,
    lunarDay: string | null = null,
    civilDay: number | null = null
): string => {
    /* 第一行已经是公历日，第二行再写一遍没有意义 */
    const duplicatesCivil = civilDay !== null && dayInMonth === civilDay;

    switch (systemId) {
        case "natural":
        case "synodic":
        case "astronomy":
            // 月相历用农历日名
            return dayInMonth === 1 ? (monthName || lunarDayName(dayInMonth)) : lunarDayName(dayInMonth);
        case "climate":
            // 节气历：一天就是"某气第 N 天"，第 1 天写节气名
            return dayInMonth === 1 ? monthName : `第 ${dayInMonth} 日`;
        case "tree":
            // 干支历：月首写月名（酉月），其余写日序
            return dayInMonth === 1 ? monthName : `第 ${dayInMonth} 日`;
        default:
            if (dayInMonth === 1) {
                return monthName;
            }
            return duplicatesCivil && lunarDay !== null ? lunarDay : `${dayInMonth}`;
    }
};

/** 这个 `absolute` 落在系统月的第几天——供格子用。 */
export const dayInMonthOf = (absolute: bigint, monthStart: bigint): number =>
    Number((absolute - monthStart) / 86_400n) + 1;

/** 供模板用的再导出。 */
export { computed };
