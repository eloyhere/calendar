import type { TropicalMonth, TropicalYear } from "../entity/tropical";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 回归年月 service（表 tropical_month），并代理同模块的回归年表 tropical_year。
 * 以回归年为年长；行数据可推导，暂不物化（docs/design.md §3）。
 */
export class TropicalService extends AbstractService<bigint, TropicalMonth> {
    /** 年表端口（表 tropical_year）。 */
    protected readonly years: YearRepository<TropicalYear>;

    /**
     * 注入回归年月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, TropicalMonth> & YearRepository<TropicalYear>,
        yearRepository?: YearRepository<TropicalYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属回归年取全部月（year = tropical_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, TropicalMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 回归年总数（表 tropical_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取回归年，未命中时返回空 Optional（表 tropical_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<TropicalYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
