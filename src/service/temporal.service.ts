import type { Temporal } from "../entity/temporal";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page } from "./service";
import { AbstractService } from "./service";

/**
 * 绝对时间坐标 service（表 temporal，约 180 万行）。
 * identity 即 absolute（docs/design.md §2）：days 从建元 -2696-03-11 01:45:49 起算，
 * 当天为 1；seconds 是当天 00:00:00 起的秒数；absolute = days * 86400 + seconds。
 */
export class TemporalService extends AbstractService<bigint, Temporal> {
    /** 注入绝对时间 repository。 */
    public constructor(repository: EntityRepository<bigint, Temporal>) {
        super(repository);
    }

    /** 按"日序号 + 当日秒数"精确定位唯一时刻，未命中时返回空 Optional。 */
    public async at(days: bigint, seconds: bigint): Promise<Optional<Temporal>> {
        return await this.first(this.equal({ days: days, seconds: seconds }));
    }

    /** 取 absolute ∈ [start, end) 的全部时刻，即区间 [start, end)。 */
    public async between(start: bigint, end: bigint): Promise<Page<bigint, Temporal>> {
        return await this.repository.findBy(this.range("absolute", start, end));
    }
}
