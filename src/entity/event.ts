import type { Entity } from "./entity";
import type { Proleptic } from "../temporal/temporal";
export interface Person extends Proleptic {
    name: string; //姓名
    gender: string; //性别
    biography: string; //生平
}
export interface Event extends Entity<bigint> {
    name: string;
    subject: Person; //主要人
    colony: string; //群体
    cause: string; //原因
    incident: string; //事件过程和描述
    result: string; //结果
}

/** 事件类型：只有年号起止与朝代更迭两类。 */
export const DYNASTY_BEGIN = "dynasty_begin" as const;
export const DYNASTY_END = "dynasty_end" as const;
export const ERA_BEGIN = "era_begin" as const;
export const ERA_END = "era_end" as const;

/** 事件类型 -> 中文说明。 */
export const EVENT_KINDS: Readonly<Record<string, string>> = {
    dynasty_begin: "朝代建立",
    dynasty_end: "朝代灭亡",
    era_begin: "改元",
    era_end: "年号终止"
};
