import type { SynodicMonth } from "../entity/synodic";
import { defineEntityStore } from "./store";

/**
 * 朔望月 store（模块 synodic，表 synodic_month；年表 synodic_calendar_year 由 SynodicService 代理）。
 * 状态：items / current / page（page.elements 为总行数）/ query / loading / error；
 * 动作：load(query?)、loadByIdentity(identity)、create/replace(item)、select(identity, fields)、count()、reset()。
 * 状态里不含 bigint（bigint 一律 String(...) 后入库），identityOf(item) 可还原为 bigint。
 * useSynodicStore() 省略入参时由默认服务工厂解析 SynodicService，也能注入自定义 service。
 */
export const useSynodicStore = defineEntityStore<bigint, SynodicMonth>("synodic");
