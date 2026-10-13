import type { Perform } from "../entity/perform";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 运 service（表 perform，66 行）：建元所在的朔望年为第 1 运，1 运 = 12 世 = 360 朔望年。
 * 实体只声明了 Proleptic 的公共列与 epoches，父列 encounter 以 src/sql/perform.sql 为准。
 */
export class PerformService extends AbstractService<bigint, Perform> {
    /** 注入运 repository。 */
    public constructor(repository: EntityRepository<bigint, Perform>) {
        super(repository);
    }

    /** 按父会取全部运（parent = encounter 主键）。 */
    public async byParent(parent: bigint): Promise<Page<bigint, Perform>> {
        return await this.repository.findBy(this.equal({ encounter: parent }));
    }
}
