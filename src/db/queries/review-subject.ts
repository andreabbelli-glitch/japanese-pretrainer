import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  card,
  reviewSubjectLog,
  reviewSubjectState
} from "../schema/index.ts";
import type { EntryType } from "../schema/index.ts";
import { getUtcDayBounds } from "./review-query-helpers.ts";

export type ReviewSubjectEntryRef = {
  entryId: string;
  entryType: EntryType;
};

export type ReviewSubjectStateRecord = typeof reviewSubjectState.$inferSelect;

export async function getReviewSubjectStateByKey(
  database: DatabaseClient,
  subjectKey: string
): Promise<ReviewSubjectStateRecord | null> {
  return (
    (await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, subjectKey)
    })) ?? null
  );
}

export async function listReviewSubjectStatesByKeys(
  database: DatabaseClient,
  subjectKeys: string[]
): Promise<Map<string, ReviewSubjectStateRecord>> {
  if (subjectKeys.length === 0) {
    return new Map();
  }

  const rows = await database.query.reviewSubjectState.findMany({
    where: inArray(reviewSubjectState.subjectKey, subjectKeys)
  });

  return new Map(rows.map((row) => [row.subjectKey, row]));
}

export async function listReviewCardIdsByEntryRefs(
  database: DatabaseClient,
  entryRefs: ReviewSubjectEntryRef[]
): Promise<string[]> {
  const refs = dedupeEntryRefs(entryRefs);

  if (refs.length === 0) {
    return [];
  }

  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const termEntryIds = refs
    .filter((ref) => ref.entryType === "term")
    .map((ref) => quote(ref.entryId));
  const grammarEntryIds = refs
    .filter((ref) => ref.entryType === "grammar")
    .map((ref) => quote(ref.entryId));
  const matchClauses = [
    termEntryIds.length > 0
      ? `(cel.entry_type = 'term' AND cel.entry_id IN (${termEntryIds.join(", ")}))`
      : null,
    grammarEntryIds.length > 0
      ? `(cel.entry_type = 'grammar' AND cel.entry_id IN (${grammarEntryIds.join(", ")}))`
      : null
  ].filter((clause): clause is string => clause !== null);

  if (matchClauses.length === 0) {
    return [];
  }

  const rows = await database.all<{ cardId: string }>(`
    SELECT DISTINCT c.id AS cardId
    FROM card c
    INNER JOIN lesson l
      ON l.id = c.lesson_id
    INNER JOIN lesson_progress lp
      ON lp.lesson_id = l.id
    WHERE c.status != 'archived'
      AND l.status = 'active'
      AND lp.status = 'completed'
      AND EXISTS (
        SELECT 1
        FROM card_entry_link cel
        WHERE cel.card_id = c.id
          AND (
            cel.relationship_type = 'primary'
            OR NOT EXISTS (
              SELECT 1
              FROM card_entry_link cel_primary
              WHERE cel_primary.card_id = c.id
                AND cel_primary.relationship_type = 'primary'
            )
          )
          AND (${matchClauses.join(" OR ")})
      )
      AND (
        SELECT COUNT(*)
        FROM card_entry_link cel_count
        WHERE cel_count.card_id = c.id
          AND (
            cel_count.relationship_type = 'primary'
            OR NOT EXISTS (
              SELECT 1
              FROM card_entry_link cel_primary
              WHERE cel_primary.card_id = c.id
                AND cel_primary.relationship_type = 'primary'
            )
          )
      ) = 1
  `);

  return rows.map((row) => row.cardId);
}

export async function countReviewSubjectsIntroducedOnDay(
  database: DatabaseClient,
  asOf = new Date()
) {
  const { dayEndIso, dayStartIso } = getUtcDayBounds(asOf);

  const rows = await database
    .selectDistinct({
      subjectKey: reviewSubjectLog.subjectKey
    })
    .from(reviewSubjectLog)
    .where(
      and(
        eq(reviewSubjectLog.previousState, "new"),
        gte(reviewSubjectLog.answeredAt, dayStartIso),
        lt(reviewSubjectLog.answeredAt, dayEndIso)
      )
    );

  return rows.filter(
    (row) =>
      row.subjectKey &&
      row.subjectKey.length > 0 &&
      row.subjectKey !== "undefined"
  ).length;
}

export async function countReviewSubjectsIntroducedOnDayByMediaId(
  database: DatabaseClient,
  mediaId: string,
  asOf = new Date()
) {
  const rows = await countReviewSubjectsIntroducedOnDayByMediaIds(
    database,
    [mediaId],
    asOf
  );

  return rows[0]?.count ?? 0;
}

export async function countReviewSubjectsIntroducedOnDayByMediaIds(
  database: DatabaseClient,
  mediaIds: string[],
  asOf = new Date()
) {
  if (mediaIds.length === 0) {
    return [];
  }

  const { dayEndIso, dayStartIso } = getUtcDayBounds(asOf);
  const rows = await database
    .selectDistinct({
      mediaId: card.mediaId,
      subjectKey: reviewSubjectLog.subjectKey
    })
    .from(reviewSubjectLog)
    .innerJoin(card, eq(reviewSubjectLog.cardId, card.id))
    .where(
      and(
        inArray(card.mediaId, mediaIds),
        eq(reviewSubjectLog.previousState, "new"),
        gte(reviewSubjectLog.answeredAt, dayStartIso),
        lt(reviewSubjectLog.answeredAt, dayEndIso)
      )
    );

  const filteredRows = rows.filter(
    (row) =>
      row.subjectKey &&
      row.subjectKey.length > 0 &&
      row.subjectKey !== "undefined"
  );
  const grouped = new Map<string, Set<string>>();

  for (const row of filteredRows) {
    const existing = grouped.get(row.mediaId);

    if (existing) {
      existing.add(row.subjectKey);
      continue;
    }

    grouped.set(row.mediaId, new Set([row.subjectKey]));
  }

  return [...grouped.entries()].map(([mediaId, subjectKeys]) => ({
    count: subjectKeys.size,
    mediaId
  }));
}

export async function listReviewSubjectLogsBySubjectKey(
  database: DatabaseClient,
  subjectKey: string,
  limit = 50
) {
  return database.query.reviewSubjectLog.findMany({
    where: eq(reviewSubjectLog.subjectKey, subjectKey),
    orderBy: [asc(reviewSubjectLog.answeredAt)],
    limit
  });
}

function dedupeEntryRefs(entryRefs: ReviewSubjectEntryRef[]) {
  const seen = new Set<string>();
  const result: ReviewSubjectEntryRef[] = [];

  for (const entry of entryRefs) {
    const key = `${entry.entryType}:${entry.entryId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(entry);
  }

  return result;
}
