import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card
} from "ts-fsrs";

import type {
  reviewRatingValues,
  reviewSchedulerVersionValues,
  reviewStateValues
} from "@/db";

export type ReviewRating = (typeof reviewRatingValues)[number];
export type ReviewSchedulerVersion =
  (typeof reviewSchedulerVersionValues)[number];
export type ReviewState = (typeof reviewStateValues)[number];

const DAY = 24 * 60 * 60_000;
const MINIMUM_STABILITY = 0.1;

export const reviewSchedulerConfig = {
  defaultDailyLimit: 20,
  difficulty: {
    default: 5,
    min: 1,
    max: 10
  },
  fsrs: generatorParameters({
    enable_fuzz: false,
    request_retention: 0.9
  })
} as const;

const reviewScheduler = fsrs(reviewSchedulerConfig.fsrs);

type ScheduleReviewInput = {
  current: {
    difficulty: number | null;
    dueAt: string | null;
    lapses: number;
    lastReviewedAt: string | null;
    learningSteps?: number | null;
    reps: number;
    scheduledDays?: number | null;
    schedulerVersion?: ReviewSchedulerVersion | null;
    stability: number | null;
    state: ReviewState | null;
  };
  now: Date;
  rating: ReviewRating;
};

type SchedulableReviewState = Exclude<ReviewState, "known_manual" | "suspended">;

export type ScheduleReviewResult = {
  difficulty: number;
  dueAt: string;
  elapsedDays: number | null;
  lapses: number;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  schedulerVersion: "fsrs_v1";
  stability: number;
  state: SchedulableReviewState;
};

export function scheduleReview(
  input: ScheduleReviewInput
): ScheduleReviewResult {
  const card = buildFsrsCard(input.current, input.now);
  const result = reviewScheduler.next(card, input.now, mapReviewRating(input.rating));

  return {
    difficulty: roundTo(result.card.difficulty, 3),
    dueAt: result.card.due.toISOString(),
    elapsedDays: Number.isFinite(result.log.elapsed_days)
      ? result.log.elapsed_days
      : calculateElapsedDays(input.current.lastReviewedAt, input.now.toISOString()),
    lapses: result.card.lapses,
    learningSteps: result.card.learning_steps,
    reps: result.card.reps,
    scheduledDays: result.card.scheduled_days,
    schedulerVersion: "fsrs_v1",
    stability: roundTo(result.card.stability, 3),
    state: mapFsrsState(result.card.state)
  };
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

function buildFsrsCard(
  current: ScheduleReviewInput["current"],
  now: Date
): Card {
  const normalizedState = normalizeSchedulableState(current.state);
  const schedulerVersion = current.schedulerVersion ?? "legacy_simple";

  if (normalizedState === "new") {
    return createEmptyCard(now);
  }

  const elapsedDays = calculateElapsedDays(
    current.lastReviewedAt,
    now.toISOString()
  );
  const scheduledDays =
    schedulerVersion === "fsrs_v1"
      ? normalizeCount(current.scheduledDays)
      : normalizeCount(deriveScheduledDays(current));
  const learningSteps =
    schedulerVersion === "fsrs_v1" ? normalizeCount(current.learningSteps) : 0;

  return {
    difficulty: clampDifficulty(
      current.difficulty ?? reviewSchedulerConfig.difficulty.default
    ),
    due: current.dueAt ? new Date(current.dueAt) : now,
    elapsed_days: Math.max(0, Math.round(elapsedDays ?? 0)),
    lapses: normalizeCount(current.lapses),
    learning_steps: learningSteps,
    reps: normalizeCount(current.reps),
    scheduled_days: scheduledDays,
    stability: normalizeStability(current.stability, scheduledDays),
    state: mapReviewStateToFsrs(normalizedState),
    last_review: current.lastReviewedAt
      ? new Date(current.lastReviewedAt)
      : undefined
  };
}

function deriveScheduledDays(current: ScheduleReviewInput["current"]) {
  if (current.lastReviewedAt && current.dueAt) {
    const scheduledMs =
      new Date(current.dueAt).getTime() -
      new Date(current.lastReviewedAt).getTime();

    if (Number.isFinite(scheduledMs) && scheduledMs > 0) {
      return Math.max(0, Math.round(scheduledMs / DAY));
    }
  }

  if (current.stability && Number.isFinite(current.stability)) {
    return Math.max(0, Math.round(current.stability));
  }

  return 0;
}

function normalizeCount(value: number | null | undefined, fallback = 0) {
  return Math.max(0, Math.round(value ?? fallback));
}

function normalizeStability(value: number | null, scheduledDays: number) {
  const resolved =
    value && Number.isFinite(value)
      ? value
      : scheduledDays > 0
        ? scheduledDays
        : MINIMUM_STABILITY;

  return roundTo(Math.max(MINIMUM_STABILITY, resolved), 3);
}

function normalizeSchedulableState(value: ReviewState | null): SchedulableReviewState {
  if (value === "learning" || value === "review" || value === "relearning") {
    return value;
  }

  return "new";
}

function mapReviewStateToFsrs(value: SchedulableReviewState) {
  switch (value) {
    case "learning":
      return State.Learning;
    case "review":
      return State.Review;
    case "relearning":
      return State.Relearning;
    case "new":
    default:
      return State.New;
  }
}

function mapFsrsState(value: State): SchedulableReviewState {
  switch (value) {
    case State.Learning:
      return "learning";
    case State.Review:
      return "review";
    case State.Relearning:
      return "relearning";
    case State.New:
    default:
      return "new";
  }
}

function mapReviewRating(value: ReviewRating) {
  switch (value) {
    case "again":
      return Rating.Again;
    case "hard":
      return Rating.Hard;
    case "easy":
      return Rating.Easy;
    case "good":
    default:
      return Rating.Good;
  }
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

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
