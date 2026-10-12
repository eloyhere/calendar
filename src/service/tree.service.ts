import type { TreeMonth, TreeYear } from "../entity/tree";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 干支月 service（表 tree_month），并代理同模块的干支年表 tree_year。
 * 干支年以立春为分界；行数据可推导，暂不物化（docs/design.md §3）。
 */
export class TreeService extends AbstractService<bigint, TreeMonth> {
    /** 年表端口（表 tree_year）。 */
    protected readonly years: YearRepository<TreeYear>;

    /**
     * 注入干支月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, TreeMonth> & YearRepository<TreeYear>,
        yearRepository?: YearRepository<TreeYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属干支年取全部月（year = tree_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, TreeMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 干支年总数（表 tree_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取干支年，未命中时返回空 Optional（表 tree_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<TreeYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
