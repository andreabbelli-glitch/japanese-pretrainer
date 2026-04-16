import { and, asc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import { card, reviewSubjectLog, reviewSubjectState } from "../schema/index.ts";
import type { EntryType } from "../schema/index.ts";
import { getLocalDayBounds, quoteSqlString } from "./review-query-helpers.ts";

export type ReviewSubjectEntryRef = {
  entryId: string;
  entryType: EntryType;
};

export type ReviewSubjectStateRecord = typeof reviewSubjectState.$inferSelect;

export async function getReviewSubjectStateByKey(
  database: DatabaseQueryClient,
  subjectKey: string
): Promise<ReviewSubjectStateRecord | null> {
  return (
    (await database.query.reviewSubjectState.findFirst({
      where: eq(reviewSubjectState.subjectKey, subjectKey)
    })) ?? null
  );
}

export async function listReviewSubjectStatesByKeys(
  database: Pick<DatabaseClient, "query">,
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
  database: DatabaseQueryClient,
  entryRefs: ReviewSubjectEntryRef[]
): Promise<string[]> {
  const refs = dedupeEntryRefs(entryRefs);

  if (refs.length === 0) {
    return [];
  }

  const termEntryIds = refs
    .filter((ref) => ref.entryType === "term")
    .map((ref) => quoteSqlString(ref.entryId));
  const grammarEntryIds = refs
    .filter((ref) => ref.entryType === "grammar")
    .map((ref) => quoteSqlString(ref.entryId));
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
  database: DatabaseQueryClient,
  asOf = new Date()
) {
  const { dayEndIso, dayStartIso } = getLocalDayBounds(asOf);

  const rows = await database
    .select({
      count: sql<number>`cast(count(distinct ${reviewSubjectLog.subjectKey}) as integer)`
    })
    .from(reviewSubjectLog)
    .where(
      and(
        eq(reviewSubjectLog.previousState, "new"),
        ne(reviewSubjectLog.subjectKey, ""),
        ne(reviewSubjectLog.subjectKey, "undefined"),
        gte(reviewSubjectLog.answeredAt, dayStartIso),
        lt(reviewSubjectLog.answeredAt, dayEndIso)
      )
    );

  return rows[0]?.count ?? 0;
}

export async function countReviewSubjectsIntroducedOnDayByMediaId(
  database: DatabaseQueryClient,
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
  database: DatabaseQueryClient,
  mediaIds: string[],
  asOf = new Date()
) {
  if (mediaIds.length === 0) {
    return [];
  }

  const { dayEndIso, dayStartIso } = getLocalDayBounds(asOf);
  const rows = await database
    .select({
      count: sql<number>`cast(count(distinct ${reviewSubjectLog.subjectKey}) as integer)`,
      mediaId: card.mediaId
    })
    .from(reviewSubjectLog)
    .innerJoin(card, eq(reviewSubjectLog.cardId, card.id))
    .where(
      and(
        inArray(card.mediaId, mediaIds),
        eq(reviewSubjectLog.previousState, "new"),
        ne(reviewSubjectLog.subjectKey, ""),
        ne(reviewSubjectLog.subjectKey, "undefined"),
        gte(reviewSubjectLog.answeredAt, dayStartIso),
        lt(reviewSubjectLog.answeredAt, dayEndIso)
      )
    )
    .groupBy(card.mediaId);

  return rows;
}

export async function listReviewSubjectLogsBySubjectKey(
  database: DatabaseQueryClient,
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
