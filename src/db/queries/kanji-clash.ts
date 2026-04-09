import type { DatabaseQueryClient } from "../client.ts";
import type {
  KanjiClashEligibleReviewState,
  KanjiClashEligibleSubject,
  KanjiClashEligibleSubjectMember
} from "../../lib/kanji-clash/types.ts";
import {
  collectKanjiFromSurfaces,
  normalizeKanjiClashSurface
} from "../../lib/kanji-clash/utils.ts";

import { quoteSqlString } from "./review-query-helpers.ts";

function normalizeReviewSubjectSurfaceSql(expression: string) {
  return `replace(replace(replace(replace(trim(${expression}), '～', '〜'), char(10), ' '), char(13), ' '), char(9), ' ')`;
}

type EligibleKanjiClashSubjectRow = {
  canonicalEntryId: string | null;
  crossMediaGroupId: string | null;
  entryId: string;
  lemma: string;
  meaningIt: string;
  mediaId: string;
  mediaSlug: string;
  mediaTitle: string;
  reading: string;
  reps: number | string;
  reviewState: KanjiClashEligibleReviewState;
  stability: number | string;
  subjectKey: string;
  subjectType: "entry" | "group";
};

export async function listEligibleKanjiClashSubjects(
  database: DatabaseQueryClient,
  options: {
    mediaIds?: string[];
  } = {}
): Promise<KanjiClashEligibleSubject[]> {
  const mediaIds =
    options.mediaIds?.filter((mediaId) => mediaId.length > 0) ?? [];
  const mediaFilterClause =
    mediaIds.length > 0
      ? `m.id IN (${mediaIds.map((mediaId) => quoteSqlString(mediaId)).join(", ")})`
      : "m.status = 'active'";

  const rows = await database.all<EligibleKanjiClashSubjectRow>(`
    WITH eligible_subjects AS (
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
    ),
    candidate_members AS (
      SELECT
        es.subjectKey,
        es.subjectType,
        es.canonicalEntryId,
        es.crossMediaGroupId,
        t.id AS entryId,
        es.reviewState,
        es.stability,
        es.reps,
        t.lemma AS lemma,
        t.reading AS reading,
        t.meaning_it AS meaningIt,
        t.media_id AS mediaId,
        m.slug AS mediaSlug,
        m.title AS mediaTitle
      FROM eligible_subjects es
      INNER JOIN term t
        ON es.subjectType = 'entry'
       AND t.id = es.canonicalEntryId
      INNER JOIN media m
        ON m.id = t.media_id
       AND ${mediaFilterClause}
      UNION ALL
      SELECT
        es.subjectKey,
        es.subjectType,
        es.canonicalEntryId,
        es.crossMediaGroupId,
        t.id AS entryId,
        es.reviewState,
        es.stability,
        es.reps,
        t.lemma AS lemma,
        t.reading AS reading,
        t.meaning_it AS meaningIt,
        t.media_id AS mediaId,
        m.slug AS mediaSlug,
        m.title AS mediaTitle
      FROM eligible_subjects es
      INNER JOIN term t
        ON es.subjectType = 'group'
       AND es.crossMediaGroupId IS NOT NULL
       AND t.cross_media_group_id = es.crossMediaGroupId
      INNER JOIN media m
        ON m.id = t.media_id
       AND ${mediaFilterClause}
    ),
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
    ),
    visible_card_link_stats AS (
      SELECT
        vcc.cardId,
        SUM(
          CASE
            WHEN cel.relationship_type = 'primary' THEN 1
            ELSE 0
          END
        ) AS primaryLinkCount,
        COUNT(*) AS totalLinkCount
      FROM visible_candidate_cards vcc
      INNER JOIN card_entry_link cel
        ON cel.card_id = vcc.cardId
      GROUP BY vcc.cardId
    ),
    singleton_canonical_term_links AS (
      SELECT
        cel.card_id AS cardId,
        cel.entry_id AS entryId,
        cel.relationship_type AS relationshipType
      FROM visible_candidate_cards vcc
      INNER JOIN visible_card_link_stats vcls
        ON vcls.cardId = vcc.cardId
      INNER JOIN card_entry_link cel
        ON cel.card_id = vcc.cardId
      WHERE cel.entry_type = 'term'
        AND (
          (
            vcls.primaryLinkCount = 1
            AND cel.relationship_type = 'primary'
          )
          OR (
            vcls.primaryLinkCount = 0
            AND vcls.totalLinkCount = 1
          )
        )
    ),
    eligible_term_entries AS (
      SELECT DISTINCT
        t.id AS entryId
      FROM singleton_canonical_term_links sctl
      INNER JOIN visible_candidate_cards vcc
        ON vcc.cardId = sctl.cardId
      INNER JOIN term t
        ON t.id = sctl.entryId
      WHERE (
        vcc.cardType != 'concept'
        OR sctl.relationshipType != 'primary'
        OR vcc.normalizedFront IS NULL
        OR vcc.normalizedFront = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
        OR vcc.normalizedFront = ${normalizeReviewSubjectSurfaceSql("t.reading")}
      )
    )
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
  `);

  return aggregateEligibleKanjiClashSubjects(rows);
}

function aggregateEligibleKanjiClashSubjects(
  rows: EligibleKanjiClashSubjectRow[]
): KanjiClashEligibleSubject[] {
  const subjects = new Map<string, KanjiClashEligibleSubject>();

  for (const row of rows) {
    const member: KanjiClashEligibleSubjectMember = {
      entryId: row.entryId,
      lemma: row.lemma,
      meaningIt: row.meaningIt,
      mediaId: row.mediaId,
      mediaSlug: row.mediaSlug,
      mediaTitle: row.mediaTitle,
      reading: row.reading
    };
    const existing = subjects.get(row.subjectKey);

    if (existing) {
      if (
        !existing.members.some(
          (currentMember) => currentMember.entryId === member.entryId
        )
      ) {
        existing.members.push(member);
      }

      continue;
    }

    subjects.set(row.subjectKey, {
      entryType: "term",
      kanji: [],
      label: row.lemma,
      members: [member],
      reading: row.reading,
      readingForms: [],
      reps: Number(row.reps),
      reviewState: row.reviewState,
      source:
        row.subjectType === "group" && row.crossMediaGroupId
          ? {
              crossMediaGroupId: row.crossMediaGroupId,
              type: "group" as const
            }
          : {
              entryId: row.canonicalEntryId ?? row.entryId,
              type: "entry" as const
            },
      stability: Number(row.stability),
      subjectKey: row.subjectKey,
      surfaceForms: []
    });
  }

  return [...subjects.values()]
    .map((subject) => finalizeEligibleKanjiClashSubject(subject))
    .filter((subject): subject is KanjiClashEligibleSubject => subject !== null)
    .sort((left, right) => left.subjectKey.localeCompare(right.subjectKey));
}

function finalizeEligibleKanjiClashSubject(
  subject: KanjiClashEligibleSubject
): KanjiClashEligibleSubject | null {
  const members = [...subject.members].sort((left, right) => {
    const mediaDifference = left.mediaSlug.localeCompare(right.mediaSlug);

    if (mediaDifference !== 0) {
      return mediaDifference;
    }

    return left.entryId.localeCompare(right.entryId);
  });
  const surfaceForms = dedupeStable(
    members.map((member) => normalizeKanjiClashSurface(member.lemma))
  );
  const readingForms = dedupeStable(
    members
      .map((member) => normalizeKanjiClashSurface(member.reading))
      .filter((reading) => reading.length > 0)
  );
  const kanji = collectKanjiFromSurfaces(surfaceForms);

  if (kanji.length === 0) {
    return null;
  }

  return {
    ...subject,
    kanji,
    label: members[0]?.lemma ?? subject.label,
    members,
    reading: members[0]?.reading ?? subject.reading ?? null,
    readingForms,
    surfaceForms
  };
}

function dedupeStable(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}
