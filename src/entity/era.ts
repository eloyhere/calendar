import type { Proleptic } from "../temporal/temporal";
import type { Chronology } from "./chronology";
import type { Dynasty } from "./dynasty";

export interface Era extends Proleptic {
    name: string;
    dynasty: Dynasty;
    chronologies: Array<Chronology>;
    lengthOfChronology: bigint;
}
