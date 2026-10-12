-- src/sql/phase.sql
-- 实体：src/entity/phase.ts
-- 表：phase, phase_weeks, phase_parts
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


-- 表 phase

-- name: count
SELECT COUNT(*) AS count FROM "phase";

-- name: countBy
SELECT COUNT(*) AS count
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike));

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "phase" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "phase"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:name IS NULL OR "name" = :name)
        AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
        AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
        AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
        AND (:leap IS NULL OR "leap" = :leap)
        AND (:month IS NULL OR "month" = :month)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
        AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
        AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
        AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
        AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
        AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
) AS exists_;

-- name: findAll
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "absolute", "relative", "name", "lengthOfDay", "lengthOfWeek", "lengthOfPart", "leap", "month", "start", "end"
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:name IS NULL OR "name" = :name)
    AND (:lengthOfDay IS NULL OR "lengthOfDay" = :lengthOfDay)
    AND (:lengthOfWeek IS NULL OR "lengthOfWeek" = :lengthOfWeek)
    AND (:lengthOfPart IS NULL OR "lengthOfPart" = :lengthOfPart)
    AND (:leap IS NULL OR "leap" = :leap)
    AND (:month IS NULL OR "month" = :month)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:lengthOfDayStart IS NULL OR :lengthOfDayEnd IS NULL OR ("lengthOfDay" >= :lengthOfDayStart AND "lengthOfDay" < :lengthOfDayEnd))
    AND (:lengthOfWeekStart IS NULL OR :lengthOfWeekEnd IS NULL OR ("lengthOfWeek" >= :lengthOfWeekStart AND "lengthOfWeek" < :lengthOfWeekEnd))
    AND (:lengthOfPartStart IS NULL OR :lengthOfPartEnd IS NULL OR ("lengthOfPart" >= :lengthOfPartStart AND "lengthOfPart" < :lengthOfPartEnd))
    AND (:leapStart IS NULL OR :leapEnd IS NULL OR ("leap" >= :leapStart AND "leap" < :leapEnd))
    AND (:monthStart IS NULL OR :monthEnd IS NULL OR ("month" >= :monthStart AND "month" < :monthEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'lengthOfDay' THEN "lengthOfDay"
        WHEN :sortColumn = 'lengthOfWeek' THEN "lengthOfWeek"
        WHEN :sortColumn = 'lengthOfPart' THEN "lengthOfPart"
        WHEN :sortColumn = 'leap' THEN "leap"
        WHEN :sortColumn = 'month' THEN "month"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 phase_weeks

-- name: count
SELECT COUNT(*) AS count FROM "phase_weeks";

-- name: countBy
SELECT COUNT(*) AS count
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "phase_weeks" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "phase_weeks"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:phase IS NULL OR "phase" = :phase)
        AND (:week IS NULL OR "week" = :week))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
        AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "phase", "week"
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase_weeks"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase_weeks"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:week IS NULL OR "week" = :week))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:weekStart IS NULL OR :weekEnd IS NULL OR ("week" >= :weekStart AND "week" < :weekEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'week' THEN "week"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 phase_parts

-- name: count
SELECT COUNT(*) AS count FROM "phase_parts";

-- name: countBy
SELECT COUNT(*) AS count
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "phase_parts" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "phase_parts"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:phase IS NULL OR "phase" = :phase)
        AND (:part IS NULL OR "part" = :part))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
        AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "phase", "part"
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase_parts"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "phase_parts"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:phase IS NULL OR "phase" = :phase)
    AND (:part IS NULL OR "part" = :part))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:phaseStart IS NULL OR :phaseEnd IS NULL OR ("phase" >= :phaseStart AND "phase" < :phaseEnd))
    AND (:partStart IS NULL OR :partEnd IS NULL OR ("part" >= :partStart AND "part" < :partEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'phase' THEN "phase"
        WHEN :sortColumn = 'part' THEN "part"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;
