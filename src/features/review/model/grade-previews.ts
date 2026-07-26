import {
  scheduleReview,
  type ReviewRating,
  type ReviewSchedulerRuntimeConfig,
  type ReviewState
} from "@/features/review/model/scheduler";
import {
  DEFAULT_REVIEW_STUDY_DAY_POLICY,
  differenceInReviewStudyDays
} from "@/features/review/model/study-day";

export type ReviewSeedState = {
  difficulty: number | null;
  dueAt: string | null;
  fsrsDesiredRetention?: number | null;
  fsrsMaximumInterval?: number | null;
  fsrsWeights?: number[] | null;
  lapses: number;
  lastReviewedAt: string | null;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  schedulingKey?: string | null;
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
      intervalPolicy: {
        schedulingKey: reviewSeedState.schedulingKey
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

export function formatScheduledReviewPreview(dueAt: string, now: Date) {
  const dueDate = new Date(dueAt);
  const diffMs = dueDate.getTime() - now.getTime();

  if (!Number.isFinite(diffMs) || diffMs <= 5 * 60_000) {
    return "Subito";
  }

  const studyDayDiff = differenceInReviewStudyDays(now, dueDate);

  if (studyDayDiff === 0) {
    if (diffMs < 60 * 60_000) {
      return `Tra ${Math.ceil(diffMs / 60_000)} min`;
    }

    return `Oggi alle ${formatShortTime(dueDate)}`;
  }

  if (studyDayDiff === 1) {
    return `Domani alle ${formatShortTime(dueDate)}`;
  }

  if (studyDayDiff > 1 && studyDayDiff <= 6) {
    return `Tra ${studyDayDiff} giorni`;
  }

  return `Il ${formatLocalDate(dueDate)}`;
}

export function buildReviewSchedulerRuntimeConfig(
  reviewSeedState: ReviewSeedState
): ReviewSchedulerRuntimeConfig {
  return {
    desiredRetention: reviewSeedState.fsrsDesiredRetention ?? undefined,
    maximumInterval: reviewSeedState.fsrsMaximumInterval ?? undefined,
    weights: reviewSeedState.fsrsWeights ?? undefined
  };
}

const shortTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_REVIEW_STUDY_DAY_POLICY.timeZone
});

const localDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: DEFAULT_REVIEW_STUDY_DAY_POLICY.timeZone
});

function formatShortTime(value: Date) {
  return shortTimeFormatter.format(value);
}

function formatLocalDate(value: Date) {
  return localDateFormatter.format(value);
}
