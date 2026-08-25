import { REVIEW_MEMORY_KEY_VERSION } from "../../domain/review.ts";
import { getReviewStudyDayBounds } from "../../features/review/model/study-day.ts";

export function getLocalDayBounds(asOf: Date) {
  const { dayEndIso, dayStartIso } = getReviewStudyDayBounds(asOf);

  return {
    dayEndIso,
    dayStartIso
  };
}

export function quoteSqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildEffectiveReviewEventMemoryKeySql(input: {
  canonicalSubjectKeyExpression: string;
  cardIdExpression: string;
  eventSchemaVersionExpression: string;
  memoryKeyExpression: string;
  recallTaskExpression: string;
  subjectKeyExpression: string;
}) {
  const recallTask = `COALESCE(${input.recallTaskExpression}, 'other')`;
  const canonicalSubjectKey = `COALESCE(NULLIF(trim(${input.canonicalSubjectKeyExpression}), ''), ${input.subjectKeyExpression})`;

  return `CASE
    WHEN ${input.eventSchemaVersionExpression} >= 2
      AND NULLIF(trim(${input.memoryKeyExpression}), '') IS NOT NULL
      THEN trim(${input.memoryKeyExpression})
    ELSE ${quoteSqlString(REVIEW_MEMORY_KEY_VERSION)} || ':' || ${recallTask} || ':' ||
      CASE
        WHEN ${recallTask} IN ('recognition', 'concept')
          THEN ${canonicalSubjectKey}
        ELSE 'card:' || ${input.cardIdExpression}
      END
  END`;
}

export function buildCompletedReviewLessonsCteSql(mediaId?: string) {
  const mediaFilterSql = mediaId
    ? `\n        AND l.media_id = ${quoteSqlString(mediaId)}`
    : "";

  return `
    completed_lessons AS (
      SELECT l.id
      FROM lesson l
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE l.status = 'active'
        AND lp.status = 'completed'${mediaFilterSql}
    )
  `;
}

function normalizeReviewSubjectSurfaceSql(expression: string) {
  return `replace(replace(replace(replace(trim(${expression}), '～', '〜'), char(10), ' '), char(13), ' '), char(9), ' ')`;
}

export function buildReviewSubjectIdentityCteSql(options?: {
  mediaFilter?: string;
}) {
  const mediaClause = options?.mediaFilter
    ? `\n        AND c.media_id IN (${options.mediaFilter})`
    : "";

  return `
    subject_identity AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.card_type AS card_type,
        c.lesson_id AS lesson_id,
        c.order_index AS order_index,
        c.created_at AS created_at,
        rci.has_primary AS has_primary,
        rci.driving_link_count AS driving_link_count,
        rci.entry_type AS entry_type,
        rci.entry_id AS entry_id,
        rci.cross_media_group_id AS cross_media_group_id,
        rci.canonical_subject_key AS canonical_subject_key,
        rci.recall_task AS recall_task,
        rci.memory_key AS memory_key,
        rci.memory_key AS subject_key
      FROM card c
      INNER JOIN review_card_identity rci
        ON rci.card_id = c.id
      WHERE c.status != 'archived'${mediaClause}
    )
  `;
}

export function buildComputedReviewSubjectIdentityCteSql(options?: {
  includeArchived?: boolean;
  mediaFilter?: string;
}) {
  const statusClause = options?.includeArchived
    ? ""
    : "\n        AND c.status != 'archived'";
  const mediaClause = options?.mediaFilter
    ? `\n        AND c.media_id IN (${options.mediaFilter})`
    : "";

  return `
    driving_links AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.lesson_id AS lesson_id,
        c.order_index AS order_index,
        c.created_at AS created_at,
        cel.entry_type AS entry_type,
        cel.entry_id AS entry_id,
        cel.relationship_type AS relationship_type
      FROM card c
      INNER JOIN card_entry_link cel
        ON cel.card_id = c.id
      WHERE 1 = 1${statusClause}${mediaClause}
        AND (
          cel.relationship_type = 'primary'
          OR NOT EXISTS(
            SELECT 1
            FROM card_entry_link cel_primary
            WHERE cel_primary.card_id = c.id
              AND cel_primary.relationship_type = 'primary'
          )
        )
    ),
    driving_link_counts AS (
      SELECT
        dl.card_id AS card_id,
        COUNT(*) AS link_count,
        MIN(dl.entry_type) AS entry_type,
        MIN(dl.entry_id) AS entry_id,
        MAX(CASE WHEN dl.relationship_type = 'primary' THEN 1 ELSE 0 END) AS has_primary
      FROM driving_links dl
      GROUP BY dl.card_id
    ),
    canonical_subject_identity AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.card_type AS card_type,
        c.lesson_id AS lesson_id,
        c.order_index AS order_index,
        c.created_at AS created_at,
        COALESCE(dlc.has_primary, 0) AS has_primary,
        COALESCE(dlc.link_count, 0) AS driving_link_count,
        dlc.entry_type AS entry_type,
        dlc.entry_id AS entry_id,
        CASE
          WHEN dlc.entry_type = 'term' THEN t.cross_media_group_id
          WHEN dlc.entry_type = 'grammar' THEN gp.cross_media_group_id
          ELSE NULL
        END AS cross_media_group_id,
        CASE
          WHEN COALESCE(dlc.link_count, 0) != 1 THEN 'card:' || c.id
          WHEN c.card_type = 'concept'
            AND COALESCE(dlc.has_primary, 0) = 1
            AND c.normalized_front IS NOT NULL
            AND NOT (
              CASE
                WHEN dlc.entry_type = 'term' THEN
                  c.front = t.lemma
                  OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
                  OR (
                    t.reading IS NOT NULL
                    AND (
                      c.front = t.reading
                      OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                        "t.reading"
                      )}
                    )
                  )
                WHEN dlc.entry_type = 'grammar' THEN
                  c.front = gp.pattern
                  OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                    "gp.pattern"
                  )}
                  OR (
                    gp.reading IS NOT NULL
                    AND (
                      c.front = gp.reading
                      OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                        "gp.reading"
                      )}
                    )
                  )
                ELSE 0
              END
            )
            THEN 'card:' || c.id
          WHEN dlc.entry_type = 'term' AND t.cross_media_group_id IS NOT NULL
            THEN 'group:term:' || t.cross_media_group_id
          WHEN dlc.entry_type = 'grammar' AND gp.cross_media_group_id IS NOT NULL
            THEN 'group:grammar:' || gp.cross_media_group_id
          ELSE 'entry:' || COALESCE(dlc.entry_type, 'card') || ':' || COALESCE(dlc.entry_id, c.id)
        END AS canonical_subject_key
      FROM card c
      LEFT JOIN driving_link_counts dlc
        ON dlc.card_id = c.id
      LEFT JOIN term t
        ON dlc.entry_type = 'term'
       AND t.id = dlc.entry_id
      LEFT JOIN grammar_pattern gp
        ON dlc.entry_type = 'grammar'
       AND gp.id = dlc.entry_id
      WHERE 1 = 1${statusClause}${mediaClause}
    ),
    recall_task_identity AS (
      SELECT
        csi.*,
        CASE
          WHEN csi.card_type = 'recognition' THEN 'recognition'
          WHEN csi.card_type = 'concept' THEN 'concept'
          ELSE 'other'
        END AS recall_task
      FROM canonical_subject_identity csi
    ),
    memory_subject_identity AS (
      SELECT
        rti.*,
        'mnemonic:v1:' ||
          rti.recall_task || ':' ||
          CASE
            WHEN rti.recall_task IN ('recognition', 'concept')
              THEN rti.canonical_subject_key
            ELSE 'card:' || rti.card_id
          END AS memory_key
      FROM recall_task_identity rti
    ),
    subject_identity AS (
      SELECT
        msi.*,
        msi.memory_key AS subject_key
      FROM memory_subject_identity msi
    )
  `;
}
