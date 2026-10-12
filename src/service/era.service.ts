import type { Era } from "../entity/era";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 年号 service（表 era）。
 * calendar.xlsx 不含年号数据，表建而未填（docs/design.md §3）；
 * 实体声明了 name，父列 dynasty 以 src/sql/era.sql 为准。
 */
export class EraService extends AbstractService<bigint, Era> {
    /** 注入年号 repository。 */
    public constructor(repository: EntityRepository<bigint, Era>) {
        super(repository);
    }

    /** 按名称模糊匹配年号（name LIKE %name%）。 */
    public async byName(name: string): Promise<Page<bigint, Era>> {
        return await this.repository.findBy(this.like({ name: `%${name}%` }));
    }

    /** 按父朝代取全部年号（dynasty = dynasty 主键）。 */
    public async byDynasty(dynasty: bigint): Promise<Page<bigint, Era>> {
        return await this.repository.findBy(this.equal({ dynasty: dynasty }));
    }
}
