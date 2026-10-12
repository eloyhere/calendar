import type { Proleptic } from "../temporal/temporal";

export interface Week extends Proleptic {
    lengthOfDay: bigint;
}
