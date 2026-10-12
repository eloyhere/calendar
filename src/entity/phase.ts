import type { Part } from "./part";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";

/** 相名，按源表 D~G 列的顺序：朔月、上弦、望月、下弦。 */
export const PHASE_NAMES: readonly string[] = ["朔月", "上弦", "望月", "下弦"];

/** 相长，天数。相与候同为 5 天。 */
export const LENGTH_OF_DAY: bigint = 5n;

/** 一相含几个 7 天的周。 */
export const LENGTH_OF_WEEK: bigint = 7n;

/** 相在月内的序号 1-4，与源表列序一致。 */
export const NEW_MOON: bigint = 1n;
export const FIRST_QUARTER: bigint = 2n;
export const FULL_MOON: bigint = 3n;
export const LAST_QUARTER: bigint = 4n;

/**
 * 相。
 *
 * 源表 D~G 列的朔月 / 上弦 / 望月 / 下弦，每个朔望月四条，始终齐全。
 * 相是**长度 5 天**的单位（`lengthOfDay`），与候同长；`lengthOfWeek` 记一相含几个
 * 7 天的周。`weeks` / `parts` 是相内部的细分集合。
 *
 * `identity` 是数据库自增主键；`absolute` 是全局相序号，
 * 自建元当月第一个相起算，从 1 递增；`relative` 是月内序号 1-4。
 */
export interface Phase extends Proleptic {
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
