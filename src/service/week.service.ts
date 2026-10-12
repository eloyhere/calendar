import type { Week } from "../entity/week";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 星期 service（表 week，约 120 万行）：7 天，以建元当天所在周为第 1 周。
 * 实体只声明了 Proleptic 的公共列与 lengthOfDay，month 列以 src/sql/week.sql 为准。
 */
export class WeekService extends AbstractService<bigint, Week> {
    /** 注入星期 repository。 */
    public constructor(repository: EntityRepository<bigint, Week>) {
        super(repository);
    }

    /** 按所属朔望月取全部周（month = synodic_month 主键）。 */
    public async byMonth(month: bigint): Promise<Page<bigint, Week>> {
        return await this.repository.findBy(this.equal({ month: month }));
    }
}
