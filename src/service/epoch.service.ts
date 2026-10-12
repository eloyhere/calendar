import type { Epoch } from "../entity/epoch";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 世 service（表 epoch，约 970 行）：建元当天为第 1 世，1 世 = 30 朔望月。
 * 实体只声明了 Proleptic 的公共列与 chronologies，父列 perform 以 src/sql/epoch.sql 为准。
 */
export class EpochService extends AbstractService<bigint, Epoch> {
    /** 注入世 repository。 */
    public constructor(repository: EntityRepository<bigint, Epoch>) {
        super(repository);
    }

    /** 按父运取全部世（parent = perform 主键）。 */
    public async byParent(parent: bigint): Promise<Page<bigint, Epoch>> {
        return await this.repository.findBy(this.equal({ perform: parent }));
    }
}
