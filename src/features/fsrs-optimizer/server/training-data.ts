import { eq, inArray, sql } from "drizzle-orm";

import { db, type DatabaseClient } from "../../../db/index.ts";
import { card, reviewSubjectLog } from "../../../db/schema/index.ts";
import { resolveFsrsPresetKey, type FsrsPresetKey } from "../model/snapshot.ts";

export type FsrsOptimizerLogRow = {
  answeredAt: string;
  cardType: string;
  elapsedDays: number | null;
  id: string;
  rating: string;
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
  subjectCount: number;
};

type FsrsTrainingDataCounter = Pick<DatabaseClient, "select">;

export function buildFsrsTrainingDataset(
  rows: FsrsOptimizerLogRow[],
  presetKey: FsrsPresetKey
): FsrsTrainingDataset {
  const reviewsBySubject = new Map<string, FsrsTrainingReview[]>();
  let reviewCount = 0;

  for (const row of rows) {
    if (resolveFsrsPresetKey(row.cardType) !== presetKey) {
      continue;
    }

    const rating = mapRatingToBindingValue(row.rating);

    if (rating === null) {
      continue;
    }

    const subjectReviews = reviewsBySubject.get(row.subjectKey) ?? [];
    const deltaT =
      subjectReviews.length === 0 ? 0 : normalizeElapsedDays(row.elapsedDays);

    subjectReviews.push({
      deltaT,
      rating
    });
    reviewsBySubject.set(row.subjectKey, subjectReviews);
    reviewCount += 1;
  }

  const items: FsrsTrainingReview[][] = [];

  for (const reviews of reviewsBySubject.values()) {
    for (let index = 1; index < reviews.length; index += 1) {
      const slice = reviews.slice(0, index + 1).map((review) => ({
        deltaT: review.deltaT,
        rating: review.rating
      }));

      if (!slice.some((review) => review.deltaT > 0)) {
        continue;
      }

      items.push(slice);
    }
  }

  return {
    itemCount: items.length,
    items,
    reviewCount,
    subjectCount: reviewsBySubject.size
  };
}

export async function countEligibleFsrsOptimizerReviews(
  database: FsrsTrainingDataCounter = db
) {
  const result = await database
    .select({
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(reviewSubjectLog)
    .innerJoin(card, eq(card.id, reviewSubjectLog.cardId))
    .where(inArray(card.cardType, ["recognition", "concept"]));

  return Number(result[0]?.count ?? 0);
}

export async function loadFsrsOptimizerLogRows(
  database: DatabaseClient
): Promise<FsrsOptimizerLogRow[]> {
  const result = await database.$client.execute({
    sql: `
      select
        rsl.id as id,
        rsl.subject_key as subjectKey,
        rsl.answered_at as answeredAt,
        rsl.rating as rating,
        rsl.elapsed_days as elapsedDays,
        c.card_type as cardType
      from review_subject_log rsl
      inner join card c on c.id = rsl.card_id
      where c.card_type in ('recognition', 'concept')
      order by rsl.subject_key asc, rsl.answered_at asc, rsl.id asc
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
    id: String(row.id),
    rating: String(row.rating),
    subjectKey: String(row.subjectKey)
  }));
}

function mapRatingToBindingValue(rating: string) {
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

function normalizeElapsedDays(value: number | null) {
  if (!Number.isFinite(value) || value === null) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}
