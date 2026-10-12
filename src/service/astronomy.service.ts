import type { AstronomyMonth, AstronomyYear } from "../entity/astronomy";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 天文纪年月 service（表 astronomy_month），并代理同模块的天文纪年表 astronomy_year。
 * 两张表都按天文历法规则定建元，行数据需由朔望月 / 回归年换算生成，暂不物化（docs/design.md §3）。
 */
export class AstronomyService extends AbstractService<bigint, AstronomyMonth> {
    /** 年表端口（表 astronomy_year）。 */
    protected readonly years: YearRepository<AstronomyYear>;

    /**
     * 注入天文纪年月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, AstronomyMonth> & YearRepository<AstronomyYear>,
        yearRepository?: YearRepository<AstronomyYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属天文年取全部月（year = astronomy_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, AstronomyMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 天文年总数（表 astronomy_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取天文年，未命中时返回空 Optional（表 astronomy_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<AstronomyYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
