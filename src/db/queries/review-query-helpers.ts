export function getLocalDayBounds(asOf: Date) {
  const dayStart = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate()
  );
  const dayEnd = new Date(dayStart);

  dayEnd.setDate(dayEnd.getDate() + 1);

  return {
    dayEndIso: dayEnd.toISOString(),
    dayStartIso: dayStart.toISOString()
  };
}

export function quoteSqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
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
      WHERE c.status != 'archived'${mediaClause}
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
    subject_identity AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.card_type AS card_type,
        c.lesson_id AS lesson_id,
        c.order_index AS order_index,
        c.created_at AS created_at,
        COALESCE(dlc.has_primary, 0) AS has_primary,
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
                  c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
                  OR (
                    t.reading IS NOT NULL
                    AND c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                      "t.reading"
                    )}
                  )
                WHEN dlc.entry_type = 'grammar' THEN
                  c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                    "gp.pattern"
                  )}
                  OR (
                    gp.reading IS NOT NULL
                    AND c.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                      "gp.reading"
                    )}
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
        END AS subject_key
      FROM card c
      LEFT JOIN driving_link_counts dlc
        ON dlc.card_id = c.id
      LEFT JOIN term t
        ON dlc.entry_type = 'term'
       AND t.id = dlc.entry_id
      LEFT JOIN grammar_pattern gp
        ON dlc.entry_type = 'grammar'
       AND gp.id = dlc.entry_id
      WHERE c.status != 'archived'${mediaClause}
    )
  `;
}
