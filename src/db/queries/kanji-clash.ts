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
      SELECT DISTINCT
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
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
        AND rss.stability IS NOT NULL
        AND rss.stability >= 7
        AND rss.reps >= 2
    ),
    eligible_member_rows AS (
      SELECT DISTINCT
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
      INNER JOIN card_entry_link cel
        ON cel.entry_type = 'term'
       AND cel.entry_id = t.id
      INNER JOIN card c
        ON c.id = cel.card_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE c.status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND (
          cel.relationship_type = 'primary'
          OR NOT EXISTS(
            SELECT 1
            FROM card_entry_link cel_primary
            WHERE cel_primary.card_id = c.id
              AND cel_primary.relationship_type = 'primary'
          )
        )
        AND NOT EXISTS(
          SELECT 1
          FROM card_entry_link cel_other
          WHERE cel_other.card_id = c.id
            AND (
              cel_other.relationship_type = 'primary'
              OR NOT EXISTS(
                SELECT 1
                FROM card_entry_link cel_primary
                WHERE cel_primary.card_id = c.id
                  AND cel_primary.relationship_type = 'primary'
              )
            )
            AND NOT (
              cel_other.entry_type = cel.entry_type
              AND cel_other.entry_id = cel.entry_id
              AND cel_other.relationship_type = cel.relationship_type
            )
        )
        AND (
          c.card_type != 'concept'
          OR cel.relationship_type != 'primary'
          OR c.normalized_front IS NULL
          OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
          OR (
            t.reading IS NOT NULL
            AND c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.reading")}
          )
        )
      UNION ALL
      SELECT DISTINCT
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
      INNER JOIN card_entry_link cel
        ON cel.entry_type = 'term'
       AND cel.entry_id = t.id
      INNER JOIN card c
        ON c.id = cel.card_id
      INNER JOIN lesson l
        ON l.id = c.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      WHERE c.status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND (
          cel.relationship_type = 'primary'
          OR NOT EXISTS(
            SELECT 1
            FROM card_entry_link cel_primary
            WHERE cel_primary.card_id = c.id
              AND cel_primary.relationship_type = 'primary'
          )
        )
        AND NOT EXISTS(
          SELECT 1
          FROM card_entry_link cel_other
          WHERE cel_other.card_id = c.id
            AND (
              cel_other.relationship_type = 'primary'
              OR NOT EXISTS(
                SELECT 1
                FROM card_entry_link cel_primary
                WHERE cel_primary.card_id = c.id
                  AND cel_primary.relationship_type = 'primary'
              )
            )
            AND NOT (
              cel_other.entry_type = cel.entry_type
              AND cel_other.entry_id = cel.entry_id
              AND cel_other.relationship_type = cel.relationship_type
            )
        )
        AND (
          c.card_type != 'concept'
          OR cel.relationship_type != 'primary'
          OR c.normalized_front IS NULL
          OR c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.lemma")}
          OR (
            t.reading IS NOT NULL
            AND c.normalized_front = ${normalizeReviewSubjectSurfaceSql("t.reading")}
          )
        )
    )
    SELECT DISTINCT
      subjectKey,
      subjectType,
      canonicalEntryId,
      crossMediaGroupId,
      reviewState,
      stability,
      reps,
      entryId,
      lemma,
      reading,
      meaningIt,
      mediaId,
      mediaSlug,
      mediaTitle
    FROM eligible_member_rows
    ORDER BY subjectKey ASC, mediaSlug ASC, entryId ASC
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
