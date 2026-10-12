import type { Entity } from "./entity";
//建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
//当前表的年月日时分秒均为天文纪年。
export interface Temporal extends Entity<bigint> {
    year: bigint;
    month: bigint;
    day: bigint;
    hour: bigint;
    minute: bigint;
    second: bigint;
    days: bigint; //从-2696-03-11 01:45:49的日绝对序列，当天为1，前一天为-1，后一天为2。
    seconds: bigint; //当天的秒数。
}
