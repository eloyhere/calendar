import type { TreeMonth } from "../entity/tree";
import { defineEntityStore } from "./store";

/**
 * 干支月 store（模块 tree，表 tree_month；年表 tree_year 由 TreeService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useTreeStore() 省略入参时由默认服务工厂解析 TreeService，也能注入自定义 service。
 */
export const useTreeStore = defineEntityStore<bigint, TreeMonth>("tree");
