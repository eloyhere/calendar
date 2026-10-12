import type { JupiterMonth } from "../entity/jupiter";
import { defineEntityStore } from "./store";

/**
 * 木星历月 store（模块 jupiter，表 jupiter_month；年表 jupiter_year 由 JupiterService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useJupiterStore() 省略入参时由默认服务工厂解析 JupiterService，也能注入自定义 service。
 */
export const useJupiterStore = defineEntityStore<bigint, JupiterMonth>("jupiter");
