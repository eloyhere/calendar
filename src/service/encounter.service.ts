import type { Encounter } from "../entity/encounter";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 会 service（表 encounter）：建元当天为第 1 会，1 会 = 30 运 = 360 世 = 10800 朔望月。
 * 实体只声明了 Proleptic 的公共列与 performs，父列 primary 以 src/sql/encounter.sql 为准。
 */
export class EncounterService extends AbstractService<bigint, Encounter> {
    /** 注入会 repository。 */
    public constructor(repository: EntityRepository<bigint, Encounter>) {
        super(repository);
    }

    /** 按父元取全部会（parent = primary 主键）。 */
    public async byParent(parent: bigint): Promise<Page<bigint, Encounter>> {
        return await this.repository.findBy(this.equal({ primary: parent }));
    }
}
