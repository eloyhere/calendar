import type { RawDateTime } from "./datetime";

/**
 * 节日：一个时刻对应的一组节日名称。
 *
 * 原先引用了一个未定义的 `DateTime`，这里改为引用 `datetime.ts` 已定义的
 * `RawDateTime`，语义不变（都是"某一天某一刻的完整历法表示"）。
 */
export interface RawFestival {
    datetime: RawDateTime;
}
