import type { Proleptic } from "../temporal/temporal";

/**
 * 兼容出口：`Proleptic` 的正式定义在 `src/temporal/temporal.ts`。
 *
 * 早期版本把它放在本文件，`src/entity/week.ts` 仍按 `./proleptic` 引用；
 * 这里只做转发，避免出现两份定义。新代码请直接从 `../temporal/temporal` 引入。
 */
export type { Proleptic };
