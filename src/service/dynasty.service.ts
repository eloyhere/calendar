import type { Dynasty } from "../entity/dynasty";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 朝代 service（表 dynasty）。
 * calendar.xlsx 不含朝代数据，表建而未填（docs/design.md §3）；
 * 实体未声明 name 列，列名以 src/sql/dynasty.sql 为准。
 */
export class DynastyService extends AbstractService<bigint, Dynasty> {
    /** 注入朝代 repository。 */
    public constructor(repository: EntityRepository<bigint, Dynasty>) {
        super(repository);
    }

    /** 按名称模糊匹配朝代（name LIKE %name%）。 */
    public async byName(name: string): Promise<Page<bigint, Dynasty>> {
        return await this.repository.findBy(this.like({ name: `%${name}%` }));
    }
}
