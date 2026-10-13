/**
 * Sqlite 数据访问层：chronology
 * 数据源：src/sqlite/chronology.sqlite（每个实体一个 SQLite 文件；本层只访问该文件里的表）
 * 实体：src/entity/chronology.ts（Chronology）
 * 表：chronology
 * 语句镜像：src/sql/chronology.sql —— SQL 文本逐字复制，语句名一一对应。
 * 建表语句：database/sql/chronology/table.sql；数据初始化：database/sql/chronology/data.sql。
 *
 * 本层只提供「语句文本 + 驱动」，不做实体映射（见 src/repository/chronology.repository.ts）。
 * 由 scripts/generate_datasource.py 生成，请勿手改。
 */
import type { Sqlite, StatementRunner } from "./sqlite";
import { AbstractSqlite, runnerOf } from "./sqlite";

/** 语句 count：全表行数。 */
export const count: string = `SELECT COUNT(*) AS count FROM "chronology";`;

/** 语句 countBy：按 Example 条件统计行数。 */
export const countBy: string = `SELECT COUNT(*) AS count
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1);`;

/** 语句 existsByIdentity：主键是否存在。 */
export const existsByIdentity: string = `SELECT EXISTS(SELECT 1 FROM "chronology" WHERE "identity" = :identity) AS exists_;`;

/** 语句 existsBy：按 Example 条件判断是否存在。 */
export const existsBy: string = `SELECT EXISTS(
    SELECT 1
    FROM "chronology"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:epoch IS NULL OR "epoch" = :epoch)
        AND (:astronomy IS NULL OR "astronomy" = :astronomy)
        AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
        AND (:climate IS NULL OR "climate" = :climate)
        AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
        AND (:gregory IS NULL OR "gregory" = :gregory)
        AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
        AND (:jupiter IS NULL OR "jupiter" = :jupiter)
        AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
        AND (:natural IS NULL OR "natural" = :natural)
        AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
        AND (:tree IS NULL OR "tree" = :tree)
        AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
        AND (:tropical IS NULL OR "tropical" = :tropical)
        AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
        AND (:synodic IS NULL OR "synodic" = :synodic)
        AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
        AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
        AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
        AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
        AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
        AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
        AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
        AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
        AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
        AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
        AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
        AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
        AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
        AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
        AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
        AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
        AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND (1 = 1)
) AS exists_;`;

/** 语句 findAll：按 Example 分页查询（:sortColumn 白名单排序 + LIMIT/OFFSET）。 */
export const findAll: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findAllByIdentities：按主键集合查询（json_each）。 */
export const findAllByIdentities: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;`;

/** 语句 findByIdentity：按主键查询。 */
export const findByIdentity: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE "identity" = :identity;`;

/** 语句 findBy：按 Example 分页查询。 */
export const findBy: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/** 语句 findFirstBy：按 Example 取首行。 */
export const findFirstBy: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;`;

/** 语句 findOne：按 Example 取唯一行（LIMIT 2 用于探测多行）。 */
export const findOne: string = `SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;`;

/** 语句 selectByIdentity：按主键投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectByIdentity: string = `SELECT :projection
FROM "chronology"
WHERE "identity" = :identity;`;

/** 语句 selectBy：按 Example 投影（:projection 由 repository 白名单校验后拼接）。 */
export const selectBy: string = `SELECT :projection
FROM "chronology"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:epoch IS NULL OR "epoch" = :epoch)
    AND (:astronomy IS NULL OR "astronomy" = :astronomy)
    AND (:lengthOfAstronomyMonth IS NULL OR "lengthOfAstronomyMonth" = :lengthOfAstronomyMonth)
    AND (:climate IS NULL OR "climate" = :climate)
    AND (:lengthOfClimateMonth IS NULL OR "lengthOfClimateMonth" = :lengthOfClimateMonth)
    AND (:gregory IS NULL OR "gregory" = :gregory)
    AND (:lengthOfGregoryMonth IS NULL OR "lengthOfGregoryMonth" = :lengthOfGregoryMonth)
    AND (:jupiter IS NULL OR "jupiter" = :jupiter)
    AND (:lengthOfJupiterMonth IS NULL OR "lengthOfJupiterMonth" = :lengthOfJupiterMonth)
    AND (:natural IS NULL OR "natural" = :natural)
    AND (:lengthOfNaturalMonth IS NULL OR "lengthOfNaturalMonth" = :lengthOfNaturalMonth)
    AND (:tree IS NULL OR "tree" = :tree)
    AND (:lengthOfTreeMonth IS NULL OR "lengthOfTreeMonth" = :lengthOfTreeMonth)
    AND (:tropical IS NULL OR "tropical" = :tropical)
    AND (:lengthOfTropicalMonth IS NULL OR "lengthOfTropicalMonth" = :lengthOfTropicalMonth)
    AND (:synodic IS NULL OR "synodic" = :synodic)
    AND (:lengthOfSynodicMonth IS NULL OR "lengthOfSynodicMonth" = :lengthOfSynodicMonth)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd))
    AND (:astronomyStart IS NULL OR :astronomyEnd IS NULL OR ("astronomy" >= :astronomyStart AND "astronomy" < :astronomyEnd))
    AND (:lengthOfAstronomyMonthStart IS NULL OR :lengthOfAstronomyMonthEnd IS NULL OR ("lengthOfAstronomyMonth" >= :lengthOfAstronomyMonthStart AND "lengthOfAstronomyMonth" < :lengthOfAstronomyMonthEnd))
    AND (:climateStart IS NULL OR :climateEnd IS NULL OR ("climate" >= :climateStart AND "climate" < :climateEnd))
    AND (:lengthOfClimateMonthStart IS NULL OR :lengthOfClimateMonthEnd IS NULL OR ("lengthOfClimateMonth" >= :lengthOfClimateMonthStart AND "lengthOfClimateMonth" < :lengthOfClimateMonthEnd))
    AND (:gregoryStart IS NULL OR :gregoryEnd IS NULL OR ("gregory" >= :gregoryStart AND "gregory" < :gregoryEnd))
    AND (:lengthOfGregoryMonthStart IS NULL OR :lengthOfGregoryMonthEnd IS NULL OR ("lengthOfGregoryMonth" >= :lengthOfGregoryMonthStart AND "lengthOfGregoryMonth" < :lengthOfGregoryMonthEnd))
    AND (:jupiterStart IS NULL OR :jupiterEnd IS NULL OR ("jupiter" >= :jupiterStart AND "jupiter" < :jupiterEnd))
    AND (:lengthOfJupiterMonthStart IS NULL OR :lengthOfJupiterMonthEnd IS NULL OR ("lengthOfJupiterMonth" >= :lengthOfJupiterMonthStart AND "lengthOfJupiterMonth" < :lengthOfJupiterMonthEnd))
    AND (:naturalStart IS NULL OR :naturalEnd IS NULL OR ("natural" >= :naturalStart AND "natural" < :naturalEnd))
    AND (:lengthOfNaturalMonthStart IS NULL OR :lengthOfNaturalMonthEnd IS NULL OR ("lengthOfNaturalMonth" >= :lengthOfNaturalMonthStart AND "lengthOfNaturalMonth" < :lengthOfNaturalMonthEnd))
    AND (:treeStart IS NULL OR :treeEnd IS NULL OR ("tree" >= :treeStart AND "tree" < :treeEnd))
    AND (:lengthOfTreeMonthStart IS NULL OR :lengthOfTreeMonthEnd IS NULL OR ("lengthOfTreeMonth" >= :lengthOfTreeMonthStart AND "lengthOfTreeMonth" < :lengthOfTreeMonthEnd))
    AND (:tropicalStart IS NULL OR :tropicalEnd IS NULL OR ("tropical" >= :tropicalStart AND "tropical" < :tropicalEnd))
    AND (:lengthOfTropicalMonthStart IS NULL OR :lengthOfTropicalMonthEnd IS NULL OR ("lengthOfTropicalMonth" >= :lengthOfTropicalMonthStart AND "lengthOfTropicalMonth" < :lengthOfTropicalMonthEnd))
    AND (:synodicStart IS NULL OR :synodicEnd IS NULL OR ("synodic" >= :synodicStart AND "synodic" < :synodicEnd))
    AND (:lengthOfSynodicMonthStart IS NULL OR :lengthOfSynodicMonthEnd IS NULL OR ("lengthOfSynodicMonth" >= :lengthOfSynodicMonthStart AND "lengthOfSynodicMonth" < :lengthOfSynodicMonthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        WHEN :sortColumn = 'astronomy' THEN "astronomy"
        WHEN :sortColumn = 'lengthOfAstronomyMonth' THEN "lengthOfAstronomyMonth"
        WHEN :sortColumn = 'climate' THEN "climate"
        WHEN :sortColumn = 'lengthOfClimateMonth' THEN "lengthOfClimateMonth"
        WHEN :sortColumn = 'gregory' THEN "gregory"
        WHEN :sortColumn = 'lengthOfGregoryMonth' THEN "lengthOfGregoryMonth"
        WHEN :sortColumn = 'jupiter' THEN "jupiter"
        WHEN :sortColumn = 'lengthOfJupiterMonth' THEN "lengthOfJupiterMonth"
        WHEN :sortColumn = 'natural' THEN "natural"
        WHEN :sortColumn = 'lengthOfNaturalMonth' THEN "lengthOfNaturalMonth"
        WHEN :sortColumn = 'tree' THEN "tree"
        WHEN :sortColumn = 'lengthOfTreeMonth' THEN "lengthOfTreeMonth"
        WHEN :sortColumn = 'tropical' THEN "tropical"
        WHEN :sortColumn = 'lengthOfTropicalMonth' THEN "lengthOfTropicalMonth"
        WHEN :sortColumn = 'synodic' THEN "synodic"
        WHEN :sortColumn = 'lengthOfSynodicMonth' THEN "lengthOfSynodicMonth"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;`;

/**
 * chronology 的数据访问对象。
 * 数据源：src/sqlite/chronology.sqlite（表 chronology）。
 */
export class ChronologySqlite extends AbstractSqlite implements Sqlite {

    /**
     * 构造。
     * @param runner 驱动接缝；缺省用 runnerOf("chronology")，由 injectRunner 注入后即可工作。
     */
    public constructor(runner: StatementRunner = runnerOf("chronology")) {
        super("chronology", ["chronology"], runner);
    }
}
