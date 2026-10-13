import type { Primary } from "../entity/primary";
import type { EntityRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 元 service（表 primary）。
 * 建元所在的朔望年为第 1 元，1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望年；
 * 全库朔望年总数 23500 < 129600，因此实际只有第 0、1 元（docs/design.md §4）。
 * 元是元会运世层级的根，表 primary 没有父列，故本 service 不提供 byParent。
 */
export class PrimaryService extends AbstractService<bigint, Primary> {
    /** 注入元 repository。 */
    public constructor(repository: EntityRepository<bigint, Primary>) {
        super(repository);
    }
}
