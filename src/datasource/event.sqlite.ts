/**
 * Sqlite 数据访问层：event
 * 数据源：src/sqlite/event.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/event.ts（Event）
 * 表：event
 * 语句镜像：src/sql/event.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/event/table.sql；数据初始化：database/sql/event/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/event.repository.ts）。
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "event";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike));`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "event" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "event"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:name IS NULL OR "name" = :name)
        AND (:kind IS NULL OR "kind" = :kind)
        AND (:subject IS NULL OR "subject" = :subject)
        AND (:colony IS NULL OR "colony" = :colony)
        AND (:cause IS NULL OR "cause" = :cause)
        AND (:incident IS NULL OR "incident" = :incident)
        AND (:result IS NULL OR "result" = :result)
        AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
        AND (:dynasty IS NULL OR "dynasty" = :dynasty)
        AND (:era IS NULL OR "era" = :era)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
        AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
        AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
        AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
        AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
        AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
        AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
        AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
        AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
        AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
        AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
        AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
        AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
        AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
        AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
        AND (:resultLike IS NULL OR "result" LIKE :resultLike))
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "relative", "absolute", "name", "kind", "subject", "colony", "cause", "incident", "result", "gregorian_year", "dynasty", "era", "start", "end"
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike))
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "event"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "event"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:subject IS NULL OR "subject" = :subject)
    AND (:colony IS NULL OR "colony" = :colony)
    AND (:cause IS NULL OR "cause" = :cause)
    AND (:incident IS NULL OR "incident" = :incident)
    AND (:result IS NULL OR "result" = :result)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:subjectStart IS NULL OR :subjectEnd IS NULL OR ("subject" >= :subjectStart AND "subject" < :subjectEnd))
    AND (:colonyStart IS NULL OR :colonyEnd IS NULL OR ("colony" >= :colonyStart AND "colony" < :colonyEnd))
    AND (:causeStart IS NULL OR :causeEnd IS NULL OR ("cause" >= :causeStart AND "cause" < :causeEnd))
    AND (:incidentStart IS NULL OR :incidentEnd IS NULL OR ("incident" >= :incidentStart AND "incident" < :incidentEnd))
    AND (:resultStart IS NULL OR :resultEnd IS NULL OR ("result" >= :resultStart AND "result" < :resultEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike)
    AND (:subjectLike IS NULL OR "subject" LIKE :subjectLike)
    AND (:colonyLike IS NULL OR "colony" LIKE :colonyLike)
    AND (:causeLike IS NULL OR "cause" LIKE :causeLike)
    AND (:incidentLike IS NULL OR "incident" LIKE :incidentLike)
    AND (:resultLike IS NULL OR "result" LIKE :resultLike))
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * event 的数据访问对象。
 * 数据源：src/sqlite/event.sqlite（表 event）。
 */
export class EventSqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("event")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("event")) {
        super("event", ["event"], runner);
    }
}
