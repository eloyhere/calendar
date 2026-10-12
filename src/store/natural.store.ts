import type { NaturalMonth } from "../entity/natural";
import { defineEntityStore } from "./store";

/**
 * 轩辕历月 store（模块 natural，表 natural_month；年表 natural_year 由 NaturalService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useNaturalStore() 省略入参时由默认服务工厂解析 NaturalService，也能注入自定义 service。
 */
export const useNaturalStore = defineEntityStore<bigint, NaturalMonth>("natural");
