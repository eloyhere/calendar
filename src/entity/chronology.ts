import type { AstronomyYear } from "./astronomy";
import type { ClimateYear } from "./climate";
import type { GregoryYear } from "./gregory";
import type { JupiterYear } from "./jupiter";
import type { NaturalYear } from "./natural";
import type { Proleptic } from "../temporal/temporal";
import type { SynodicYear } from "./synodic";
import type { TreeYear } from "./tree";
import type { TropicalYear } from "./tropical";
import type { Epoch } from "./epoch";

export interface Chronology extends Proleptic {
    epoch: Epoch;

    astronomy: AstronomyYear;
    lengthOfAstronomyMonth: bigint;

    climate: ClimateYear;
    lengthOfClimateMonth: bigint;

    gregory: GregoryYear;
    lengthOfGregoryMonth: bigint;

    jupiter: JupiterYear;
    lengthOfJupiterMonth: bigint;

    natural: NaturalYear;
    lengthOfNaturalMonth: bigint;

    tree: TreeYear;
    lengthOfTreeMonth: bigint;

    tropical: TropicalYear;
    lengthOfTropicalMonth: bigint;

    synodic: SynodicYear;
    lengthOfSynodicMonth: bigint;
}
