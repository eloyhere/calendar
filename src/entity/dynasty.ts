import type { Chronology } from "./chronology";
import type { Era } from "./era";
import type { Proleptic } from "../temporal/temporal";

export interface Dynasty extends Proleptic {
    eras: Array<Era>;
    lengthOfEra: bigint;
    chronologies: Array<Chronology>;
    lengthOfChronology: bigint;
}
