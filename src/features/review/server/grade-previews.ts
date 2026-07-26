import type { DatabaseClient } from "@/db";
import type { ReviewRecallTask } from "@/domain/review";
import {
  buildReviewSchedulerRuntimeConfig,
  formatScheduledReviewPreview,
  type ReviewGradePreview,
  type ReviewSeedState
} from "@/features/review/model/grade-previews";
import {
  reviewRatingValues,
  type ReviewRating
} from "@/features/review/model/scheduler";
import { scheduleReviewRatingsWithDailyIntervalPolicy } from "@/features/review/server/interval-policy";

export async function buildServerReviewGradePreviews(input: {
  database: Pick<DatabaseClient, "select">;
  excludeSubjectKey?: string | null;
  now: Date;
  recallTask?: ReviewRecallTask | null;
  reviewSeedState: ReviewSeedState;
}): Promise<ReviewGradePreview[]> {
  const schedules = await scheduleReviewRatingsWithDailyIntervalPolicy({
    current: {
      difficulty: input.reviewSeedState.difficulty,
      dueAt: input.reviewSeedState.dueAt,
      lapses: input.reviewSeedState.lapses,
      lastReviewedAt: input.reviewSeedState.lastReviewedAt,
      learningSteps: input.reviewSeedState.learningSteps,
      reps: input.reviewSeedState.reps,
      scheduledDays: input.reviewSeedState.scheduledDays,
      stability: input.reviewSeedState.stability,
      state: input.reviewSeedState.state
    },
    database: input.database,
    excludeSubjectKey: input.excludeSubjectKey,
    intervalPolicy: {
      schedulingKey: input.reviewSeedState.schedulingKey
    },
    now: input.now,
    recallTask: input.recallTask,
    ratings: reviewRatingValues,
    scheduler: buildReviewSchedulerRuntimeConfig(input.reviewSeedState)
  });

  return reviewRatingValues.map((rating) =>
    buildGradePreview(rating, schedules.get(rating)!.dueAt, input.now)
  );
}

function buildGradePreview(
  rating: ReviewRating,
  dueAt: string,
  now: Date
): ReviewGradePreview {
  return {
    nextReviewLabel: formatScheduledReviewPreview(dueAt, now),
    rating
  };
}
