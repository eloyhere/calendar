import type { AstronomyMonth } from "../entity/astronomy";
import { defineEntityStore } from "./store";

/**
 * 天文纪年月 store（模块 astronomy，表 astronomy_month；年表 astronomy_year 由 AstronomyService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useAstronomyStore() 省略入参时由默认服务工厂解析 AstronomyService，也能注入自定义 service。
 */
export const useAstronomyStore = defineEntityStore<bigint, AstronomyMonth>("astronomy");
