import type { GregoryMonth } from "../entity/gregory";
import { defineEntityStore } from "./store";

/**
 * 格里高利历月 store（模块 gregory，表 gregory_month；年表 gregory_year 由 GregoryService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useGregoryStore() 省略入参时由默认服务工厂解析 GregoryService，也能注入自定义 service。
 */
export const useGregoryStore = defineEntityStore<bigint, GregoryMonth>("gregory");
