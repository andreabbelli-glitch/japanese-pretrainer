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

import {
  buildReviewSubjectIdentityCteSql,
  quoteSqlString
} from "./review-query-helpers.ts";

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
  const mediaIds = options.mediaIds?.filter((mediaId) => mediaId.length > 0) ?? [];
  const mediaFilter =
    mediaIds.length > 0
      ? mediaIds.map((mediaId) => quoteSqlString(mediaId)).join(", ")
      : "SELECT id FROM media WHERE status = 'active'";
  const memberFilterClause =
    mediaIds.length > 0
      ? `WHERE t.media_id IN (${mediaIds.map((mediaId) => quoteSqlString(mediaId)).join(", ")})`
      : "";

  const rows = await database.all<EligibleKanjiClashSubjectRow>(`
    WITH ${buildReviewSubjectIdentityCteSql({ mediaFilter })},
    eligible_subjects AS (
      SELECT DISTINCT
        rss.subject_key AS subjectKey,
        rss.subject_type AS subjectType,
        rss.entry_id AS canonicalEntryId,
        rss.cross_media_group_id AS crossMediaGroupId,
        rss.state AS reviewState,
        rss.stability AS stability,
        rss.reps AS reps
      FROM subject_identity si
      INNER JOIN lesson l
        ON l.id = si.lesson_id
      INNER JOIN lesson_progress lp
        ON lp.lesson_id = l.id
      INNER JOIN review_subject_state rss
        ON rss.subject_key = si.subject_key
      WHERE si.entry_type = 'term'
        AND si.card_status = 'active'
        AND l.status = 'active'
        AND lp.status = 'completed'
        AND rss.entry_type = 'term'
        AND rss.subject_type IN ('entry', 'group')
        AND rss.state IN ('review', 'relearning')
        AND COALESCE(rss.manual_override, 0) = 0
        AND COALESCE(rss.suspended, 0) = 0
        AND rss.stability IS NOT NULL
        AND rss.stability >= 7
        AND rss.reps >= 2
    )
    SELECT DISTINCT
      es.subjectKey,
      es.subjectType,
      es.canonicalEntryId,
      es.crossMediaGroupId,
      es.reviewState,
      es.stability,
      es.reps,
      t.id AS entryId,
      t.lemma AS lemma,
      t.reading AS reading,
      t.meaning_it AS meaningIt,
      t.media_id AS mediaId,
      m.slug AS mediaSlug,
      m.title AS mediaTitle
    FROM eligible_subjects es
    INNER JOIN term t
      ON (
        es.crossMediaGroupId IS NOT NULL
        AND t.cross_media_group_id = es.crossMediaGroupId
      ) OR (
        es.crossMediaGroupId IS NULL
        AND es.canonicalEntryId IS NOT NULL
        AND t.id = es.canonicalEntryId
      )
    INNER JOIN media m
      ON m.id = t.media_id
    ${memberFilterClause}
    ORDER BY es.subjectKey ASC, m.slug ASC, t.id ASC
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
      if (!existing.members.some((currentMember) => currentMember.entryId === member.entryId)) {
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
  const surfaceForms = dedupeStable(members.map((member) => normalizeKanjiClashSurface(member.lemma)));
  const readingForms = dedupeStable(
    members.map((member) => normalizeKanjiClashSurface(member.reading)).filter((reading) => reading.length > 0)
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
