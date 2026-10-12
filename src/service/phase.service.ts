import type { Phase } from "../entity/phase";
import type { EntityRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 相 service（表 phase）。
 * 相：朔月 / 上弦 / 望月 / 下弦。源表 D~G 列，每个朔望月四条，始终齐全；相是 5 天的单位，与候同长，end = 下一个相起点 - 1。
 */
export class PhaseService extends AbstractService<bigint, Phase> {
    /** 注入相 repository。 */
    public constructor(repository: EntityRepository<bigint, Phase>) {
        super(repository);
    }
}
