import type { Perform } from "./perform";
import type { Proleptic } from "../temporal/temporal";
/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 运
 * 建元当天为第一运，1元=12会=360世=129600朔望年。
 */
export interface Primary extends Proleptic {
    performs: Array<Perform>;
    lengthOfPerform: bigint;
}
