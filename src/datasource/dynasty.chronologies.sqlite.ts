/**
 * Sqlite 数据访问层：dynasty.chronologies
 * 数据源：src/sqlite/dynasty.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/dynasty.ts（DynastyChronologies）
 * 表：dynasty_chronologies
 * 语句镜像：src/sql/dynasty.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/dynasty/table.sql；数据初始化：database/sql/dynasty/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/dynasty.repository.ts）。
 * 一表一个文件：表 dynasty 见 src/datasource/dynasty.sqlite.ts
 * 一表一个文件：表 dynasty_eras 见 src/datasource/dynasty.eras.sqlite.ts
 * （12 条语句在每张表下同名，同处一个文件即重名导出，故按表拆分。）
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "dynasty_chronologies";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1);`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "dynasty_chronologies" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "dynasty_chronologies"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:dynasty IS NULL OR "dynasty" = :dynasty)
        AND (:chronology IS NULL OR "chronology" = :chronology))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
        AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
        AND (1 = 1)
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "dynasty_chronologies"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'chronology' THEN "chronology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * dynasty.chronologies 的数据访问对象。
 * 数据源：src/sqlite/dynasty.sqlite（表 dynasty_chronologies）。
 */
export class DynastyChronologiesSqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("dynasty")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("dynasty")) {
        super("dynasty", ["dynasty_chronologies"], runner);
    }
}
