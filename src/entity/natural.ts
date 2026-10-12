import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";
/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 轩辕历法，以-2696-03-11 01:45:49建元。
 */
export interface NaturalYear extends Proleptic {
    months: Array<NaturalMonth>;
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

export interface NaturalMonth extends Proleptic {
    year: NaturalYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}
