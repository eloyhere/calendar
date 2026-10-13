-- src/sql/chronology.sql
-- 实体：src/entity/chronology.ts
-- 表：chronology
--
-- 语句名与 src/repository/repository.ts 的方法名一一对应。
--
-- 参数约定（可选参数语义）：
--   等值  :<column>        未给条件时绑 NULL，条件自动失效
--   区间  :<column>Start / :<column>End    半开区间 [start, end)，任一为 NULL 即失效
--   模糊  :<column>Like     仅文本列，未给时绑 NULL
--   排序  :sortColumn       取本表列名的白名单枚举，SQL 用 CASE 分派，不拼接外部输入
--   投影  :projection       由 repository 按 fields 白名单校验后拼接
--   分页  :limit / :offset   （不能叫 :size —— 表和列里都有 size，会撞名）


-- 表 chronology

-- name: count
SELECT COUNT(*) AS count FROM "chronology";

-- name: countBy
SELECT COUNT(*) AS count
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
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "chronology" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
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
) AS exists_;

-- name: findAll
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
FROM "chronology"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT 1;

-- name: findOne
SELECT "identity", "relative", "absolute", "epoch", "astronomy", "lengthOfAstronomyMonth", "climate", "lengthOfClimateMonth", "gregory", "lengthOfGregoryMonth", "jupiter", "lengthOfJupiterMonth", "natural", "lengthOfNaturalMonth", "tree", "lengthOfTreeMonth", "tropical", "lengthOfTropicalMonth", "synodic", "lengthOfSynodicMonth", "start", "end"
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
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "chronology"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;
