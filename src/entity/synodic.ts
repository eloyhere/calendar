import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";
/**
 * 朔望年，一年12-13月
 */
export interface SynodicYear extends Proleptic {
    months: Array<SynodicMonth>;
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

export interface SynodicMonth extends Proleptic {
    year: SynodicYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}
