-- src/sql/perform.sql
-- 实体：src/entity/perform.ts
-- 表：perform, perform_epoches
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


-- 表 perform

-- name: count
SELECT COUNT(*) AS count FROM "perform";

-- name: countBy
SELECT COUNT(*) AS count
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "perform" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "perform"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:relative IS NULL OR "relative" = :relative)
        AND (:absolute IS NULL OR "absolute" = :absolute)
        AND (:encounter IS NULL OR "encounter" = :encounter)
        AND (:start IS NULL OR "start" = :start)
        AND (:end IS NULL OR "end" = :end))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
        AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
        AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
        AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
        AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "relative", "absolute", "encounter", "start", "end"
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "perform"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "perform"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:relative IS NULL OR "relative" = :relative)
    AND (:absolute IS NULL OR "absolute" = :absolute)
    AND (:encounter IS NULL OR "encounter" = :encounter)
    AND (:start IS NULL OR "start" = :start)
    AND (:end IS NULL OR "end" = :end))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:relativeStart IS NULL OR :relativeEnd IS NULL OR ("relative" >= :relativeStart AND "relative" < :relativeEnd))
    AND (:absoluteStart IS NULL OR :absoluteEnd IS NULL OR ("absolute" >= :absoluteStart AND "absolute" < :absoluteEnd))
    AND (:encounterStart IS NULL OR :encounterEnd IS NULL OR ("encounter" >= :encounterStart AND "encounter" < :encounterEnd))
    AND (:startStart IS NULL OR :startEnd IS NULL OR ("start" >= :startStart AND "start" < :startEnd))
    AND (:endStart IS NULL OR :endEnd IS NULL OR ("end" >= :endStart AND "end" < :endEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'relative' THEN "relative"
        WHEN :sortColumn = 'absolute' THEN "absolute"
        WHEN :sortColumn = 'encounter' THEN "encounter"
        WHEN :sortColumn = 'start' THEN "start"
        WHEN :sortColumn = 'end' THEN "end"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- 表 perform_epoches

-- name: count
SELECT COUNT(*) AS count FROM "perform_epoches";

-- name: countBy
SELECT COUNT(*) AS count
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1);

-- name: existsByIdentity
SELECT EXISTS(SELECT 1 FROM "perform_epoches" WHERE "identity" = :identity) AS exists_;

-- name: existsBy
SELECT EXISTS(
    SELECT 1
    FROM "perform_epoches"
WHERE 1 = 1
        AND ((:identity IS NULL OR "identity" = :identity)
        AND (:perform IS NULL OR "perform" = :perform)
        AND (:epoch IS NULL OR "epoch" = :epoch))
        AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
        AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
        AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
        AND (1 = 1)
) AS exists_;

-- name: findAll
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findAllByIdentities
-- :identities 为 JSON 数组文本，例如 [1,2,3]；按 identity 升序返回。
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE "identity" IN (SELECT value FROM json_each(:identities))
ORDER BY "identity" ASC;

-- name: findByIdentity
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE "identity" = :identity;

-- name: findBy
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;

-- name: findFirstBy
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT 1;

-- name: findOne
SELECT "identity", "perform", "epoch"
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1)
ORDER BY "identity" ASC
LIMIT 2;

-- name: selectByIdentity
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "perform_epoches"
WHERE "identity" = :identity;

-- name: selectBy
-- :projection 由 repository 按 fields 白名单校验后拼接，禁止直接拼接用户输入
SELECT :projection
FROM "perform_epoches"
WHERE 1 = 1
    AND ((:identity IS NULL OR "identity" = :identity)
    AND (:perform IS NULL OR "perform" = :perform)
    AND (:epoch IS NULL OR "epoch" = :epoch))
    AND ((:identityStart IS NULL OR :identityEnd IS NULL OR ("identity" >= :identityStart AND "identity" < :identityEnd))
    AND (:performStart IS NULL OR :performEnd IS NULL OR ("perform" >= :performStart AND "perform" < :performEnd))
    AND (:epochStart IS NULL OR :epochEnd IS NULL OR ("epoch" >= :epochStart AND "epoch" < :epochEnd)))
    AND (1 = 1)
-- :sortColumn 取本表列名白名单；为空或未给时按 identity 升序。
-- :sortDirection 取 'ASC' 或 'DESC'；未给时规范化为 'ASC'。
ORDER BY
    (CASE WHEN :sortDirection = 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) DESC NULLS LAST,
    (CASE WHEN :sortDirection IS NULL OR :sortDirection <> 'DESC' THEN (CASE
        WHEN :sortColumn = 'perform' THEN "perform"
        WHEN :sortColumn = 'epoch' THEN "epoch"
        ELSE "identity" END) END) ASC NULLS LAST,
    "identity" ASC
LIMIT :limit OFFSET :offset;
