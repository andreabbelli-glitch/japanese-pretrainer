import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card
} from "ts-fsrs";

import type {
  KanjiClashPairResult,
  KanjiClashPairState,
  KanjiClashPairStateSnapshot,
  KanjiClashPairTransition,
  KanjiClashSchedulerRuntimeConfig,
  ScheduleKanjiClashPairResult
} from "../types.ts";

const DAY = 24 * 60 * 60_000;
const MINIMUM_STABILITY = 0.1;
const DEFAULT_DIFFICULTY = 5;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;

export const kanjiClashSchedulerConfig = {
  difficulty: {
    default: DEFAULT_DIFFICULTY,
    max: MAX_DIFFICULTY,
    min: MIN_DIFFICULTY
  },
  fsrs: generatorParameters({
    enable_fuzz: false,
    request_retention: 0.9
  }),
  schedulerVersion: "kanji_clash_fsrs_v1" as const
};

type ScheduleKanjiClashPairInput = {
  current: Pick<
    KanjiClashPairState,
    | "difficulty"
    | "dueAt"
    | "lapses"
    | "lastReviewedAt"
    | "learningSteps"
    | "reps"
    | "scheduledDays"
    | "stability"
    | "state"
  >;
  now: Date;
  result: KanjiClashPairResult;
  scheduler?: KanjiClashSchedulerRuntimeConfig;
};

const kanjiClashSchedulerCache = new Map<string, ReturnType<typeof fsrs>>();

export function createInitialKanjiClashPairState(input: {
  leftSubjectKey: string;
  now: Date | string;
  pairKey: string;
  rightSubjectKey: string;
}): KanjiClashPairState {
  const nowIso = toIsoString(input.now);

  return {
    createdAt: nowIso,
    difficulty: null,
    dueAt: null,
    lapses: 0,
    lastInteractionAt: nowIso,
    lastReviewedAt: null,
    learningSteps: 0,
    leftSubjectKey: input.leftSubjectKey,
    pairKey: input.pairKey,
    reps: 0,
    rightSubjectKey: input.rightSubjectKey,
    scheduledDays: 0,
    schedulerVersion: kanjiClashSchedulerConfig.schedulerVersion,
    stability: null,
    state: "new",
    updatedAt: nowIso
  };
}

export function snapshotKanjiClashPairState(
  state: KanjiClashPairState
): KanjiClashPairStateSnapshot {
  return {
    difficulty: state.difficulty,
    dueAt: state.dueAt,
    lapses: state.lapses,
    lastInteractionAt: state.lastInteractionAt,
    lastReviewedAt: state.lastReviewedAt,
    learningSteps: state.learningSteps,
    leftSubjectKey: state.leftSubjectKey,
    pairKey: state.pairKey,
    reps: state.reps,
    rightSubjectKey: state.rightSubjectKey,
    scheduledDays: state.scheduledDays,
    schedulerVersion: state.schedulerVersion,
    stability: state.stability,
    state: state.state
  };
}

export function scheduleKanjiClashPair(
  input: ScheduleKanjiClashPairInput
): ScheduleKanjiClashPairResult {
  const card = buildFsrsCard(input.current, input.now);
  const result = getKanjiClashScheduler(input.scheduler).next(
    card,
    input.now,
    mapKanjiClashResult(input.result)
  );

  clampInternalCardDueDate(result.card);

  return {
    difficulty: roundTo(result.card.difficulty, 3),
    dueAt: result.card.due.toISOString(),
    elapsedDays: Number.isFinite(result.log.elapsed_days)
      ? result.log.elapsed_days
      : calculateKanjiClashElapsedDays(input.current.lastReviewedAt, input.now),
    lapses: result.card.lapses,
    learningSteps: result.card.learning_steps,
    reps: result.card.reps,
    scheduledDays: result.card.scheduled_days,
    schedulerVersion: kanjiClashSchedulerConfig.schedulerVersion,
    stability: roundTo(result.card.stability, 3),
    state: mapFsrsState(result.card.state)
  };
}

export function transitionKanjiClashPairState(input: {
  current: KanjiClashPairState;
  now: Date | string;
  result: KanjiClashPairResult;
  scheduler?: KanjiClashSchedulerRuntimeConfig;
}): KanjiClashPairTransition {
  const now = toDate(input.now);
  const nowIso = now.toISOString();
  const previous = snapshotKanjiClashPairState(input.current);
  const scheduled = scheduleKanjiClashPair({
    current: input.current,
    now,
    result: input.result,
    scheduler: input.scheduler
  });

  return {
    next: {
      ...input.current,
      difficulty: scheduled.difficulty,
      dueAt: scheduled.dueAt,
      lapses: scheduled.lapses,
      lastInteractionAt: nowIso,
      lastReviewedAt: nowIso,
      learningSteps: scheduled.learningSteps,
      reps: scheduled.reps,
      scheduledDays: scheduled.scheduledDays,
      schedulerVersion: scheduled.schedulerVersion,
      stability: scheduled.stability,
      state: scheduled.state,
      updatedAt: nowIso
    },
    previous,
    scheduled
  };
}

export function calculateKanjiClashElapsedDays(
  lastReviewedAt: string | Date | null,
  now: string | Date
) {
  if (!lastReviewedAt) {
    return null;
  }

  const startMs = toDate(lastReviewedAt).getTime();
  const endMs = toDate(now).getTime();
  const elapsedMs = endMs - startMs;

  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }

  return roundTo(elapsedMs / DAY, 3);
}

function buildFsrsCard(
  current: ScheduleKanjiClashPairInput["current"],
  now: Date
): Card {
  if (current.state === "new") {
    return createEmptyCard(now);
  }

  const elapsedDays = calculateKanjiClashElapsedDays(
    current.lastReviewedAt,
    now
  );
  const scheduledDays = normalizeCount(current.scheduledDays);
  const learningSteps = normalizeCount(current.learningSteps);

  return {
    difficulty: clampDifficulty(
      current.difficulty ?? kanjiClashSchedulerConfig.difficulty.default
    ),
    due: current.dueAt ? new Date(current.dueAt) : now,
    elapsed_days: Math.max(0, Math.round(elapsedDays ?? 0)),
    lapses: normalizeCount(current.lapses),
    learning_steps: learningSteps,
    reps: normalizeCount(current.reps),
    scheduled_days: scheduledDays,
    stability: normalizeStability(current.stability, scheduledDays),
    state: mapPairStateToFsrs(current.state),
    last_review: current.lastReviewedAt
      ? new Date(current.lastReviewedAt)
      : undefined
  };
}

function getKanjiClashScheduler(config?: KanjiClashSchedulerRuntimeConfig) {
  const normalizedConfig = normalizeRuntimeConfig(config);
  const cacheKey = JSON.stringify(normalizedConfig);
  const cached = kanjiClashSchedulerCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const scheduler = fsrs(
    generatorParameters({
      ...kanjiClashSchedulerConfig.fsrs,
      request_retention: normalizedConfig.desiredRetention,
      ...(normalizedConfig.weights ? { w: normalizedConfig.weights } : {})
    })
  );

  kanjiClashSchedulerCache.set(cacheKey, scheduler);

  return scheduler;
}

function normalizeRuntimeConfig(config?: KanjiClashSchedulerRuntimeConfig) {
  return {
    desiredRetention: normalizeDesiredRetention(config?.desiredRetention),
    weights: normalizeWeights(config?.weights)
  };
}

function normalizeDesiredRetention(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return kanjiClashSchedulerConfig.fsrs.request_retention;
  }

  return Math.min(0.99, Math.max(0.7, roundTo(value!, 3)));
}

function normalizeWeights(value: number[] | null | undefined) {
  if (
    !Array.isArray(value) ||
    value.length !== kanjiClashSchedulerConfig.fsrs.w.length
  ) {
    return null;
  }

  return value.every((item) => Number.isFinite(item)) ? [...value] : null;
}

function mapKanjiClashResult(value: KanjiClashPairResult) {
  return value === "again" ? Rating.Again : Rating.Good;
}

function mapPairStateToFsrs(value: KanjiClashPairState["state"]) {
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

function mapFsrsState(value: State): KanjiClashPairState["state"] {
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

function clampDifficulty(value: number) {
  return roundTo(Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, value)), 3);
}

function clampInternalCardDueDate(card: Pick<Card, "due" | "scheduled_days">) {
  if (card.scheduled_days >= 1) {
    card.due = new Date(
      Date.UTC(
        card.due.getUTCFullYear(),
        card.due.getUTCMonth(),
        card.due.getUTCDate()
      )
    );
  }
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function toIsoString(value: string | Date) {
  return toDate(value).toISOString();
}
