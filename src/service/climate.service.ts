import type { Climate, ClimateMonth, ClimateYear } from "../entity/climate";
import type { Optional } from "../share/optional";
import type { EntityRepository, MonthRepository, Page, YearRepository } from "./service";
import { AbstractService } from "./service";

/**
 * 气候 service（模块 climate，气候 + 节气纪年）。
 * 主表 climate：长度 5 天的单位；每个朔望月自月首起每 5 天一个，末段按月末截断。
 * 同模块还有两张更粗的表，由本类按 *Year* / *Month* 后缀代理：
 * - climate_month：节气纪年的月；climate_year：节气纪年的年。
 *   两张表都按天文历法规则定建元，行数据需由朔望月 / 回归年换算生成，暂不物化（docs/design.md §3）。
 */
export class ClimateService extends AbstractService<bigint, Climate> {
    /** 年表端口（表 climate_year）。 */
    protected readonly years: YearRepository<ClimateYear>;

    /** 月表端口（表 climate_month）。 */
    protected readonly months: MonthRepository<ClimateMonth>;

    /**
     * 注入气候 repository。
     * repository 一个模块一个类、同时实现本模块三张表，
     * 因此省略 yearRepository / monthRepository 时都直接复用同一个实例；
     * 装配根（src/service/factory.ts）正是零参构造 repository 后把同一实例传两次。
     */
    public constructor(
        repository: EntityRepository<bigint, Climate> &
            YearRepository<ClimateYear> &
            MonthRepository<ClimateMonth>,
        yearRepository?: YearRepository<ClimateYear>,
        monthRepository?: MonthRepository<ClimateMonth>
    ) {
        super(repository);
        this.years = yearRepository ?? repository;
        this.months = monthRepository ?? repository;
    }

    /**
     * 按所属节气月取全部气候（month = climate_month 主键）。
     * 气候自月首起每 5 天一个，故一个节气月内的气候首尾相接、无缝无叠。
     */
    public async byMonth(month: bigint): Promise<Page<bigint, Climate>> {
        return await this.repository.findBy(this.equal({ month: month }));
    }

    /** 节气年总数（表 climate_year）。 */
    public async countYears(): Promise<bigint> {
        return await this.years.countYears();
    }

    /** 按主键取节气年，未命中时返回空 Optional（表 climate_year）。 */
    public async findYearByIdentity(identity: bigint): Promise<Optional<ClimateYear>> {
        return await this.years.findYearByIdentity(identity);
    }

    /** 节气月总数（表 climate_month）。 */
    public async countMonths(): Promise<bigint> {
        return await this.months.countMonths();
    }

    /** 按主键取节气月，未命中时返回空 Optional（表 climate_month）。 */
    public async findMonthByIdentity(identity: bigint): Promise<Optional<ClimateMonth>> {
        return await this.months.findMonthByIdentity(identity);
    }
}
