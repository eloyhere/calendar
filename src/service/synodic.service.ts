import type { SynodicMonth, SynodicYear } from "../entity/synodic";
import type { Optional } from "../share/optional";
import type { EntityRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 朔望月 service（表 synodic_month，290,654 行），并代理同模块的朔望年表
 * synodic_calendar_year（23,500 行）。
 * 源表每行一个月：name/label 来自列 C，leap 表示闰月，size 为"大/小"，
 * month_end_day 为月末积日，end = 下一月朔月 - 1 秒。
 */
export class SynodicService extends AbstractService<bigint, SynodicMonth> {
    /** 年表端口（表 synodic_calendar_year）：一年 12 或 13 个月。 */
    protected readonly years: YearRepository<SynodicYear>;

    /**
     * 注入朔望月 repository。
     * repository 一个模块一个类、同时实现月表与年表两张表，
     * 因此省略 yearRepository 时直接复用同一个实例。
     */
    public constructor(
        repository: EntityRepository<bigint, SynodicMonth> & YearRepository<SynodicYear>,
        yearRepository?: YearRepository<SynodicYear>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
    }

    /** 按所属朔望年取全部月（year = synodic_calendar_year 主键）。 */
    public async byYear(year: bigint): Promise<Page<bigint, SynodicMonth>> {
        return await this.repository.findBy(this.equal({ year: year }));
    }

    /** 取全部闰月（leap = true），每年 12 或 13 个月中的第 13 个月。 */
    public async leapMonths(): Promise<Page<bigint, SynodicMonth>> {
        return await this.repository.findBy(this.equal({ leap: true }));
    }

    /** 按年内月序取月（ordinal = 1..12/13，块内序号见 relative）。 */
    public async byOrdinal(ordinal: bigint): Promise<Page<bigint, SynodicMonth>> {
        return await this.repository.findBy(this.equal({ ordinal: ordinal }));
    }

    /** 朔望年总数（表 synodic_calendar_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取朔望年，未命中时返回空 Optional（表 synodic_calendar_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<SynodicYear>> {
        return await this.years.findYearByIdentity(identity);
    }
}
