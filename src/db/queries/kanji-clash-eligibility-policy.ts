import { quoteSqlString } from "./review-query-helpers.ts";

function normalizeReviewSubjectSurfaceSql(expression: string) {
  return `replace(replace(replace(replace(trim(${expression}), '～', '〜'), char(10), ' '), char(13), ' '), char(9), ' ')`;
}

function buildEligibleReviewSubjectsCteSql() {
  return `
    ranked_eligible_review_subjects AS (
      SELECT
        COALESCE(rss.canonical_subject_key, rss.subject_key) AS subjectKey,
        rss.subject_type AS subjectType,
        rss.entry_id AS canonicalEntryId,
        rss.cross_media_group_id AS crossMediaGroupId,
        rss.state AS reviewState,
        rss.stability AS stability,
        rss.reps AS reps,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(rss.canonical_subject_key, rss.subject_key)
          ORDER BY
            CASE COALESCE(rss.recall_task, 'recognition')
              WHEN 'recognition' THEN 0
              WHEN 'concept' THEN 1
              ELSE 2
            END,
            rss.reps DESC,
            rss.stability DESC,
            rss.subject_key ASC
        ) AS taskRank
      FROM review_subject_state rss
      WHERE rss.entry_type = 'term'
        AND COALESCE(rss.recall_task, 'recognition') IN ('recognition', 'concept')
        AND rss.subject_type IN ('entry', 'group')
        AND rss.state IN ('review', 'relearning')
        AND rss.manual_override = 0
        AND rss.suspended = 0
        AND rss.stability IS NOT NULL
        AND rss.stability >= 7
        AND rss.reps >= 2
    ),
    eligible_review_subjects AS (
      SELECT
        subjectKey,
        subjectType,
        canonicalEntryId,
        crossMediaGroupId,
        reviewState,
        stability,
        reps
      FROM ranked_eligible_review_subjects
      WHERE taskRank = 1
    )
  `;
}

function buildCandidateMembersCteSql(mediaFilterClause: string) {
  return `
    candidate_members AS (
      SELECT
        ers.subjectKey,
        ers.subjectType,
        ers.canonicalEntryId,
        ers.crossMediaGroupId,
        t.id AS entryId,
        ers.reviewState,
        ers.stability,
        ers.reps,
        t.lemma AS lemma,
        t.reading AS reading,
        t.meaning_it AS meaningIt,
        t.media_id AS mediaId,
        m.slug AS mediaSlug,
        m.title AS mediaTitle
      FROM eligible_review_subjects ers
      INNER JOIN term t
        ON ers.subjectType = 'entry'
       AND t.id = ers.canonicalEntryId
      INNER JOIN media m
        ON m.id = t.media_id
       AND ${mediaFilterClause}
      UNION ALL
      SELECT
        ers.subjectKey,
        ers.subjectType,
        ers.canonicalEntryId,
        ers.crossMediaGroupId,
        t.id AS entryId,
        ers.reviewState,
        ers.stability,
        ers.reps,
        t.lemma AS lemma,
        t.reading AS reading,
        t.meaning_it AS meaningIt,
        t.media_id AS mediaId,
        m.slug AS mediaSlug,
        m.title AS mediaTitle
      FROM eligible_review_subjects ers
      INNER JOIN term t
        ON ers.subjectType = 'group'
       AND ers.crossMediaGroupId IS NOT NULL
       AND t.cross_media_group_id = ers.crossMediaGroupId
      INNER JOIN media m
        ON m.id = t.media_id
       AND ${mediaFilterClause}
    )
  `;
}

function buildCandidateCardScopeCtesSql() {
  return `
    candidate_entry_ids AS (
      SELECT DISTINCT
        cm.entryId
      FROM candidate_members cm
    ),
    canonical_candidate_term_links AS (
      SELECT
        rci.card_id AS cardId,
        c.card_type AS cardType,
        c.front AS front,
        c.normalized_front AS normalizedFront,
        rci.entry_id AS entryId,
        rci.has_primary AS hasPrimary
      FROM candidate_entry_ids cei
      INNER JOIN review_card_identity rci
        ON rci.entry_type = 'term'
       AND rci.entry_id = cei.entryId
       AND rci.driving_link_count = 1
      INNER JOIN card c
        ON c.id = rci.card_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE c.status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
    )
  `;
}

function buildEligibleCanonicalTermLinksCteSql() {
  return `
    eligible_canonical_term_links AS (
      SELECT DISTINCT
        cctl.cardId,
        cctl.front,
        t.id AS entryId
      FROM canonical_candidate_term_links cctl
      INNER JOIN term t
        ON t.id = cctl.entryId
      WHERE (
        cctl.cardType != 'concept'
        OR cctl.hasPrimary = 0
        OR cctl.normalizedFront IS NULL
        OR cctl.normalizedFront = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
        OR cctl.normalizedFront = ${normalizeReviewSubjectSurfaceSql("t.reading")}
      )
    )
  `;
}

function buildMediaFilterClause(mediaIds: string[]) {
  return mediaIds.length > 0
    ? `m.id IN (${mediaIds.map((mediaId) => quoteSqlString(mediaId)).join(", ")})`
    : "m.status = 'active'";
}

export function buildListEligibleKanjiClashSubjectsSql(options?: {
  mediaIds?: string[];
}) {
  const mediaIds =
    options?.mediaIds?.filter((mediaId) => mediaId.length > 0) ?? [];
  const mediaFilterClause = buildMediaFilterClause(mediaIds);

  return `
    WITH
    ${buildEligibleReviewSubjectsCteSql()},
    ${buildCandidateMembersCteSql(mediaFilterClause)},
    ${buildCandidateCardScopeCtesSql()},
    ${buildEligibleCanonicalTermLinksCteSql()}
    SELECT
      ectl.front AS cardFront,
      cm.subjectKey,
      cm.subjectType,
      cm.canonicalEntryId,
      cm.crossMediaGroupId,
      cm.reviewState,
      cm.stability,
      cm.reps,
      cm.entryId,
      cm.lemma,
      cm.reading,
      cm.meaningIt,
      cm.mediaId,
      cm.mediaSlug,
      cm.mediaTitle
    FROM candidate_members cm
    INNER JOIN eligible_canonical_term_links ectl
      ON ectl.entryId = cm.entryId
    ORDER BY cm.subjectKey ASC, cm.mediaSlug ASC, cm.entryId ASC, ectl.cardId ASC
  `;
}
