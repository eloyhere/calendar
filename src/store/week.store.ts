import type { Week } from "../entity/week";
import { defineEntityStore } from "./store";

/**
 * 星期 store（模块 week，表 week）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useWeekStore() 省略入参时由默认服务工厂解析 WeekService，也能注入自定义 service。
 */
export const useWeekStore = defineEntityStore<bigint, Week>("week");
