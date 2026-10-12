import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";
/**
 * 格里高丽历法
 */
export interface GregoryYear extends Proleptic {
    months: Array<GregoryMonth>;
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

export interface GregoryMonth extends Proleptic {
    year: GregoryYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}
