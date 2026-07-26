import type { DatabaseClient } from "@/db";
import { listReviewSubjectDueCountsInRange } from "@/db/queries";
import type { ReviewRecallTask } from "@/domain/review";
import {
  canLoadBalanceReviewInterval,
  DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS,
  getReviewFuzzBounds
} from "@/features/review/model/interval-policy";
import {
  applyReviewIntervalPolicyToSchedule,
  getReviewIntervalPolicyBaseInterval,
  getReviewIntervalPolicyMinimum,
  scheduleReviewBase,
  type ReviewRating,
  type ScheduleReviewInput,
  type ScheduleReviewResult
} from "@/features/review/model/scheduler";
import {
  differenceInReviewStudyDays,
  normalizeReviewDueAt
} from "@/features/review/model/study-day";

type ReviewDueCountReader = Pick<DatabaseClient, "select">;

export async function scheduleReviewWithDailyIntervalPolicy(
  input: ScheduleReviewInput & {
    database: ReviewDueCountReader;
    excludeSubjectKey?: string | null;
    recallTask?: ReviewRecallTask | null;
  }
) {
  const results = await scheduleReviewRatingsWithDailyIntervalPolicy({
    ...input,
    ratings: [input.rating]
  });

  return results.get(input.rating)!;
}

/**
 * Produces all requested grade outcomes with at most one bounded aggregate
 * query. This is used for server-rendered button previews as well as grading.
 */
export async function scheduleReviewRatingsWithDailyIntervalPolicy(
  input: Omit<ScheduleReviewInput, "rating"> & {
    database: ReviewDueCountReader;
    excludeSubjectKey?: string | null;
    recallTask?: ReviewRecallTask | null;
    ratings: readonly ReviewRating[];
  }
): Promise<Map<ReviewRating, ScheduleReviewResult>> {
  const baseSchedules = new Map<ReviewRating, ScheduleReviewResult>();

  for (const rating of input.ratings) {
    baseSchedules.set(
      rating,
      scheduleReviewBase({
        current: input.current,
        intervalPolicy: input.intervalPolicy,
        now: input.now,
        rating,
        scheduler: input.scheduler
      })
    );
  }

  const dueCountsByInterval = await loadReviewDueCountsForSchedules({
    baseSchedules: [...baseSchedules].map(([rating, scheduled]) => ({
      minimumInterval: getReviewIntervalPolicyMinimum(scheduled, {
        current: input.current,
        intervalPolicy: input.intervalPolicy,
        now: input.now,
        rating,
        scheduler: input.scheduler
      }),
      scheduled
    })),
    database: input.database,
    excludeSubjectKey: input.excludeSubjectKey,
    loadBalancingEnabled:
      input.intervalPolicy?.enabled !== false &&
      input.intervalPolicy?.loadBalancingEnabled !== false,
    maximumInterval: input.scheduler?.maximumInterval,
    recallTask: input.recallTask,
    reviewedAt: input.now
  });
  const scheduledByRating = new Map<ReviewRating, ScheduleReviewResult>();

  for (const [rating, scheduled] of baseSchedules) {
    if (input.intervalPolicy?.enabled === false) {
      scheduledByRating.set(rating, scheduled);
      continue;
    }

    scheduledByRating.set(
      rating,
      applyReviewIntervalPolicyToSchedule(scheduled, {
        current: input.current,
        intervalPolicy: {
          ...input.intervalPolicy,
          dueCountsByInterval
        },
        now: input.now,
        rating,
        scheduler: input.scheduler
      })
    );
  }

  return scheduledByRating;
}

async function loadReviewDueCountsForSchedules(input: {
  baseSchedules: readonly {
    minimumInterval: number;
    scheduled: ScheduleReviewResult;
  }[];
  database: ReviewDueCountReader;
  excludeSubjectKey?: string | null;
  loadBalancingEnabled: boolean;
  maximumInterval?: number | null;
  recallTask?: ReviewRecallTask | null;
  reviewedAt: Date;
}) {
  const maximumInterval = normalizeMaximumInterval(input.maximumInterval);
  const windows = input.loadBalancingEnabled
    ? input.baseSchedules.flatMap(({ minimumInterval, scheduled }) => {
        const baseInterval = getReviewIntervalPolicyBaseInterval(scheduled);

        if (
          scheduled.scheduledDays < 1 ||
          !canLoadBalanceReviewInterval(baseInterval, minimumInterval)
        ) {
          return [];
        }

        return [
          getReviewFuzzBounds(baseInterval, minimumInterval, maximumInterval)
        ];
      })
    : [];

  if (windows.length === 0) {
    return null;
  }

  const lower = Math.min(...windows.map((window) => window.lower));
  const upper = Math.max(...windows.map((window) => window.upper));
  const startInclusiveIso = buildDailyDueBoundary(input.reviewedAt, lower);
  const endExclusiveIso = buildDailyDueBoundary(input.reviewedAt, upper + 1);
  const rows = await listReviewSubjectDueCountsInRange(input.database, {
    endExclusiveIso,
    excludeSubjectKey: input.excludeSubjectKey,
    recallTask: input.recallTask,
    startInclusiveIso
  });
  const countsByInterval = new Map<number, number>();

  for (const row of rows) {
    const interval = differenceInReviewStudyDays(input.reviewedAt, row.dueAt);

    if (interval < lower || interval > upper) {
      continue;
    }

    countsByInterval.set(
      interval,
      (countsByInterval.get(interval) ?? 0) + row.count
    );
  }

  return countsByInterval;
}

function buildDailyDueBoundary(reviewedAt: Date, scheduledDays: number) {
  return normalizeReviewDueAt({
    dueAt: reviewedAt,
    reviewedAt,
    scheduledDays
  }).toISOString();
}

function normalizeMaximumInterval(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS;
  }

  return Math.min(
    DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS,
    Math.max(1, Math.round(value!))
  );
}
