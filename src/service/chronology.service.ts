import type { Chronology } from "../entity/chronology";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 纪年 service（表 chronology，23,500 行）。
 * 一个朔望年一条，与八部历法的年表一一对应：八列年各取「纪年首所在」的那一年，
 * 八列 lengthOf<X>Month 是那一年的月数（docs/design.md §3）。
 * 列名以 src/sql/chronology.sql 为准。
 */
export class ChronologyService extends AbstractService<bigint, Chronology> {
    /** 注入纪年 repository。 */
    public constructor(repository: EntityRepository<bigint, Chronology>) {
        super(repository);
    }

    /** 按父世取全部纪年（epoch = epoch 主键）。 */
    public async byEpoch(epoch: bigint): Promise<Page<bigint, Chronology>> {
        return await this.repository.findBy(this.equal({ epoch: epoch }));
    }
}
