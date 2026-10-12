import type { Part } from "../entity/part";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 旬 service（表 part，约 87 万行）：10 天，每个朔望月分上旬 / 中旬 / 下旬。
 * 实体只声明了 Proleptic 的公共列，month / day 两列以 src/sql/part.sql 为准。
 */
export class PartService extends AbstractService<bigint, Part> {
    /** 注入旬 repository。 */
    public constructor(repository: EntityRepository<bigint, Part>) {
        super(repository);
    }

    /** 按所属朔望月取全部旬（month = synodic_month 主键）。 */
    public async byMonth(month: bigint): Promise<Page<bigint, Part>> {
        return await this.repository.findBy(this.equal({ month: month }));
    }
}
