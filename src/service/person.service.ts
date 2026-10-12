import type { Person } from "../entity/event";
import type { EntityRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 人物 service（表 person）。
 * 人物是 Event.subject 的目标类型，行数据来自年号表出现过的君主姓名；gender / biography 无历史来源，保持空。
 */
export class PersonService extends AbstractService<bigint, Person> {
    /** 注入人物 repository。 */
    public constructor(repository: EntityRepository<bigint, Person>) {
        super(repository);
    }
}
