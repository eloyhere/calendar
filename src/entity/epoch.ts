import type { Chronology } from "./chronology";
import type { Proleptic } from "../temporal/temporal";
import type { Perform } from "./perform";
/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 世
 * 建元当天为第一世，1世=30朔望年。
 */
export interface Epoch extends Proleptic {
    perform: Perform;
    chronologies: Array<Chronology>;
    lengthOfChronology: bigint;
}
