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
  reviewStateValues
} from "../db/schema/enums.ts";

export type ReviewRating = (typeof reviewRatingValues)[number];
export type ReviewState = (typeof reviewStateValues)[number];
export type ReviewSchedulerVersion = "fsrs_v1";

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

export type ReviewLogReplayInput = {
  answeredAt: string;
  id: string;
  previousState: ReviewState | null;
  rating: ReviewRating;
  responseMs: number | null;
};

export type ReplayedReviewLog = {
  answeredAt: string;
  elapsedDays: number;
  id: string;
  newState: SchedulableReviewState;
  previousState: SchedulableReviewState;
  rating: ReviewRating;
  responseMs: number | null;
  scheduledDueAt: string;
  schedulerVersion: "fsrs_v1";
};

export type ReplayedReviewHistory = {
  logs: ReplayedReviewLog[];
  state: Omit<ScheduleReviewResult, "elapsedDays"> & {
    dueAt: string;
    lastReviewedAt: string;
  };
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

  if (normalizedState === "new") {
    return createEmptyCard(now);
  }

  const elapsedDays = calculateElapsedDays(
    current.lastReviewedAt,
    now.toISOString()
  );
  const scheduledDays = normalizeCount(current.scheduledDays);
  const learningSteps = normalizeCount(current.learningSteps);

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

export function replayReviewHistory(
  logs: readonly ReviewLogReplayInput[]
): ReplayedReviewHistory | null {
  if (logs.length === 0) {
    return null;
  }

  const orderedLogs = [...logs].sort((left, right) => {
    const answeredAtComparison =
      new Date(left.answeredAt).getTime() - new Date(right.answeredAt).getTime();

    if (answeredAtComparison !== 0) {
      return answeredAtComparison;
    }

    return left.id.localeCompare(right.id);
  });

  let card = createEmptyCard(new Date(orderedLogs[0]!.answeredAt));
  const replayedLogs: ReplayedReviewLog[] = [];

  for (const [index, log] of orderedLogs.entries()) {
    const reviewAt = new Date(log.answeredAt);
    const startsFreshSession =
      index === 0 || normalizeSchedulableState(log.previousState) === "new";

    if (startsFreshSession) {
      card = createEmptyCard(reviewAt);
    }

    const result = reviewScheduler.next(card, reviewAt, mapReviewRating(log.rating));

    replayedLogs.push({
      answeredAt: log.answeredAt,
      elapsedDays: Number.isFinite(result.log.elapsed_days)
        ? result.log.elapsed_days
        : calculateElapsedDays(card.last_review?.toISOString() ?? null, reviewAt.toISOString()) ?? 0,
      id: log.id,
      newState: mapFsrsState(result.card.state),
      previousState: mapFsrsState(result.log.state),
      rating: log.rating,
      responseMs: log.responseMs,
      scheduledDueAt: result.card.due.toISOString(),
      schedulerVersion: "fsrs_v1"
    });

    card = result.card;
  }

  const lastLog = orderedLogs.at(-1)!;

  return {
    logs: replayedLogs,
    state: {
      difficulty: roundTo(card.difficulty, 3),
      dueAt: card.due.toISOString(),
      lapses: card.lapses,
      learningSteps: card.learning_steps,
      lastReviewedAt: lastLog.answeredAt,
      reps: card.reps,
      scheduledDays: card.scheduled_days,
      schedulerVersion: "fsrs_v1",
      stability: roundTo(card.stability, 3),
      state: mapFsrsState(card.state)
    }
  };
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
