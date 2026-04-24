import {
  scheduleReview,
  type ReviewRating,
  type ReviewSchedulerRuntimeConfig,
  type ReviewState
} from "./review-scheduler";

export type ReviewSeedState = {
  difficulty: number | null;
  dueAt: string | null;
  fsrsDesiredRetention?: number | null;
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

  if (!Number.isFinite(diffMs) || diffMs <= 5 * 60_000) {
    return "Subito";
  }

  if (diffMs < 60 * 60_000) {
    return `Tra ${Math.ceil(diffMs / 60_000)} min`;
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

  return `Il ${formatLocalDate(dueDate)}`;
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

const localDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function formatShortTime(value: Date) {
  return shortTimeFormatter.format(value);
}

function formatLocalDate(value: Date) {
  return localDateFormatter.format(value);
}

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isNextLocalDate(left: Date, right: Date) {
  const nextLocalDay = startOfLocalDay(right);

  nextLocalDay.setDate(nextLocalDay.getDate() + 1);

  return isSameLocalDate(left, nextLocalDay);
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
