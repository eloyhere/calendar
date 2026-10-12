/**
 * Sqlite 数据访问层：tropical.month
 * 数据源：src/sqlite/tropical.calendar.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/tropical.calendar.ts（TropicalMonth）
 * 表：tropical_month
 * 语句镜像：src/sql/tropical.calendar.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/tropical.calendar/table.sql；数据初始化：database/sql/tropical.calendar/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/tropical.calendar.repository.ts）。
 * 一表一个文件：表 tropical_year 见 src/datasource/tropical.year.sqlite.ts
 * 一表一个文件：表 tropical_year_months 见 src/datasource/tropical.year_months.sqlite.ts
 * 一表一个文件：表 tropical_year_phenologies 见 src/datasource/tropical.year_phenologies.sqlite.ts
 * 一表一个文件：表 tropical_year_weeks 见 src/datasource/tropical.year_weeks.sqlite.ts
 * 一表一个文件：表 tropical_year_parts 见 src/datasource/tropical.year_parts.sqlite.ts
 * 一表一个文件：表 tropical_month_phenologies 见 src/datasource/tropical.month_phenologies.sqlite.ts
 * 一表一个文件：表 tropical_month_weeks 见 src/datasource/tropical.month_weeks.sqlite.ts
 * 一表一个文件：表 tropical_month_parts 见 src/datasource/tropical.month_parts.sqlite.ts
 * （12 条语句在每张表下同名，同处一个文件即重名导出，故按表拆分。）
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "tropical_month";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike));`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "tropical_month" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "tropical_month"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:year IS NULL OR "year" = :year)
        AND (:ordinal IS NULL OR "ordinal" = :ordinal)
        AND (:leap IS NULL OR "leap" = :leap)
        AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
        AND (:name IS NULL OR "name" = :name)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
        AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
        AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
        AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
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
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
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
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
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
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "tropical_month"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "tropical_month"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:year IS NULL OR "year" = :year)
    AND (:ordinal IS NULL OR "ordinal" = :ordinal)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:name IS NULL OR "name" = :name)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:ordinalStart IS NULL OR :ordinalEnd IS NULL OR ("ordinal" >= :ordinalStart AND "ordinal" < :ordinalEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'ordinal' THEN "ordinal"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
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
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * tropical.month 的数据访问对象。
 * 数据源：src/sqlite/tropical.calendar.sqlite（表 tropical_month）。
 */
export class TropicalMonthSqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("tropical.calendar")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("tropical.calendar")) {
        super("tropical.calendar", ["tropical_month"], runner);
    }
}
