import type { Primary } from "../entity/primary";
import type { EntityRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 元 service（表 primary）。
 * 建元当天为第 1 元，1 元 = 12 会 = 360 运 = 4320 世 = 129600 朔望月；
 * 全库朔望月总数 290654 < 129600 × 3，因此实际只有第 1 元（docs/design.md §4）。
 * 元是元会运世层级的根，表 primary 没有父列，故本 service 不提供 byParent。
 */
export class PrimaryService extends AbstractService<bigint, Primary> {
    /** 注入元 repository。 */
    public constructor(repository: EntityRepository<bigint, Primary>) {
        super(repository);
    }
}
