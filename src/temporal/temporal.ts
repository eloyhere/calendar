import type { Entity } from "../entity/entity";
import type { Temporal } from "../entity/temporal";

export interface TemporalAdjuster {}
export interface TemporalAccesor {}
export interface TemporalAmount {}
export interface TemporalField {}

/**
 * 建元为-2696-03-11 01:45:49。当天是轩辕纪年/黄帝纪年，1年1月1日，周一。
 * 虚拟实体，不计入数据表设计。
 * absolute 从建元第一天开始的全表序列数，当天为1，往前为-1，往后为2.
 * relative 如果有父表依赖，则是在父表依赖层级当中的相对唯一序列数，是从1开始往后递增的自然数。比如表B依赖与表A，那么在进入下一个表A对象之后，表B的relative重新从1开始计数。
 * [start, end);
 */

export interface Proleptic extends Entity<bigint>, TemporalAmount {
    absolute: bigint; //
    relative: bigint; //
    start: Temporal;
    end: Temporal;
}

export const Identity = {
    Date: Symbol.for("Date"),
    DateTime: Symbol.for("DateTime")
};
export abstract class Date<D extends Date<D>> {
    identity: symbol = Identity.Date;

    public abstract plusDays(amount: bigint): D;

    public abstract plus(date: D): D;
}

export abstract class DateTime<D> {
    identity: symbol = Identity.DateTime;

    public abstract plusDays(amount: bigint): D;
}
