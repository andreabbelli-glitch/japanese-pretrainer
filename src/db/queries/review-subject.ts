import { asc, eq, inArray } from "drizzle-orm";

import type { DatabaseClient } from "../client.ts";
import {
  reviewSubjectLog,
  reviewSubjectState
} from "../schema/index.ts";
import type { EntryType } from "../schema/index.ts";

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

  const rows = await database.all<{ count: number | string | null }>(`
    ${buildReviewLogSubjectIdentityCte()}
    SELECT COUNT(DISTINCT si.subjectKey) AS count
    FROM review_log rl
    INNER JOIN subject_identity si ON si.cardId = rl.card_id
    WHERE rl.previous_state = 'new'
      AND rl.answered_at >= ${quote(dayStartIso)}
      AND rl.answered_at < ${quote(dayEndIso)}
  `);

  return Number(rows[0]?.count ?? 0);
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
  const quotedMediaIds = mediaIds.map((mediaId) => quote(mediaId));

  const rows = await database.all<{
    count: number | string | null;
    mediaId: string;
  }>(`
    ${buildReviewLogSubjectIdentityCte()}
    SELECT
      si.mediaId AS mediaId,
      COUNT(DISTINCT si.subjectKey) AS count
    FROM review_log rl
    INNER JOIN subject_identity si ON si.cardId = rl.card_id
    WHERE rl.previous_state = 'new'
      AND rl.answered_at >= ${quote(dayStartIso)}
      AND rl.answered_at < ${quote(dayEndIso)}
      AND si.mediaId IN (${quotedMediaIds.join(", ")})
    GROUP BY si.mediaId
  `);

  return rows.map((row) => ({
    count: Number(row.count ?? 0),
    mediaId: row.mediaId
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

function getUtcDayBounds(asOf: Date) {
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

function quote(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function buildReviewLogSubjectIdentityCte() {
  return `
    WITH primary_presence AS (
      SELECT
        c.id AS cardId,
        EXISTS(
          SELECT 1
          FROM card_entry_link cel_primary
          WHERE cel_primary.card_id = c.id
            AND cel_primary.relationship_type = 'primary'
        ) AS hasPrimary
      FROM card c
    ),
    driving_links AS (
      SELECT
        c.id AS cardId,
        c.media_id AS mediaId,
        cel.entry_type AS entryType,
        cel.entry_id AS entryId
      FROM card c
      INNER JOIN primary_presence pp ON pp.cardId = c.id
      INNER JOIN card_entry_link cel ON cel.card_id = c.id
      WHERE cel.relationship_type = 'primary'
         OR pp.hasPrimary = 0
    ),
    driving_link_counts AS (
      SELECT
        dl.cardId AS cardId,
        MIN(dl.mediaId) AS mediaId,
        COUNT(*) AS linkCount,
        MIN(dl.entryType) AS entryType,
        MIN(dl.entryId) AS entryId
      FROM driving_links dl
      GROUP BY dl.cardId
    ),
    subject_identity AS (
      SELECT
        c.id AS cardId,
        c.media_id AS mediaId,
        CASE
          WHEN COALESCE(dlc.linkCount, 0) != 1 THEN 'card:' || c.id
          WHEN dlc.entryType = 'term' AND t.cross_media_group_id IS NOT NULL
            THEN 'group:term:' || t.cross_media_group_id
          WHEN dlc.entryType = 'grammar' AND gp.cross_media_group_id IS NOT NULL
            THEN 'group:grammar:' || gp.cross_media_group_id
          ELSE 'entry:' || COALESCE(dlc.entryType, 'card') || ':' || COALESCE(dlc.entryId, c.id)
        END AS subjectKey
      FROM card c
      LEFT JOIN driving_link_counts dlc ON dlc.cardId = c.id
      LEFT JOIN term t
        ON dlc.entryType = 'term'
       AND t.id = dlc.entryId
      LEFT JOIN grammar_pattern gp
        ON dlc.entryType = 'grammar'
       AND gp.id = dlc.entryId
    )
  `;
}
