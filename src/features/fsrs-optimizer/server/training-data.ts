import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db, type DatabaseClient } from "../../../db/index.ts";
import { buildEffectiveReviewEventMemoryKeySql } from "../../../db/queries/review-query-helpers.ts";
import { card, reviewSubjectLog } from "../../../db/schema/index.ts";
import {
  differenceInReviewStudyDayKeys,
  differenceInReviewStudyDays
} from "../../review/model/study-day.ts";
import { resolveFsrsPresetKey, type FsrsPresetKey } from "../model/snapshot.ts";

export type FsrsOptimizerLogRow = {
  answeredAt: string;
  cardType: string;
  elapsedDays: number | null;
  eventKind?: string;
  id: string;
  newState?: string | null;
  previousState?: string | null;
  rating: string | null;
  studyDay?: string | null;
  studyDayPolicy?: string | null;
  subjectKey: string;
};

export type FsrsTrainingReview = {
  deltaT: number;
  rating: 1 | 2 | 3 | 4;
};

export type FsrsTrainingDataset = {
  itemCount: number;
  items: FsrsTrainingReview[][];
  reviewCount: number;
  sequences: FsrsTrainingSequence[];
  subjectCount: number;
};

export type FsrsTrainingSequence = {
  reviews: FsrsTrainingReview[];
  subjectKey: string;
  targetAnsweredAt: string;
  targetStudyDay: string | null;
};

export type FsrsEligibleReviewCounts = Record<FsrsPresetKey, number>;

type FsrsTrainingReviewWithTimestamp = FsrsTrainingReview & {
  answeredAt: string;
  studyDay: string | null;
  studyDayPolicy: string | null;
};

type FsrsTrainingDataCounter = Pick<DatabaseClient, "select">;

export function buildFsrsTrainingDataset(
  rows: FsrsOptimizerLogRow[],
  presetKey: FsrsPresetKey
): FsrsTrainingDataset {
  const orderedRows = [...rows].sort(compareOptimizerLogRows);
  const presetBySubject = new Map<string, FsrsPresetKey>();
  const mixedPresetSubjectKeys = new Set<string>();
  const reviewsBySubject = new Map<string, FsrsTrainingReviewWithTimestamp[]>();
  const reviewedSubjectKeys = new Set<string>();
  const sequences: FsrsTrainingSequence[] = [];
  let reviewCount = 0;

  for (const row of orderedRows) {
    if ((row.eventKind ?? "grade") !== "grade") {
      continue;
    }

    const rowPresetKey = resolveFsrsPresetKey(row.cardType);

    if (!rowPresetKey) {
      continue;
    }

    const previousPresetKey = presetBySubject.get(row.subjectKey);

    if (previousPresetKey && previousPresetKey !== rowPresetKey) {
      mixedPresetSubjectKeys.add(row.subjectKey);
      continue;
    }

    presetBySubject.set(row.subjectKey, rowPresetKey);
  }

  for (const row of orderedRows) {
    if (
      mixedPresetSubjectKeys.has(row.subjectKey) ||
      resolveFsrsPresetKey(row.cardType) !== presetKey
    ) {
      continue;
    }

    if (row.eventKind === "reset") {
      reviewsBySubject.set(row.subjectKey, []);
      continue;
    }

    if ((row.eventKind ?? "grade") !== "grade") {
      continue;
    }

    const rating = mapRatingToBindingValue(row.rating);

    if (rating === null) {
      continue;
    }

    let subjectReviews = reviewsBySubject.get(row.subjectKey) ?? [];

    // A reset is normally present in the v2 ledger. `previousState = new`
    // remains a safe boundary for imported/legacy histories where that event
    // was not recorded explicitly.
    if (row.previousState === "new" && subjectReviews.length > 0) {
      subjectReviews = [];
    }

    const previousReview = subjectReviews.at(-1);
    const deltaT = previousReview
      ? calculateElapsedDaysBetweenReviews(previousReview, row)
      : 0;

    subjectReviews.push({
      answeredAt: row.answeredAt,
      deltaT,
      rating,
      studyDay: row.studyDay ?? null,
      studyDayPolicy: row.studyDayPolicy ?? null
    });
    reviewsBySubject.set(row.subjectKey, subjectReviews);
    reviewedSubjectKeys.add(row.subjectKey);
    reviewCount += 1;

    // FSRS treats the last review as the supervised target. A prefix whose
    // last delta is zero has no long-term recall target, even if an earlier
    // review in the same prefix crossed a day boundary.
    if (subjectReviews.length >= 2 && deltaT > 0) {
      const slice = subjectReviews.map((review) => ({
        deltaT: review.deltaT,
        rating: review.rating
      }));

      sequences.push({
        reviews: slice,
        subjectKey: row.subjectKey,
        targetAnsweredAt: row.answeredAt,
        targetStudyDay: row.studyDay ?? null
      });
    }
  }

  const items = sequences.map((sequence) => sequence.reviews);

  return {
    itemCount: items.length,
    items,
    reviewCount,
    sequences,
    subjectCount: reviewedSubjectKeys.size
  };
}

export async function countEligibleFsrsOptimizerReviewsByPreset(
  database: FsrsTrainingDataCounter = db
): Promise<FsrsEligibleReviewCounts> {
  const cardTypeExpression = sql<string>`coalesce(${reviewSubjectLog.cardTypeSnapshot}, ${card.cardType})`;
  const result = await database
    .select({
      cardType: cardTypeExpression,
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(reviewSubjectLog)
    .leftJoin(card, eq(card.id, reviewSubjectLog.cardId))
    .where(
      and(
        eq(reviewSubjectLog.eventKind, "grade"),
        isNotNull(reviewSubjectLog.rating),
        inArray(cardTypeExpression, ["recognition", "concept"])
      )
    )
    .groupBy(cardTypeExpression);
  const counts: FsrsEligibleReviewCounts = {
    concept: 0,
    recognition: 0
  };

  for (const row of result) {
    const presetKey = resolveFsrsPresetKey(row.cardType);

    if (presetKey) {
      counts[presetKey] = Number(row.count ?? 0);
    }
  }

  return counts;
}

export async function countEligibleFsrsOptimizerReviews(
  database: FsrsTrainingDataCounter = db
) {
  const counts = await countEligibleFsrsOptimizerReviewsByPreset(database);

  return counts.recognition + counts.concept;
}

export async function loadFsrsOptimizerLogRows(
  database: DatabaseClient
): Promise<FsrsOptimizerLogRow[]> {
  const eventMemoryKeySql = buildEffectiveReviewEventMemoryKeySql({
    canonicalSubjectKeyExpression: "rsl.canonical_subject_key",
    cardIdExpression: "rsl.card_id",
    eventSchemaVersionExpression: "rsl.event_schema_version",
    memoryKeyExpression: "rsl.memory_key",
    recallTaskExpression: "rsl.recall_task",
    subjectKeyExpression: "rsl.subject_key"
  });
  const effectiveMemoryKeySql = `coalesce(rma.current_memory_key, ${eventMemoryKeySql})`;
  const result = await database.$client.execute({
    sql: `
      select
        rsl.id as id,
        ${effectiveMemoryKeySql} as subjectKey,
        rsl.answered_at as answeredAt,
        rsl.event_kind as eventKind,
        rsl.rating as rating,
        rsl.previous_state as previousState,
        rsl.new_state as newState,
        rsl.elapsed_days as elapsedDays,
        rsl.study_day as studyDay,
        rsl.study_day_policy as studyDayPolicy,
        coalesce(rsl.card_type_snapshot, c.card_type) as cardType
      from review_subject_log rsl
      left join card c on c.id = rsl.card_id
      left join review_memory_alias rma
        on rma.alias_memory_key = ${eventMemoryKeySql}
      where rsl.event_kind in ('grade', 'reset')
        and (rsl.event_kind = 'reset' or rsl.rating is not null)
        and coalesce(rsl.card_type_snapshot, c.card_type) in ('recognition', 'concept')
      order by ${effectiveMemoryKeySql} asc,
        rsl.answered_at asc,
        rsl.id asc
    `
  });

  return result.rows.map((row) => ({
    answeredAt: String(row.answeredAt),
    cardType: String(row.cardType),
    elapsedDays:
      typeof row.elapsedDays === "number"
        ? row.elapsedDays
        : row.elapsedDays == null
          ? null
          : Number(row.elapsedDays),
    eventKind: String(row.eventKind),
    id: String(row.id),
    newState: row.newState == null ? null : String(row.newState),
    previousState: row.previousState == null ? null : String(row.previousState),
    rating: row.rating == null ? null : String(row.rating),
    studyDay: row.studyDay == null ? null : String(row.studyDay),
    studyDayPolicy:
      row.studyDayPolicy == null ? null : String(row.studyDayPolicy),
    subjectKey: String(row.subjectKey)
  }));
}

function mapRatingToBindingValue(rating: string | null) {
  switch (rating) {
    case "again":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    default:
      return null;
  }
}

function compareOptimizerLogRows(
  left: FsrsOptimizerLogRow,
  right: FsrsOptimizerLogRow
) {
  return (
    left.subjectKey.localeCompare(right.subjectKey) ||
    left.answeredAt.localeCompare(right.answeredAt) ||
    left.id.localeCompare(right.id)
  );
}

function normalizeElapsedDays(value: number | null) {
  if (!Number.isFinite(value) || value === null) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function calculateElapsedDaysBetweenReviews(
  previous: FsrsTrainingReviewWithTimestamp,
  current: FsrsOptimizerLogRow
) {
  if (
    previous.studyDay &&
    current.studyDay &&
    previous.studyDayPolicy === (current.studyDayPolicy ?? null)
  ) {
    try {
      return Math.max(
        0,
        differenceInReviewStudyDayKeys(previous.studyDay, current.studyDay)
      );
    } catch {
      // Prefer the immutable event delta below when persisted keys are invalid.
    }
  }

  if (Number.isFinite(current.elapsedDays) && current.elapsedDays !== null) {
    return normalizeElapsedDays(current.elapsedDays);
  }

  try {
    // Legacy events may not have either a study-day key or a persisted delta.
    return Math.max(
      0,
      differenceInReviewStudyDays(previous.answeredAt, current.answeredAt)
    );
  } catch {
    return 0;
  }
}
