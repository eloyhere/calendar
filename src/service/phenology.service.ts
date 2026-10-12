import type { Phenology } from "../entity/phenology";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 候 service（表 phenology，约 59 万行）：节气 / 中气。
 * 源表 H~M 列，每行最多一条主节气（kind=1）、一条主中气（kind=2）、一条副节中气（kind=3）。
 * 实体只声明了 Proleptic 的公共列，name / kind / year 三列以 src/sql/phenology.sql 为准。
 */
export class PhenologyService extends AbstractService<bigint, Phenology> {
    /** 注入候 repository。 */
    public constructor(repository: EntityRepository<bigint, Phenology>) {
        super(repository);
    }

    /** 按类别取候：1 主节气、2 主中气、3 副节中气。 */
    public async byKind(kind: bigint): Promise<Page<bigint, Phenology>> {
        return await this.repository.findBy(this.equal({ kind: kind }));
    }

    /** 按名称模糊匹配候（name LIKE %name%）。 */
    public async byName(name: string): Promise<Page<bigint, Phenology>> {
        return await this.repository.findBy(this.like({ name: `%${name}%` }));
    }

    /** 按所属朔望年取候（year = synodic_calendar_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, Phenology>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }
}
