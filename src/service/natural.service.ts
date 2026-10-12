import type { NaturalMonth, NaturalYear } from "../entity/natural";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 轩辕历月 service（表 natural_month），并代理同模块的轩辕历年表 natural_year。
 * 以 -2696-03-11 01:45:49 建元；行数据可推导，暂不物化（docs/design.md §3）。
 */
export class NaturalService extends AbstractService<bigint, NaturalMonth> {
    /** 年表端口（表 natural_year）。 */
    protected readonly years: YearRepository<NaturalYear>;

    /**
     * 注入轩辕历月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, NaturalMonth> & YearRepository<NaturalYear>,
        yearRepository?: YearRepository<NaturalYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属轩辕年取全部月（year = natural_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, NaturalMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 轩辕年总数（表 natural_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取轩辕年，未命中时返回空 Optional（表 natural_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<NaturalYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
