export function getUtcDayBounds(asOf: Date) {
  const dayStart = new Date(
    Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  );
  const dayEnd = new Date(dayStart);

  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

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
    normalized_front_parts AS (
      SELECT
        c.id AS card_id,
        c.front AS remaining_front,
        '' AS normalized_front
      FROM card c
      WHERE c.status != 'archived'
        AND c.card_type = 'concept'${mediaClause}
      UNION ALL
      SELECT
        card_id,
        CASE
          WHEN instr(remaining_front, '{{') = 0 THEN ''
          ELSE substr(remaining_front, instr(remaining_front, '}}') + 2)
        END AS remaining_front,
        normalized_front || CASE
          WHEN instr(remaining_front, '{{') = 0 THEN remaining_front
          ELSE substr(remaining_front, 1, instr(remaining_front, '{{') - 1)
            || substr(
              substr(remaining_front, instr(remaining_front, '{{') + 2),
              1,
              instr(substr(remaining_front, instr(remaining_front, '{{') + 2), '|') - 1
            )
        END AS normalized_front
      FROM normalized_front_parts
      WHERE remaining_front != ''
    ),
    normalized_front AS (
      SELECT
        card_id,
        ${normalizeReviewSubjectSurfaceSql("normalized_front")} AS normalized_front
      FROM normalized_front_parts
      WHERE remaining_front = ''
    ),
    driving_links AS (
      SELECT
        c.id AS card_id,
        c.media_id AS media_id,
        c.status AS card_status,
        c.lesson_id AS lesson_id,
        c.order_index AS order_index,
        c.created_at AS created_at,
        cel.entry_type AS entry_type,
        cel.entry_id AS entry_id
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
        MIN(dl.entry_id) AS entry_id
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
        EXISTS(
          SELECT 1
          FROM card_entry_link cel_primary
          WHERE cel_primary.card_id = c.id
            AND cel_primary.relationship_type = 'primary'
        ) AS has_primary,
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
            AND EXISTS(
              SELECT 1
              FROM card_entry_link cel_primary
              WHERE cel_primary.card_id = c.id
                AND cel_primary.relationship_type = 'primary'
            )
            AND nf.normalized_front IS NOT NULL
            AND NOT (
              CASE
                WHEN dlc.entry_type = 'term' THEN
                  nf.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
                  OR (
                    t.reading IS NOT NULL
                    AND nf.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                      "t.reading"
                    )}
                  )
                WHEN dlc.entry_type = 'grammar' THEN
                  nf.normalized_front = ${normalizeReviewSubjectSurfaceSql(
                    "gp.pattern"
                  )}
                  OR (
                    gp.reading IS NOT NULL
                    AND nf.normalized_front = ${normalizeReviewSubjectSurfaceSql(
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
      LEFT JOIN normalized_front nf
        ON nf.card_id = c.id
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
