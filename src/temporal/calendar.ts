import type { AstronomyYear, AstronomyMonth } from "../entity/astronomy";
import type { ClimateYear, ClimateMonth } from "../entity/climate";
import type { GregoryYear, GregoryMonth } from "../entity/gregory";
import type { JupiterYear, JupiterMonth } from "../entity/jupiter";
import type { NaturalYear, NaturalMonth } from "../entity/natural";
import type { Part } from "../entity/part";
import type { Phenology } from "../entity/phenology";
import type { SynodicYear, SynodicMonth } from "../entity/synodic";
import type { TreeYear, TreeMonth } from "../entity/tree";
import type { TropicalYear, TropicalMonth } from "../entity/tropical";
import type { Week } from "../entity/week";

export type Year =
    | AstronomyYear
    | ClimateYear
    | GregoryYear
    | JupiterYear
    | NaturalYear
    | SynodicYear
    | TreeYear
    | TropicalYear;
export type Month =
    | AstronomyMonth
    | ClimateMonth
    | GregoryMonth
    | JupiterMonth
    | NaturalMonth
    | SynodicMonth
    | TreeMonth
    | TropicalMonth;

export interface Calendar<Y extends Year, M extends Month> {
    phenology: Phenology;
    dayOfPhenology: bigint;
    nextPhenology(): Calendar<Y, M>;

    part: Part;
    dayOfPart: bigint;
    nextPart(): bigint;

    week: Week;
    dayOfWeek: bigint;
    nextWeek(): Calendar<Y, M>;

    month: M;
    dayOfMonth: bigint;
    phenologyOfMonth: bigint;
    partOfMonth: bigint;
    weekOfMonth: bigint;
    nextMonth(): Calendar<Y, M>;

    year: Y;
    dayOfYear: bigint;
    phenologyOfYear: bigint;
    partOfYear: bigint;
    weekOfYear: bigint;
    monthOfYear: bigint;
    nextYear(): Calendar<Y, M>;
}
