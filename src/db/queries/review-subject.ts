import {
  and,
  asc,
  eq,
  gte,
  gt,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  ne,
  notInArray,
  or,
  sql
} from "drizzle-orm";

import type { DatabaseClient, DatabaseQueryClient } from "../client.ts";
import {
  card,
  reviewMemoryAlias,
  reviewSubjectLog,
  reviewSubjectState
} from "../schema/index.ts";
import type { EntryType } from "../schema/index.ts";
import {
  REVIEW_MEMORY_KEY_VERSION,
  type ReviewRecallTask
} from "../../domain/review.ts";
import {
  buildEffectiveReviewEventMemoryKeySql,
  getLocalDayBounds,
  quoteSqlString
} from "./review-query-helpers.ts";

export type ReviewSubjectEntryRef = {
  entryId: string;
  entryType: EntryType;
};

export type ReviewSubjectStateRecord = typeof reviewSubjectState.$inferSelect;
export type ReviewSubjectDueCountRow = {
  count: number;
  dueAt: string;
};
export type ReviewSubjectFsrsReplayLogRecord = Pick<
  typeof reviewSubjectLog.$inferSelect,
  | "answeredAt"
  | "cardId"
  | "elapsedDays"
  | "id"
  | "newState"
  | "previousState"
  | "responseMs"
  | "scheduledDueAt"
  | "subjectKey"
> & {
  cardType: string;
  rating: NonNullable<(typeof reviewSubjectLog.$inferSelect)["rating"]>;
};
export type ReviewSubjectFsrsReplaySubject = {
  cardStatus: string;
  cardType: string;
  logs: ReviewSubjectFsrsReplayLogRecord[];
  mediaId: string;
  state: ReviewSubjectStateRecord;
};

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

/**
 * One index-bounded aggregate used by the daily interval load balancer. Rows
 * are bounded by UTC hour and folded into logical study days by the caller,
 * which keeps Europe/Rome DST handling out of SQLite.
 */
export async function listReviewSubjectDueCountsInRange(
  database: Pick<DatabaseClient, "select">,
  input: {
    endExclusiveIso: string;
    excludeSubjectKey?: string | null;
    recallTask?: ReviewRecallTask | null;
    startInclusiveIso: string;
  }
): Promise<ReviewSubjectDueCountRow[]> {
  const dueHour = sql<string>`substr(${reviewSubjectState.dueAt}, 1, 13)`;
  const rows = await database
    .select({
      count: sql<number>`cast(count(*) as integer)`.mapWith(Number),
      // The 04:00 Europe/Rome boundary always lands on a whole UTC hour.
      // Hour buckets therefore remain logical-day safe across both DST edges,
      // while bounding legacy non-normalized payloads independently of cards.
      dueAt: sql<string>`min(${reviewSubjectState.dueAt})`
    })
    .from(reviewSubjectState)
    .where(
      and(
        isNotNull(reviewSubjectState.dueAt),
        gte(reviewSubjectState.dueAt, input.startInclusiveIso),
        lt(reviewSubjectState.dueAt, input.endExclusiveIso),
        eq(reviewSubjectState.manualOverride, false),
        eq(reviewSubjectState.suspended, false),
        gt(reviewSubjectState.scheduledDays, 0),
        notInArray(reviewSubjectState.state, [
          "new",
          "known_manual",
          "suspended"
        ]),
        input.recallTask
          ? or(
              eq(reviewSubjectState.recallTask, input.recallTask),
              and(
                isNull(reviewSubjectState.recallTask),
                // A v1 memory key encodes the task unambiguously. Older NULL
                // rows without that prefix are excluded instead of guessed.
                like(
                  reviewSubjectState.subjectKey,
                  `${REVIEW_MEMORY_KEY_VERSION}:${input.recallTask}:%`
                )
              )
            )
          : undefined,
        input.excludeSubjectKey
          ? ne(reviewSubjectState.subjectKey, input.excludeSubjectKey)
          : undefined
      )
    )
    .groupBy(dueHour)
    .orderBy(asc(sql`min(${reviewSubjectState.dueAt})`));

  return rows;
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

export async function listReviewSubjectFsrsReplaySubjects(
  database: Pick<DatabaseClient, "select">
): Promise<ReviewSubjectFsrsReplaySubject[]> {
  const stateRows = await database
    .select({
      cardStatus: card.status,
      cardType: card.cardType,
      mediaId: card.mediaId,
      state: reviewSubjectState
    })
    .from(reviewSubjectState)
    .innerJoin(card, eq(card.id, reviewSubjectState.cardId))
    .where(
      and(
        eq(card.status, "active"),
        eq(reviewSubjectState.manualOverride, false),
        eq(reviewSubjectState.suspended, false),
        notInArray(reviewSubjectState.state, [
          "new",
          "known_manual",
          "suspended"
        ])
      )
    )
    .orderBy(asc(reviewSubjectState.subjectKey));

  if (stateRows.length === 0) {
    return [];
  }

  const memoryKeys = stateRows.map((row) => row.state.subjectKey);
  const eventMemoryKey = buildReviewEventMemoryKeyExpression();
  const effectiveMemoryKey = sql<string>`coalesce(${reviewMemoryAlias.currentMemoryKey}, ${eventMemoryKey})`;
  const logRows = await database
    .select({
      answeredAt: reviewSubjectLog.answeredAt,
      cardId: reviewSubjectLog.cardId,
      cardType: sql<string>`coalesce(${reviewSubjectLog.cardTypeSnapshot}, ${card.cardType})`,
      elapsedDays: reviewSubjectLog.elapsedDays,
      id: reviewSubjectLog.id,
      newState: reviewSubjectLog.newState,
      previousState: reviewSubjectLog.previousState,
      rating: sql<
        NonNullable<(typeof reviewSubjectLog.$inferSelect)["rating"]>
      >`${reviewSubjectLog.rating}`,
      responseMs: reviewSubjectLog.responseMs,
      scheduledDueAt: reviewSubjectLog.scheduledDueAt,
      subjectKey: effectiveMemoryKey
    })
    .from(reviewSubjectLog)
    .leftJoin(card, eq(card.id, reviewSubjectLog.cardId))
    .leftJoin(
      reviewMemoryAlias,
      eq(reviewMemoryAlias.aliasMemoryKey, eventMemoryKey)
    )
    .where(
      and(
        inArray(effectiveMemoryKey, memoryKeys),
        eq(reviewSubjectLog.eventKind, "grade"),
        isNotNull(reviewSubjectLog.rating)
      )
    )
    .orderBy(
      asc(effectiveMemoryKey),
      asc(reviewSubjectLog.answeredAt),
      asc(reviewSubjectLog.id)
    );
  const logsBySubjectKey = new Map<
    string,
    ReviewSubjectFsrsReplayLogRecord[]
  >();

  for (const log of logRows) {
    const logs = logsBySubjectKey.get(log.subjectKey) ?? [];

    logs.push(log);
    logsBySubjectKey.set(log.subjectKey, logs);
  }

  return stateRows.map((row) => ({
    cardStatus: row.cardStatus,
    cardType: row.cardType,
    logs: logsBySubjectKey.get(row.state.subjectKey) ?? [],
    mediaId: row.mediaId,
    state: row.state
  }));
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
      ? `(rci.entry_type = 'term' AND rci.entry_id IN (${termEntryIds.join(", ")}))`
      : null,
    grammarEntryIds.length > 0
      ? `(rci.entry_type = 'grammar' AND rci.entry_id IN (${grammarEntryIds.join(", ")}))`
      : null
  ].filter((clause): clause is string => clause !== null);

  if (matchClauses.length === 0) {
    return [];
  }

  const rows = await database.all<{ cardId: string }>(`
    SELECT DISTINCT rci.card_id AS cardId
    FROM review_card_identity rci
    INNER JOIN card c
      ON c.id = rci.card_id
    INNER JOIN lesson l
      ON l.id = c.lesson_id
    INNER JOIN lesson_progress lp
      ON lp.lesson_id = l.id
    WHERE c.status != 'archived'
      AND l.status = 'active'
      AND lp.status = 'completed'
      AND rci.driving_link_count = 1
      AND (${matchClauses.join(" OR ")})
  `);

  return rows.map((row) => row.cardId);
}

export async function countReviewSubjectsIntroducedOnDay(
  database: DatabaseQueryClient,
  asOf = new Date()
) {
  const { dayEndIso, dayStartIso } = getLocalDayBounds(asOf);
  const eventMemoryKey = buildReviewEventMemoryKeyExpression();
  const effectiveMemoryKey = sql<string>`coalesce(${reviewMemoryAlias.currentMemoryKey}, ${eventMemoryKey})`;

  const rows = await database
    .select({
      count: sql<number>`cast(count(distinct ${effectiveMemoryKey}) as integer)`
    })
    .from(reviewSubjectLog)
    .leftJoin(
      reviewMemoryAlias,
      eq(reviewMemoryAlias.aliasMemoryKey, eventMemoryKey)
    )
    .where(
      and(
        eq(reviewSubjectLog.eventKind, "grade"),
        isNotNull(reviewSubjectLog.rating),
        eq(reviewSubjectLog.previousState, "new"),
        ne(effectiveMemoryKey, ""),
        ne(effectiveMemoryKey, "undefined"),
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
  const eventMediaId = sql<string>`coalesce(${reviewSubjectLog.mediaIdSnapshot}, ${card.mediaId})`;
  const eventMemoryKey = buildReviewEventMemoryKeyExpression();
  const effectiveMemoryKey = sql<string>`coalesce(${reviewMemoryAlias.currentMemoryKey}, ${eventMemoryKey})`;
  const rows = await database
    .select({
      count: sql<number>`cast(count(distinct ${effectiveMemoryKey}) as integer)`,
      mediaId: eventMediaId
    })
    .from(reviewSubjectLog)
    .leftJoin(card, eq(reviewSubjectLog.cardId, card.id))
    .leftJoin(
      reviewMemoryAlias,
      eq(reviewMemoryAlias.aliasMemoryKey, eventMemoryKey)
    )
    .where(
      and(
        inArray(eventMediaId, mediaIds),
        eq(reviewSubjectLog.eventKind, "grade"),
        isNotNull(reviewSubjectLog.rating),
        eq(reviewSubjectLog.previousState, "new"),
        ne(effectiveMemoryKey, ""),
        ne(effectiveMemoryKey, "undefined"),
        gte(reviewSubjectLog.answeredAt, dayStartIso),
        lt(reviewSubjectLog.answeredAt, dayEndIso)
      )
    )
    .groupBy(eventMediaId);

  return rows;
}

export async function listReviewSubjectLogsBySubjectKey(
  database: DatabaseQueryClient,
  subjectKey: string,
  limit = 50
) {
  const eventMemoryKey = buildReviewEventMemoryKeyExpression();
  const effectiveMemoryKey = sql<string>`coalesce(${reviewMemoryAlias.currentMemoryKey}, ${eventMemoryKey})`;
  const rows = await database
    .select({ log: reviewSubjectLog })
    .from(reviewSubjectLog)
    .leftJoin(
      reviewMemoryAlias,
      eq(reviewMemoryAlias.aliasMemoryKey, eventMemoryKey)
    )
    .where(eq(effectiveMemoryKey, subjectKey))
    .orderBy(asc(reviewSubjectLog.answeredAt), asc(reviewSubjectLog.id))
    .limit(limit);

  return rows.map((row) => row.log);
}

function buildReviewEventMemoryKeyExpression() {
  return sql<string>`${sql.raw(
    buildEffectiveReviewEventMemoryKeySql({
      canonicalSubjectKeyExpression: "review_subject_log.canonical_subject_key",
      cardIdExpression: "review_subject_log.card_id",
      eventSchemaVersionExpression: "review_subject_log.event_schema_version",
      memoryKeyExpression: "review_subject_log.memory_key",
      recallTaskExpression: "review_subject_log.recall_task",
      subjectKeyExpression: "review_subject_log.subject_key"
    })
  )}`;
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
