import type { Perform } from "./perform";
import type { Proleptic } from "../temporal/temporal";
/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 会
 * 建元当天为第一会，1会=30运=360世=10800朔望年。
 */
export interface Encounter extends Proleptic {
    performs: Array<Perform>;
    lengthOfPerform: bigint;
    lengthOfEpoch: bigint;
    lengthOfChronology: bigint;
}
