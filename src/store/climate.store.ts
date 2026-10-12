import type { Climate } from "../entity/climate";
import { defineEntityStore } from "./store";

/**
 * 气候 store（模块 climate，主表 climate；节气纪年表 climate_year 与 climate_month 由 ClimateService 代理）。
 * 主表 climate 是长度 5 天的气候，每个朔望月自月首起每 5 天一个、末段按月末截断；
 * 年表 climate_year 与月表 climate_month 只经 ClimateService 的 *Year* / *Month* 方法访问，
 * store 只承载主表 Climate 的行状态。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useClimateStore() 省略入参时由默认服务工厂解析 ClimateService，也能注入自定义 service。
 */
export const useClimateStore = defineEntityStore<bigint, Climate>("climate");
