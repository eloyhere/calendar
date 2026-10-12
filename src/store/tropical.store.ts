import type { TropicalMonth } from "../entity/tropical";
import { defineEntityStore } from "./store";

/**
 * 回归年月 store（模块 tropical，表 tropical_month；年表 tropical_year 由 TropicalService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useTropicalStore() 省略入参时由默认服务工厂解析 TropicalService，也能注入自定义 service。
 */
export const useTropicalStore = defineEntityStore<bigint, TropicalMonth>("tropical");
