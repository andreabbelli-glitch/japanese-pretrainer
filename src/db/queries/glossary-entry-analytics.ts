import type { DatabaseClient } from "../client.ts";

import { quoteSqlString } from "./review-query-helpers.ts";

export type GlossaryShellCounts = {
  mediaId: string;
  entriesTotal: number;
  entriesCovered: number;
};

export async function getGlobalGlossaryAggregateStats(
  database: DatabaseClient
) {
  const result = await database.$client.execute(`
    select
      cast(
        (
          select count(distinct coalesce(cross_media_group_id, id))
          from term
        ) + (
          select count(distinct coalesce(cross_media_group_id, id))
          from grammar_pattern
        ) as integer
      ) as entry_count,
      cast(
        (
          select count(*)
          from (
            select cross_media_group_id
            from term
            where cross_media_group_id is not null
            group by cross_media_group_id
            having count(*) > 1
          ) grouped
        ) + (
          select count(*)
          from (
            select cross_media_group_id
            from grammar_pattern
            where cross_media_group_id is not null
            group by cross_media_group_id
            having count(*) > 1
          ) grouped
        ) as integer
      ) as cross_media_count,
      cast(
        (
          select count(distinct coalesce(term.cross_media_group_id, term.id))
          from term
          inner join card_entry_link
            on card_entry_link.entry_type = 'term'
            and card_entry_link.entry_id = term.id
          inner join card
            on card.id = card_entry_link.card_id
          where card.status != 'archived'
        ) + (
          select count(distinct coalesce(grammar_pattern.cross_media_group_id, grammar_pattern.id))
          from grammar_pattern
          inner join card_entry_link
            on card_entry_link.entry_type = 'grammar'
            and card_entry_link.entry_id = grammar_pattern.id
          inner join card
            on card.id = card_entry_link.card_id
          where card.status != 'archived'
        ) as integer
      ) as with_cards_count
  `);
  const row = result.rows[0];
  const readCount = (value: unknown) => Number(value ?? 0);

  return {
    crossMediaCount: readCount(row?.cross_media_count),
    entryCount: readCount(row?.entry_count),
    withCardsCount: readCount(row?.with_cards_count)
  };
}

export async function listGlossaryShellCounts(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<GlossaryShellCounts[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  const mediaIdList = mediaIds.map(quoteSqlString).join(", ");

  const rows = await database.all<{
    mediaId: string;
    entriesTotal: number | string | null;
    entriesCovered: number | string | null;
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id
      FROM term t
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id
      FROM grammar_pattern gp
      WHERE gp.media_id IN (${mediaIdList})
    ),
    entry_signals AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND (rss.state = 'known_manual' OR rss.manual_override = 1)
          ) THEN 1
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND rss.state = 'learning'
          ) THEN 1
          WHEN EXISTS (
            SELECT 1
            FROM review_subject_state rss
            WHERE rss.entry_type = ae.entry_type
              AND (
                (
                  ae.cross_media_group_id IS NOT NULL
                  AND rss.cross_media_group_id = ae.cross_media_group_id
                )
                OR (
                  ae.cross_media_group_id IS NULL
                  AND rss.entry_id = ae.entry_id
                )
              )
              AND rss.state IN ('review', 'relearning')
          ) THEN 1
          ELSE 0
        END AS is_covered
      FROM all_entries ae
    )
    SELECT
      media_id AS mediaId,
      COUNT(*) AS entriesTotal,
      SUM(is_covered) AS entriesCovered
    FROM entry_signals
    GROUP BY media_id
  `);

  return rows.map((row) => ({
    mediaId: row.mediaId,
    entriesTotal: Number(row.entriesTotal ?? 0),
    entriesCovered: Number(row.entriesCovered ?? 0)
  }));
}

export type GlossaryProgressSummary = {
  mediaId: string;
  entriesTotal: number;
  entriesCovered: number;
  known: number;
  learning: number;
  review: number;
  new: number;
  available: number;
};

export async function listGlossaryProgressSummaries(
  database: DatabaseClient,
  mediaIds: string[]
): Promise<GlossaryProgressSummary[]> {
  if (mediaIds.length === 0) {
    return [];
  }

  const mediaIdList = mediaIds.map(quoteSqlString).join(", ");

  const rows = await database.all<{
    mediaId: string;
    entriesTotal: number | string | null;
    entriesCovered: number | string | null;
    knownCount: number | string | null;
    learningCount: number | string | null;
    reviewCount: number | string | null;
    newCount: number | string | null;
    availableCount: number | string | null;
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id
      FROM term t
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id
      FROM grammar_pattern gp
      WHERE gp.media_id IN (${mediaIdList})
    ),
    grouped_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id = ae.cross_media_group_id
      WHERE ae.cross_media_group_id IS NOT NULL
    ),
    direct_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.cross_media_group_id,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id IS NULL
        AND rss.entry_id = ae.entry_id
      WHERE ae.cross_media_group_id IS NULL
    ),
    entry_state_matches AS (
      SELECT * FROM grouped_entry_state_matches
      UNION ALL
      SELECT * FROM direct_entry_state_matches
    ),
    entry_signals AS (
      SELECT
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.cross_media_group_id,
        MAX(
          CASE
            WHEN esm.state = 'known_manual' OR esm.manual_override = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN esm.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN esm.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN esm.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM entry_state_matches esm
      GROUP BY
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.cross_media_group_id
    ),
    entry_states AS (
      SELECT
        media_id,
        CASE
          WHEN is_known = 1 THEN 'known'
          WHEN is_learning = 1 THEN 'learning'
          WHEN is_review = 1 THEN 'review'
          WHEN is_new = 1 THEN 'new'
          ELSE 'available'
        END AS state
      FROM entry_signals
    )
    SELECT
      media_id AS mediaId,
      COUNT(*) AS entriesTotal,
      SUM(CASE WHEN state IN ('known', 'learning', 'review') THEN 1 ELSE 0 END) AS entriesCovered,
      SUM(CASE WHEN state = 'known' THEN 1 ELSE 0 END) AS knownCount,
      SUM(CASE WHEN state = 'learning' THEN 1 ELSE 0 END) AS learningCount,
      SUM(CASE WHEN state = 'review' THEN 1 ELSE 0 END) AS reviewCount,
      SUM(CASE WHEN state = 'new' THEN 1 ELSE 0 END) AS newCount,
      SUM(CASE WHEN state = 'available' THEN 1 ELSE 0 END) AS availableCount
    FROM entry_states
    GROUP BY media_id
  `);

  return rows.map((row) => ({
    mediaId: row.mediaId,
    entriesTotal: Number(row.entriesTotal ?? 0),
    entriesCovered: Number(row.entriesCovered ?? 0),
    known: Number(row.knownCount ?? 0),
    learning: Number(row.learningCount ?? 0),
    review: Number(row.reviewCount ?? 0),
    new: Number(row.newCount ?? 0),
    available: Number(row.availableCount ?? 0)
  }));
}

export type GlossaryPreviewEntryState = {
  mediaId: string;
  mediaSlug: string;
  sourceId: string;
  kind: "term" | "grammar";
  label: string;
  meaningIt: string;
  reading: string | null;
  segmentTitle: string | null;
  state: "known" | "learning" | "review" | "new" | "available";
};

export async function listGlossaryPreviewEntries(
  database: DatabaseClient,
  media: Array<{
    id: string;
    slug: string;
  }>,
  limitPerMedia = 6
): Promise<GlossaryPreviewEntryState[]> {
  if (media.length === 0) {
    return [];
  }

  const mediaIdList = media.map((item) => quoteSqlString(item.id)).join(", ");
  const mediaSlugById = new Map(
    media.map((item) => [item.id, item.slug] as const)
  );

  const rows = await database.all<{
    mediaId: string;
    sourceId: string;
    entryType: "term" | "grammar";
    label: string;
    meaningIt: string;
    reading: string | null;
    segmentTitle: string | null;
    state: "known" | "learning" | "review" | "new" | "available";
  }>(`
    WITH all_entries AS (
      SELECT
        t.id AS entry_id,
        'term' AS entry_type,
        t.media_id AS media_id,
        t.cross_media_group_id AS cross_media_group_id,
        t.source_id AS source_id,
        t.lemma AS label,
        t.meaning_it AS meaning_it,
        t.reading AS reading,
        s.title AS segment_title
      FROM term t
      LEFT JOIN segment s ON s.id = t.segment_id
      WHERE t.media_id IN (${mediaIdList})
      UNION ALL
      SELECT
        gp.id AS entry_id,
        'grammar' AS entry_type,
        gp.media_id AS media_id,
        gp.cross_media_group_id AS cross_media_group_id,
        gp.source_id AS source_id,
        gp.pattern AS label,
        gp.meaning_it AS meaning_it,
        NULL AS reading,
        s.title AS segment_title
      FROM grammar_pattern gp
      LEFT JOIN segment s ON s.id = gp.segment_id
      WHERE gp.media_id IN (${mediaIdList})
    ),
    grouped_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.source_id,
        ae.label,
        ae.meaning_it,
        ae.reading,
        ae.segment_title,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id = ae.cross_media_group_id
      WHERE ae.cross_media_group_id IS NOT NULL
    ),
    direct_entry_state_matches AS (
      SELECT
        ae.entry_id,
        ae.entry_type,
        ae.media_id,
        ae.source_id,
        ae.label,
        ae.meaning_it,
        ae.reading,
        ae.segment_title,
        COALESCE(rss.manual_override, 0) AS manual_override,
        rss.state AS state
      FROM all_entries ae
      LEFT JOIN review_subject_state rss
        ON rss.entry_type = ae.entry_type
        AND rss.cross_media_group_id IS NULL
        AND rss.entry_id = ae.entry_id
      WHERE ae.cross_media_group_id IS NULL
    ),
    entry_state_matches AS (
      SELECT * FROM grouped_entry_state_matches
      UNION ALL
      SELECT * FROM direct_entry_state_matches
    ),
    entry_signals AS (
      SELECT
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.source_id,
        esm.label,
        esm.meaning_it,
        esm.reading,
        esm.segment_title,
        MAX(
          CASE
            WHEN esm.state = 'known_manual' OR esm.manual_override = 1 THEN 1
            ELSE 0
          END
        ) AS is_known,
        MAX(
          CASE
            WHEN esm.state = 'learning' THEN 1
            ELSE 0
          END
        ) AS is_learning,
        MAX(
          CASE
            WHEN esm.state IN ('review', 'relearning') THEN 1
            ELSE 0
          END
        ) AS is_review,
        MAX(
          CASE
            WHEN esm.state = 'new' THEN 1
            ELSE 0
          END
        ) AS is_new
      FROM entry_state_matches esm
      GROUP BY
        esm.entry_id,
        esm.entry_type,
        esm.media_id,
        esm.source_id,
        esm.label,
        esm.meaning_it,
        esm.reading,
        esm.segment_title
    ),
    entry_states AS (
      SELECT
        media_id,
        entry_type,
        source_id,
        label,
        meaning_it,
        reading,
        segment_title,
        CASE
          WHEN is_known = 1 THEN 'known'
          WHEN is_learning = 1 THEN 'learning'
          WHEN is_review = 1 THEN 'review'
          WHEN is_new = 1 THEN 'new'
          ELSE 'available'
        END AS state,
        ROW_NUMBER() OVER(
          PARTITION BY media_id
          ORDER BY entry_type DESC, label ASC
        ) as rn
      FROM entry_signals
    )
    SELECT
      es.media_id AS mediaId,
      es.source_id AS sourceId,
      es.entry_type AS entryType,
      es.label AS label,
      es.meaning_it AS meaningIt,
      es.reading AS reading,
      es.segment_title AS segmentTitle,
      es.state AS state
    FROM entry_states es
    WHERE es.rn <= ${limitPerMedia}
    ORDER BY es.media_id ASC, es.rn ASC
  `);

  return rows.map((row) => {
    const mediaSlug = mediaSlugById.get(row.mediaId);

    if (!mediaSlug) {
      throw new Error(
        `Missing media slug for glossary preview media ${row.mediaId}.`
      );
    }

    return {
      mediaId: row.mediaId,
      mediaSlug,
      sourceId: row.sourceId,
      kind: row.entryType,
      label: row.label,
      meaningIt: row.meaningIt,
      reading: row.reading,
      segmentTitle: row.segmentTitle,
      state: row.state
    };
  });
}
