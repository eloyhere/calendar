import type { AstronomyMonth, AstronomyYear } from "../entity/astronomy";
import type { ClimateMonth, ClimateYear } from "../entity/climate";
import type { GregoryMonth, GregoryYear } from "../entity/gregory";
import type { JupiterMonth, JupiterYear } from "../entity/jupiter";
import type { NaturalMonth, NaturalYear } from "../entity/natural";
import type { SynodicMonth, SynodicYear } from "../entity/synodic";
import type { TreeMonth, TreeYear } from "../entity/tree";
import type { TropicalMonth, TropicalYear } from "../entity/tropical";
import type { Calendar } from "./calendar";

export interface RawDateTime {
    astronomy: Calendar<AstronomyYear, AstronomyMonth>;
    climate: Calendar<ClimateYear, ClimateMonth>;
    gregory: Calendar<GregoryYear, GregoryMonth>;
    jupiter: Calendar<JupiterYear, JupiterMonth>;
    natural: Calendar<NaturalYear, NaturalMonth>;
    synodic: Calendar<SynodicYear, SynodicMonth>;
    tree: Calendar<TreeYear, TreeMonth>;
    tropical: Calendar<TropicalYear, TropicalMonth>;
    daysToNatural: bigint; //到-2696-03-11 01:45:49的天数，当天为1，前一天为-1.
    daysToGregory: bigint; //到格里高丽历法建元第一天的天数。
    daysToUnix: bigint; //到unix建元第一天的天数。
    hours: bigint; //到当天00:00.01的小时数，第一个为1.
    minute: bigint; //到当天00:00.01的分钟数，第一个为1.
    seconds: bigint; //到当天00:00.01的秒数，第一个为1.
}
