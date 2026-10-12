import type { JupiterMonth, JupiterYear } from "../entity/jupiter";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 木星历月 service（表 jupiter_month），并代理同模块的木星历年表 jupiter_year。
 * 行数据可推导，暂不物化（docs/design.md §3）。
 */
export class JupiterService extends AbstractService<bigint, JupiterMonth> {
    /** 年表端口（表 jupiter_year）。 */
    protected readonly years: YearRepository<JupiterYear>;

    /**
     * 注入木星历月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, JupiterMonth> & YearRepository<JupiterYear>,
        yearRepository?: YearRepository<JupiterYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属木星年取全部月（year = jupiter_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, JupiterMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 木星年总数（表 jupiter_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取木星年，未命中时返回空 Optional（表 jupiter_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<JupiterYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
