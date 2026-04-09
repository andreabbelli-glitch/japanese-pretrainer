import { quoteSqlString } from "./review-query-helpers.ts";

function normalizeReviewSubjectSurfaceSql(expression: string) {
  return `replace(replace(replace(replace(trim(${expression}), '～', '〜'), char(10), ' '), char(13), ' '), char(9), ' ')`;
}

function buildEligibleReviewSubjectsCteSql() {
  return `
    eligible_review_subjects AS (
      SELECT
        rss.subject_key AS subjectKey,
        rss.subject_type AS subjectType,
        rss.entry_id AS canonicalEntryId,
        rss.cross_media_group_id AS crossMediaGroupId,
        rss.state AS reviewState,
        rss.stability AS stability,
        rss.reps AS reps
      FROM review_subject_state rss
      WHERE rss.entry_type = 'term'
        AND rss.subject_type IN ('entry', 'group')
        AND rss.state IN ('review', 'relearning')
        AND rss.manual_override = 0
        AND rss.suspended = 0
        AND rss.stability IS NOT NULL
        AND rss.stability >= 7
        AND rss.reps >= 2
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
    candidate_cards AS (
      SELECT DISTINCT
        cel.card_id AS cardId
      FROM candidate_entry_ids cei
      INNER JOIN card_entry_link cel
        ON cel.entry_type = 'term'
       AND cel.entry_id = cei.entryId
    ),
    visible_candidate_cards AS (
      SELECT
        cc.cardId,
        c.card_type AS cardType,
        c.normalized_front AS normalizedFront
      FROM candidate_cards cc
      INNER JOIN card c
        ON c.id = cc.cardId
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

function buildCanonicalCandidateTermLinksCtesSql() {
  return `
    driving_candidate_links AS (
      SELECT
        vcc.cardId,
        vcc.cardType,
        vcc.normalizedFront,
        cel.entry_id AS entryId,
        cel.entry_type AS entryType,
        cel.relationship_type AS relationshipType
      FROM visible_candidate_cards vcc
      INNER JOIN card_entry_link cel
        ON cel.card_id = vcc.cardId
      WHERE cel.relationship_type = 'primary'
        OR NOT EXISTS(
          SELECT 1
          FROM card_entry_link cel_primary
          WHERE cel_primary.card_id = vcc.cardId
            AND cel_primary.relationship_type = 'primary'
        )
    ),
    driving_candidate_link_counts AS (
      SELECT
        dcl.cardId,
        COUNT(*) AS linkCount
      FROM driving_candidate_links dcl
      GROUP BY dcl.cardId
    ),
    canonical_candidate_term_links AS (
      SELECT
        dcl.cardId,
        dcl.cardType,
        dcl.normalizedFront,
        dcl.entryId,
        dcl.relationshipType
      FROM driving_candidate_links dcl
      INNER JOIN driving_candidate_link_counts dclc
        ON dclc.cardId = dcl.cardId
      WHERE dclc.linkCount = 1
        AND dcl.entryType = 'term'
    )
  `;
}

function buildEligibleTermEntriesCteSql() {
  return `
    eligible_term_entries AS (
      SELECT DISTINCT
        t.id AS entryId
      FROM canonical_candidate_term_links cctl
      INNER JOIN term t
        ON t.id = cctl.entryId
      WHERE (
        cctl.cardType != 'concept'
        OR cctl.relationshipType != 'primary'
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
    ${buildCanonicalCandidateTermLinksCtesSql()},
    ${buildEligibleTermEntriesCteSql()}
    SELECT
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
    INNER JOIN eligible_term_entries ete
      ON ete.entryId = cm.entryId
    ORDER BY cm.subjectKey ASC, cm.mediaSlug ASC, cm.entryId ASC
  `;
}
