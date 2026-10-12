/**
 * Sqlite 数据访问层：synodic.month
 * 数据源：src/sqlite/synodic.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/synodic.ts（SynodicMonth）
 * 表：synodic_month
 * 语句镜像：src/sql/synodic.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/synodic/table.sql；数据初始化：database/sql/synodic/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/synodic.repository.ts）。
 * 一表一个文件：表 synodic_calendar_year 见 src/datasource/synodic.calendar_year.sqlite.ts
 * 一表一个文件：表 synodic_calendar_year_months 见 src/datasource/synodic.calendar_year_months.sqlite.ts
 * 一表一个文件：表 synodic_calendar_year_phenologies 见 src/datasource/synodic.calendar_year_phenologies.sqlite.ts
 * 一表一个文件：表 synodic_calendar_year_weeks 见 src/datasource/synodic.calendar_year_weeks.sqlite.ts
 * 一表一个文件：表 synodic_calendar_year_parts 见 src/datasource/synodic.calendar_year_parts.sqlite.ts
 * 一表一个文件：表 synodic_month_phenologies 见 src/datasource/synodic.month_phenologies.sqlite.ts
 * 一表一个文件：表 synodic_month_weeks 见 src/datasource/synodic.month_weeks.sqlite.ts
 * 一表一个文件：表 synodic_month_parts 见 src/datasource/synodic.month_parts.sqlite.ts
 * （12 条语句在每张表下同名，同处一个文件即重名导出，故按表拆分。）
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "synodic_month";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike));`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "synodic_month" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "synodic_month"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:year IS NULL OR "year" = :year)
        AND (:ordinal IS NULL OR "ordinal" = :ordinal)
        AND (:leap IS NULL OR "leap" = :leap)
        AND (:size IS NULL OR "size" = :size)
        AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
        AND (:name IS NULL OR "name" = :name)
        AND (:label IS NULL OR "label" = :label)
        AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
        AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
        AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
        AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
        AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
        AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
        AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
        AND (:nameLike IS NULL OR "name" LIKE :nameLike)
        AND (:labelLike IS NULL OR "label" LIKE :labelLike))
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "size", "lengthOfDay", "name", "label", "month_end_day", "start", "end"
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike))
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "synodic_month"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "synodic_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:size IS NULL OR "size" = :size)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:label IS NULL OR "label" = :label)
    AND (:month_end_day IS NULL OR "month_end_day" = :month_end_day)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:sizeStart IS NULL OR :sizeEnd IS NULL OR ("size" >= :sizeStart AND "size" < :sizeEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:labelStart IS NULL OR :labelEnd IS NULL OR ("label" >= :labelStart AND "label" < :labelEnd))
    AND (:month_end_dayStart IS NULL OR :month_end_dayEnd IS NULL OR ("month_end_day" >= :month_end_dayStart AND "month_end_day" < :month_end_dayEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:sizeLike IS NULL OR "size" LIKE :sizeLike)
    AND (:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:labelLike IS NULL OR "label" LIKE :labelLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'month_end_day' THEN "month_end_day"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * synodic.month 的数据访问对象。
 * 数据源：src/sqlite/synodic.sqlite（表 synodic_month）。
 */
export class SynodicMonthSqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("synodic")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("synodic")) {
        super("synodic", ["synodic_month"], runner);
    }
}
