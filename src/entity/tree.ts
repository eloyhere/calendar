import type { Part } from "./part";
import type { Phenology } from "./phenology";
import type { Proleptic } from "../temporal/temporal";
import type { Week } from "./week";
/**
 * 干支年。以立春为分界。
 */
export interface TreeYear extends Proleptic {
    months: Array<TreeMonth>;
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

export interface TreeMonth extends Proleptic {
    year: TreeYear;
    phenologies: Array<Phenology>;
    lengthOfPhenology: bigint;
    weeks: Array<Week>;
    lengthOfWeek: bigint;
    parts: Array<Part>;
    lengthOfPart: bigint;
    lengthOfDay: bigint;
    leap: boolean;
}
