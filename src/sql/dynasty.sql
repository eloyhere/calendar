-- src/sql/dynasty.sql
-- 实体：src/entity/dynasty.ts
-- 表：dynasty, dynasty_eras, dynasty_chronologies
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


-- 表 dynasty

-- name: count
SELECT COUNT(*) AS count FROM "dynasty";

-- name: countBy
SELECT COUNT(*) AS count
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike));

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "dynasty" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "dynasty"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:name IS NULL OR "name" = :name)
        AND (:kind IS NULL OR "kind" = :kind)
        AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
        AND (:end_year IS NULL OR "end_year" = :end_year)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
        AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
        AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
        AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
        AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
) AS exists_;

-- name: findAll
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "relative", "absolute", "name", "kind", "gregorian_year", "end_year", "start", "end"
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:name IS NULL OR "name" = :name)
    AND (:kind IS NULL OR "kind" = :kind)
    AND (:gregorian_year IS NULL OR "gregorian_year" = :gregorian_year)
    AND (:end_year IS NULL OR "end_year" = :end_year)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:nameStart IS NULL OR :nameEnd IS NULL OR ("name" >= :nameStart AND "name" < :nameEnd))
    AND (:kindStart IS NULL OR :kindEnd IS NULL OR ("kind" >= :kindStart AND "kind" < :kindEnd))
    AND (:gregorian_yearStart IS NULL OR :gregorian_yearEnd IS NULL OR ("gregorian_year" >= :gregorian_yearStart AND "gregorian_year" < :gregorian_yearEnd))
    AND (:end_yearStart IS NULL OR :end_yearEnd IS NULL OR ("end_year" >= :end_yearStart AND "end_year" < :end_yearEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND ((:nameLike IS NULL OR "name" LIKE :nameLike)
    AND (:kindLike IS NULL OR "kind" LIKE :kindLike))
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'gregorian_year' THEN "gregorian_year"
        WHEN :sortColumn = 'end_year' THEN "end_year"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 dynasty_eras

-- name: count
SELECT COUNT(*) AS count FROM "dynasty_eras";

-- name: countBy
SELECT COUNT(*) AS count
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "dynasty_eras" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "dynasty_eras"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:dynasty IS NULL OR "dynasty" = :dynasty)
        AND (:era IS NULL OR "era" = :era))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
        AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "dynasty", "era"
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty_eras"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty_eras"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:era IS NULL OR "era" = :era))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:eraStart IS NULL OR :eraEnd IS NULL OR ("era" >= :eraStart AND "era" < :eraEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'dynasty' THEN "dynasty"
        WHEN :sortColumn = 'era' THEN "era"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 dynasty_chronologies

-- name: count
SELECT COUNT(*) AS count FROM "dynasty_chronologies";

-- name: countBy
SELECT COUNT(*) AS count
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "dynasty_chronologies" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
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
) AS exists_;

-- name: findAll
SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "dynasty", "chronology"
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT 1;

-- name: findOne
SELECT "identity", "dynasty", "chronology"
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
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty_chronologies"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "dynasty_chronologies"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:dynasty IS NULL OR "dynasty" = :dynasty)
    AND (:chronology IS NULL OR "chronology" = :chronology))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:dynastyStart IS NULL OR :dynastyEnd IS NULL OR ("dynasty" >= :dynastyStart AND "dynasty" < :dynastyEnd))
    AND (:chronologyStart IS NULL OR :chronologyEnd IS NULL OR ("chronology" >= :chronologyStart AND "chronology" < :chronologyEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
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
LIMIT :limit OFFSET :offset;
