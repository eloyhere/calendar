import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";
/**
 * 木星历法
 */
export interface JupiterYear extends Proleptic {
    months: Array<JupiterMonth>;
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

export interface JupiterMonth extends Proleptic {
    year: JupiterYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}
