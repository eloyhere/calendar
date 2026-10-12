import type { Temporal } from "../entity/temporal";
import { defineEntityStore } from "./store";

/**
 * 绝对时间 store（模块 temporal，表 temporal）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useTemporalStore() 省略入参时由默认服务工厂解析 TemporalService，也能注入自定义 service。
 */
export const useTemporalStore = defineEntityStore<bigint, Temporal>("temporal");
