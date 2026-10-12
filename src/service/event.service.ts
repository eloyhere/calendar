import type { Event } from "../entity/event";
import type { EntityRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 历史事件 service（表 event）。
 * 只记两类事：年号起止、朝代更迭；cause 与 result 无来源，保持空。
 */
export class EventService extends AbstractService<bigint, Event> {
    /** 注入历史事件 repository。 */
    public constructor(repository: EntityRepository<bigint, Event>) {
        super(repository);
    }
}
