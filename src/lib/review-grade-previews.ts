import {
  scheduleReview,
  type ReviewRating,
  type ReviewSchedulerRuntimeConfig,
  type ReviewState
} from "./review-scheduler";
import type { FsrsPresetKey } from "./fsrs-optimizer";

export type ReviewSeedState = {
  difficulty: number | null;
  dueAt: string | null;
  fsrsDesiredRetention?: number | null;
  fsrsPresetKey?: FsrsPresetKey;
  fsrsWeights?: number[] | null;
  lapses: number;
  lastReviewedAt: string | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  stability: number | null;
  state: ReviewState | null;
};

export type ReviewGradePreview = {
  nextReviewLabel: string;
  rating: ReviewRating;
};

export function buildReviewGradePreviews(
  reviewSeedState: ReviewSeedState,
  now: Date
): ReviewGradePreview[] {
  const ratings: ReviewRating[] = ["again", "hard", "good", "easy"];

  return ratings.map((rating) => {
    const scheduled = scheduleReview({
      current: {
        difficulty: reviewSeedState.difficulty,
        dueAt: reviewSeedState.dueAt,
        lapses: reviewSeedState.lapses,
        lastReviewedAt: reviewSeedState.lastReviewedAt,
        learningSteps: reviewSeedState.learningSteps,
        reps: reviewSeedState.reps,
        scheduledDays: reviewSeedState.scheduledDays,
        stability: reviewSeedState.stability,
        state: reviewSeedState.state
      },
      now,
      rating,
      scheduler: buildReviewSchedulerRuntimeConfig(reviewSeedState)
    });

    return {
      nextReviewLabel: formatScheduledReviewPreview(scheduled.dueAt, now),
      rating
    };
  });
}

function formatScheduledReviewPreview(dueAt: string, now: Date) {
  const dueDate = new Date(dueAt);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (!Number.isFinite(diffMs) || diffMinutes <= 5) {
    return "Subito";
  }

  if (diffMinutes < 60) {
    return `Tra ${diffMinutes} min`;
  }

  if (isSameLocalDate(dueDate, now)) {
    return `Oggi alle ${formatShortTime(dueDate)}`;
  }

  if (isNextLocalDate(dueDate, now)) {
    return `Domani alle ${formatShortTime(dueDate)}`;
  }

  const dayDiff = Math.round(
    (startOfLocalDay(dueDate).getTime() - startOfLocalDay(now).getTime()) /
      86_400_000
  );

  if (dayDiff > 1 && dayDiff <= 6) {
    return `Tra ${dayDiff} giorni`;
  }

  return `Il ${dueAt.slice(0, 10)}`;
}

function buildReviewSchedulerRuntimeConfig(
  reviewSeedState: ReviewSeedState
): ReviewSchedulerRuntimeConfig {
  return {
    desiredRetention: reviewSeedState.fsrsDesiredRetention ?? undefined,
    weights: reviewSeedState.fsrsWeights ?? undefined
  };
}

const shortTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit"
});

function formatShortTime(value: Date) {
  return shortTimeFormatter.format(value);
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isNextLocalDate(left: Date, right: Date) {
  return (
    (startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()) /
      86_400_000 ===
    1
  );
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
