import type { Chronology } from "../entity/chronology";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 纪年 service（表 chronology）。
 * calendar.xlsx 不含纪年数据，表建而未填（docs/design.md §3）。
 * 实体声明了 8 种纪年，但表里只有 synodic 一种，列名以 src/sql/chronology.sql 为准。
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
