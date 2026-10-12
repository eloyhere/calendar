import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";

/** 气候长，天数。气候与候、相同为 5 天。 */
export const LENGTH_OF_DAY: bigint = 5n;

/** 一气候含几个 7 天的周：⌊5/7⌋ = 0。 */
export const LENGTH_OF_WEEK: bigint = 0n;

/** 一气候含几个 10 天的旬：⌊5/10⌋ = 0。 */
export const LENGTH_OF_PART: bigint = 0n;

/**
 * 节气纪年，一年24个月。
 */
export interface ClimateYear extends Proleptic {
    months: Array<ClimateMonth>;
    lengthOfMonth: bigint;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}

export interface ClimateMonth extends Proleptic {
    year: ClimateYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}

/**
 * 气候。
 *
 * 长度 **5 天**的单位，与候、相同长但独立成表：每个朔望月自月首起每 5 天一个气候，
 * 末段不足 5 天时按月末截断，因此同一朔望月内的气候首尾相接、无缝无叠。
 *
 * 注意与上面的节气纪年区分：`ClimateYear` / `ClimateMonth` 是"以节气定年月"的历法
 * 系统，本接口对应的是气候表本身；两者同属模块 `climate`——一个 `climate.sqlite`、
 * 一份 `src/sql/climate.sql`，只是表不同（`climate` / `climate_year` / `climate_month`）。
 *
 * `identity` 是数据库自增主键；`absolute` 是全局气候序号，按时间升序从 1 递增。
 * `weeks` / `parts` 是气候内部的细分集合（复数属性 → 关联表 `climate_weeks` /
 * `climate_parts`），`lengthOfPart` 记一气候含几个旬，⌊5/10⌋ = 0。
 */
export interface Climate extends Proleptic {
    absolute: bigint;
    relative: bigint;
    name: string;
    lengthOfDay: bigint;
    lengthOfWeek: bigint;
    leap: boolean;
    month: bigint;
    weeks: Array<Week>;
    parts: Array<Part>;
    lengthOfPart: bigint;
}
