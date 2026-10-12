import type { Epoch } from "./epoch";
import type { Proleptic } from "../temporal/temporal";
import type { Encounter } from "./encounter";
/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 运
 * 建元当天为第一运，1运=12世=360朔望年。
 */
export interface Perform extends Proleptic {
    encounter: Encounter;
    epoches: Array<Epoch>;
    lengthOfEpoches: bigint;
}
