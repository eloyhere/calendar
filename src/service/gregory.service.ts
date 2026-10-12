import type { GregoryMonth, GregoryYear } from "../entity/gregory";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 格里高利历月 service（表 gregory_month），并代理同模块的格里高利历年表 gregory_year。
 * proleptic 历法，可直接由 temporal 展开；行数据可推导，暂不物化（docs/design.md §3）。
 */
export class GregoryService extends AbstractService<bigint, GregoryMonth> {
    /** 年表端口（表 gregory_year）。 */
    protected readonly years: YearRepository<GregoryYear>;

    /**
     * 注入格里高利历月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, GregoryMonth> & YearRepository<GregoryYear>,
        yearRepository?: YearRepository<GregoryYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属年份取全部月（year = gregory_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, GregoryMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 年份总数（表 gregory_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取年份，未命中时返回空 Optional（表 gregory_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<GregoryYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
