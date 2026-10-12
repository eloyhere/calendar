import type { Chronology } from "../entity/chronology";
import { defineEntityStore } from "./store";

/**
 * 纪年 store（模块 chronology，表 chronology；数据源缺失，表建而未填）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useChronologyStore() 省略入参时由默认服务工厂解析 ChronologyService，也能注入自定义 service。
 */
export const useChronologyStore = defineEntityStore<bigint, Chronology>("chronology");
