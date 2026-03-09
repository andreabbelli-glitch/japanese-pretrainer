import type { reviewRatingValues, reviewStateValues } from "@/db";

export type ReviewRating = (typeof reviewRatingValues)[number];
export type ReviewState = (typeof reviewStateValues)[number];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const reviewSchedulerConfig = {
  defaultDailyLimit: 20,
  difficulty: {
    default: 5,
    min: 1.3,
    max: 9
  },
  learningIntervalsMinutes: {
    again: 0,
    hard: 30,
    good: 24 * 60,
    easy: 3 * 24 * 60
  },
  reviewIntervalsDays: {
    hardMultiplier: 1.35,
    goodMultiplier: 2.2,
    easyMultiplier: 3.6,
    hardMinimum: 1,
    goodMinimum: 2,
    easyMinimum: 4,
    lapseAgainMinutes: 0
  }
} as const;

type ScheduleReviewInput = {
  current: {
    difficulty: number | null;
    dueAt: string | null;
    lapses: number;
    lastReviewedAt: string | null;
    reps: number;
    stability: number | null;
    state: ReviewState | null;
  };
  now: Date;
  rating: ReviewRating;
};

export type ScheduleReviewResult = {
  difficulty: number;
  dueAt: string;
  elapsedDays: number | null;
  lapses: number;
  reps: number;
  stability: number;
  state: Exclude<ReviewState, "known_manual" | "suspended">;
};

export function scheduleReview(
  input: ScheduleReviewInput
): ScheduleReviewResult {
  const nowIso = input.now.toISOString();
  const currentState = normalizeSchedulableState(input.current.state);
  const elapsedDays = calculateElapsedDays(input.current.lastReviewedAt, nowIso);
  const currentDifficulty = clampDifficulty(
    input.current.difficulty ?? reviewSchedulerConfig.difficulty.default
  );

  if (currentState === "review") {
    return scheduleReviewState({
      currentDifficulty,
      currentState,
      elapsedDays,
      input
    });
  }

  return scheduleLearningState({
    currentDifficulty,
    currentState,
    elapsedDays,
    input
  });
}

export function calculateElapsedDays(
  lastReviewedAt: string | null,
  nowIso: string
) {
  if (!lastReviewedAt) {
    return null;
  }

  const elapsedMs = new Date(nowIso).getTime() - new Date(lastReviewedAt).getTime();

  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }

  return roundTo(elapsedMs / DAY, 3);
}

function scheduleLearningState(input: {
  currentDifficulty: number;
  currentState: "new" | "learning" | "relearning";
  elapsedDays: number | null;
  input: ScheduleReviewInput;
}): ScheduleReviewResult {
  const { rating } = input.input;
  const difficulty = clampDifficulty(
    input.currentDifficulty +
      (rating === "again" ? 0.7 : 0) +
      (rating === "hard" ? 0.2 : 0) +
      (rating === "easy" ? -0.45 : rating === "good" ? -0.1 : 0)
  );
  const dueAt = addMinutes(
    input.input.now,
    reviewSchedulerConfig.learningIntervalsMinutes[rating]
  );
  const lapses = input.input.current.lapses + (rating === "again" ? 1 : 0);
  const reps = input.input.current.reps + 1;

  if (rating === "again" || rating === "hard") {
    const stability =
      rating === "again"
        ? 0.2
        : Math.max(input.input.current.stability ?? 0, 0.5);

    return {
      difficulty,
      dueAt,
      elapsedDays: input.elapsedDays,
      lapses,
      reps,
      stability,
      state: input.currentState === "relearning" ? "relearning" : "learning"
    };
  }

  return {
    difficulty,
    dueAt,
    elapsedDays: input.elapsedDays,
    lapses,
    reps,
    stability:
      rating === "easy"
        ? reviewSchedulerConfig.learningIntervalsMinutes.easy / (24 * 60)
        : 1,
    state: "review"
  };
}

function scheduleReviewState(input: {
  currentDifficulty: number;
  currentState: "review";
  elapsedDays: number | null;
  input: ScheduleReviewInput;
}): ScheduleReviewResult {
  const { current, now, rating } = input.input;
  const currentIntervalDays = Math.max(
    current.stability ?? 0,
    input.elapsedDays ?? 0,
    daysUntil(current.dueAt, now.toISOString()),
    1
  );
  const reps = current.reps + 1;

  if (rating === "again") {
    return {
      difficulty: clampDifficulty(input.currentDifficulty + 0.8),
      dueAt: addMinutes(now, reviewSchedulerConfig.reviewIntervalsDays.lapseAgainMinutes),
      elapsedDays: input.elapsedDays,
      lapses: current.lapses + 1,
      reps,
      stability: roundTo(Math.max(currentIntervalDays * 0.35, 0.5), 3),
      state: "relearning"
    };
  }

  const intervalDays =
    rating === "hard"
      ? Math.max(
          reviewSchedulerConfig.reviewIntervalsDays.hardMinimum,
          Math.round(currentIntervalDays * reviewSchedulerConfig.reviewIntervalsDays.hardMultiplier)
        )
      : rating === "easy"
        ? Math.max(
            reviewSchedulerConfig.reviewIntervalsDays.easyMinimum,
            Math.round(
              currentIntervalDays * reviewSchedulerConfig.reviewIntervalsDays.easyMultiplier
            )
          )
        : Math.max(
            reviewSchedulerConfig.reviewIntervalsDays.goodMinimum,
            Math.round(
              currentIntervalDays * reviewSchedulerConfig.reviewIntervalsDays.goodMultiplier
            )
          );

  return {
    difficulty: clampDifficulty(
      input.currentDifficulty +
        (rating === "hard" ? 0.15 : 0) +
        (rating === "easy" ? -0.35 : -0.1)
    ),
    dueAt: addDays(now, intervalDays),
    elapsedDays: input.elapsedDays,
    lapses: current.lapses,
    reps,
    stability: intervalDays,
    state: "review"
  };
}

function normalizeSchedulableState(
  value: ReviewState | null
): "new" | "learning" | "review" | "relearning" {
  if (value === "learning" || value === "review" || value === "relearning") {
    return value;
  }

  return "new";
}

function clampDifficulty(value: number) {
  return roundTo(
    Math.min(
      reviewSchedulerConfig.difficulty.max,
      Math.max(reviewSchedulerConfig.difficulty.min, value)
    ),
    3
  );
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * MINUTE).toISOString();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY).toISOString();
}

function daysUntil(dueAt: string | null, nowIso: string) {
  if (!dueAt) {
    return 0;
  }

  const diffMs = new Date(dueAt).getTime() - new Date(nowIso).getTime();

  if (!Number.isFinite(diffMs)) {
    return 0;
  }

  return roundTo(Math.max(diffMs / DAY, 0), 3);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
