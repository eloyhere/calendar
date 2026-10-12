import type { AstronomyYear, AstronomyMonth } from "../entity/astronomy";
import type { ClimateYear, ClimateMonth } from "../entity/climate";
import type { GregoryYear, GregoryMonth } from "../entity/gregory";
import type { JupiterYear, JupiterMonth } from "../entity/jupiter";
import type { NaturalYear, NaturalMonth } from "../entity/natural";
import type { SynodicYear, SynodicMonth } from "../entity/synodic";
import type { TreeYear, TreeMonth } from "../entity/tree";
import type { TropicalYear, TropicalMonth } from "../entity/tropical";
import type { Calendar } from "./calendar";

export interface RawDate {
    astronomy: Calendar<AstronomyYear, AstronomyMonth>;
    climate: Calendar<ClimateYear, ClimateMonth>;
    gregory: Calendar<GregoryYear, GregoryMonth>;
    jupiter: Calendar<JupiterYear, JupiterMonth>;
    natural: Calendar<NaturalYear, NaturalMonth>;
    synodic: Calendar<SynodicYear, SynodicMonth>;
    tree: Calendar<TreeYear, TreeMonth>;
    tropical: Calendar<TropicalYear, TropicalMonth>;
}

export class Date {}
