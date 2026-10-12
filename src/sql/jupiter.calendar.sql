-- src/sql/jupiter.calendar.sql
-- 实体：src/entity/jupiter.ts
-- 表：jupiter_year, jupiter_month, jupiter_year_months, jupiter_year_phenologies, jupiter_year_weeks, jupiter_year_parts, jupiter_month_phenologies, jupiter_month_weeks, jupiter_month_parts
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


-- 表 jupiter_year

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_year";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_year" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_year"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
        AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
        AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
        AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
        AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
        AND (:leap IS NULL OR "leap" = :leap)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
        AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
        AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
        AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
        AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
        AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "relative", "absolute", "lengthOfMonth", "lengthOfPhenology", "lengthOfWeek", "lengthOfPart", "lengthOfDay", "leap", "start", "end"
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:lengthOfMonth IS NULL OR "lengthOfMonth" = :lengthOfMonth)
    AND (:lengthOfPhenology IS NULL OR "lengthOfPhenology" = :lengthOfPhenology)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:lengthOfMonthStart IS NULL OR :lengthOfMonthEnd IS NULL OR ("lengthOfMonth" >= :lengthOfMonthStart AND "lengthOfMonth" < :lengthOfMonthEnd))
    AND (:lengthOfPhenologyStart IS NULL OR :lengthOfPhenologyEnd IS NULL OR ("lengthOfPhenology" >= :lengthOfPhenologyStart AND "lengthOfPhenology" < :lengthOfPhenologyEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'lengthOfMonth' THEN "lengthOfMonth"
        WHEN :sortColumn = 'lengthOfPhenology' THEN "lengthOfPhenology"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_month

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_month";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_month"
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
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike));

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_month" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_month"
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
) AS exists_;

-- name: findAll
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT 1;

-- name: findOne
SELECT "identity", "relative", "absolute", "year", "ordinal", "leap", "lengthOfDay", "name", "start", "end"
FROM "jupiter_month"
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
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month"
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
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- 表 jupiter_year_months

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_year_months";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_year_months" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_year_months"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:year IS NULL OR "year" = :year)
        AND (:month IS NULL OR "month" = :month))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "year", "month"
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_months"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_months"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:month IS NULL OR "month" = :month))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'month' THEN "month"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_year_phenologies

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_year_phenologies";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_year_phenologies" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_year_phenologies"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:year IS NULL OR "year" = :year)
        AND (:phenology IS NULL OR "phenology" = :phenology))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "year", "phenology"
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_phenologies"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_year_weeks

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_year_weeks";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_year_weeks" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_year_weeks"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:year IS NULL OR "year" = :year)
        AND (:week IS NULL OR "week" = :week))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "year", "week"
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_weeks"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_year_parts

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_year_parts";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_year_parts" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_year_parts"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:year IS NULL OR "year" = :year)
        AND (:part IS NULL OR "part" = :part))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
        AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "year", "part"
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_parts"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_year_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:year IS NULL OR "year" = :year)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:yearStart IS NULL OR :yearEnd IS NULL OR ("year" >= :yearStart AND "year" < :yearEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'year' THEN "year"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_month_phenologies

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_month_phenologies";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_month_phenologies" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_month_phenologies"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:month IS NULL OR "month" = :month)
        AND (:phenology IS NULL OR "phenology" = :phenology))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
        AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "month", "phenology"
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_phenologies"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_phenologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:phenology IS NULL OR "phenology" = :phenology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:phenologyStart IS NULL OR :phenologyEnd IS NULL OR ("phenology" >= :phenologyStart AND "phenology" < :phenologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'phenology' THEN "phenology"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_month_weeks

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_month_weeks";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_month_weeks" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_month_weeks"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:month IS NULL OR "month" = :month)
        AND (:week IS NULL OR "week" = :week))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
        AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "month", "week"
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_weeks"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 jupiter_month_parts

-- name: count
SELECT COUNT(*) AS count FROM "jupiter_month_parts";

-- name: countBy
SELECT COUNT(*) AS count
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "jupiter_month_parts" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "jupiter_month_parts"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:month IS NULL OR "month" = :month)
        AND (:part IS NULL OR "part" = :part))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
        AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "month", "part"
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_parts"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "jupiter_month_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:month IS NULL OR "month" = :month)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;
