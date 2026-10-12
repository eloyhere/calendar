/**
 * Sqlite 数据访问层：primary.performs
 * 数据源：src/sqlite/primary.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/primary.ts（PrimaryPerforms）
 * 表：primary_performs
 * 语句镜像：src/sql/primary.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/primary/table.sql；数据初始化：database/sql/primary/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/primary.repository.ts）。
 * 一表一个文件：表 primary 见 src/datasource/primary.sqlite.ts
 * （12 条语句在每张表下同名，同处一个文件即重名导出，故按表拆分。）
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "primary_performs";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1);`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "primary_performs" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "primary_performs"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:primary IS NULL OR "primary" = :primary)
        AND (:perform IS NULL OR "perform" = :perform))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
        AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
        AND (1 = 1)
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "primary", "perform"
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "primary_performs"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "primary_performs"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:primary IS NULL OR "primary" = :primary)
    AND (:perform IS NULL OR "perform" = :perform))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:primaryStart IS NULL OR :primaryEnd IS NULL OR ("primary" >= :primaryStart AND "primary" < :primaryEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'primary' THEN "primary"
        WHEN :sortColumn = 'perform' THEN "perform"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * primary.performs 的数据访问对象。
 * 数据源：src/sqlite/primary.sqlite（表 primary_performs）。
 */
export class PrimaryPerformsSqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("primary")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("primary")) {
        super("primary", ["primary_performs"], runner);
    }
}
