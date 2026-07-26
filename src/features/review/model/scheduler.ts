import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card
} from "ts-fsrs";

import {
  differenceInReviewStudyDays,
  normalizeReviewDueAt
} from "./study-day.ts";
import {
  applyReviewDailyIntervalPolicy,
  DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS,
  type ReviewEasyDays
} from "./interval-policy.ts";

export const reviewStateValues = [
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
  "known_manual"
] as const;
export const reviewRatingValues = ["again", "hard", "good", "easy"] as const;
export type ReviewRating = (typeof reviewRatingValues)[number];
export type ReviewState = (typeof reviewStateValues)[number];
export const CURRENT_REVIEW_SCHEDULER_VERSION = "fsrs_v2_study_day" as const;
export type ReviewSchedulerVersion =
  | "fsrs_v1"
  | typeof CURRENT_REVIEW_SCHEDULER_VERSION;
export type ReviewSchedulerRuntimeConfig = {
  desiredRetention?: number | null;
  maximumInterval?: number | null;
  weights?: number[] | null;
};

export type ReviewIntervalPolicyRuntimeConfig = {
  dueCountsByInterval?: ReadonlyMap<number, number> | null;
  easyDays?: ReviewEasyDays;
  enabled?: boolean;
  loadBalancingEnabled?: boolean;
  minimumInterval?: number;
  schedulingKey?: string | null;
};

const MINIMUM_STABILITY = 0.1;
const unroundedIntervalBySchedule = new WeakMap<ScheduleReviewResult, number>();

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

export type ScheduleReviewInput = {
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
  intervalPolicy?: ReviewIntervalPolicyRuntimeConfig;
  now: Date;
  rating: ReviewRating;
  scheduler?: ReviewSchedulerRuntimeConfig;
};

type SchedulableReviewState = Exclude<
  ReviewState,
  "known_manual" | "suspended"
>;

export type ScheduleReviewResult = {
  difficulty: number;
  dueAt: string;
  elapsedDays: number | null;
  lapses: number;
  learningSteps: number;
  reps: number;
  scheduledDays: number;
  schedulerVersion: typeof CURRENT_REVIEW_SCHEDULER_VERSION;
  stability: number;
  state: SchedulableReviewState;
};

export type ReviewLogReplayInput = {
  answeredAt: string;
  cardType?: string | null;
  /** Persisted logical-day distance; preferred over recalculating wall time. */
  elapsedDays?: number | null;
  id: string;
  previousState: ReviewState | null;
  rating: ReviewRating;
  responseMs: number | null;
  schedulingKey?: string | null;
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
  schedulerVersion: typeof CURRENT_REVIEW_SCHEDULER_VERSION;
};

export type ReplayedReviewHistory = {
  finalIntervalPolicy: ReplayedReviewIntervalPolicy | null;
  logs: ReplayedReviewLog[];
  state: Omit<ScheduleReviewResult, "elapsedDays"> & {
    dueAt: string;
    lastReviewedAt: string;
  };
};

export type ReplayedReviewIntervalPolicy = {
  baseInterval: number;
  maximumInterval: number;
  minimumInterval: number;
  rating: ReviewRating;
  reps: number;
  reviewedAt: string;
  schedulingKey: string;
};

export type ReplayReviewHistoryOptions = {
  /** Stable memory/subject key shared by every physical-card log. */
  schedulingKey?: string | null;
  scheduler?:
    | ReviewSchedulerRuntimeConfig
    | ((
        log: ReviewLogReplayInput,
        index: number
      ) => ReviewSchedulerRuntimeConfig | null | undefined);
};

export function scheduleReview(
  input: ScheduleReviewInput
): ScheduleReviewResult {
  const scheduled = scheduleReviewBase(input);

  if (input.intervalPolicy?.enabled === false || scheduled.scheduledDays < 1) {
    return scheduled;
  }

  return applyReviewIntervalPolicyToSchedule(scheduled, input);
}

/**
 * Returns the unfuzzed FSRS result. Server scheduling uses this once to derive
 * a bounded due-count query before applying the app-layer interval policy.
 */
export function scheduleReviewBase(
  input: ScheduleReviewInput
): ScheduleReviewResult {
  const card = buildFsrsCard(input.current, input.now);
  const scheduler = getReviewScheduler(input.scheduler);
  const result = scheduler.next(card, input.now, mapReviewRating(input.rating));

  normalizeInternalCardDueDate(result.card, input.now);

  const elapsedDays = calculateElapsedDays(
    input.current.lastReviewedAt,
    input.now
  );

  const scheduled: ScheduleReviewResult = {
    difficulty: roundTo(result.card.difficulty, 3),
    dueAt: result.card.due.toISOString(),
    elapsedDays:
      elapsedDays ??
      (Number.isFinite(result.log.elapsed_days)
        ? result.log.elapsed_days
        : null),
    lapses: result.card.lapses,
    learningSteps: result.card.learning_steps,
    reps: result.card.reps,
    scheduledDays: result.card.scheduled_days,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
    stability: roundTo(result.card.stability, 3),
    state: mapFsrsState(result.card.state)
  };

  rememberUnroundedFsrsInterval(
    scheduled,
    result.card,
    scheduler,
    input.current.state === "review"
  );
  return scheduled;
}

export function applyReviewIntervalPolicyToSchedule(
  scheduled: ScheduleReviewResult,
  input: ScheduleReviewInput
): ScheduleReviewResult {
  if (scheduled.scheduledDays < 1) {
    return scheduled;
  }

  const { selected } = resolveReviewIntervalPolicySelection(scheduled, input);
  const dueAt = normalizeReviewDueAt({
    dueAt: scheduled.dueAt,
    reviewedAt: input.now,
    scheduledDays: selected.interval
  }).toISOString();

  return {
    ...scheduled,
    dueAt,
    scheduledDays: selected.interval
  };
}

export function resolveReviewIntervalPolicySelection(
  scheduled: ScheduleReviewResult,
  input: ScheduleReviewInput
) {
  const maximumInterval = normalizeMaximumInterval(
    input.scheduler?.maximumInterval
  );
  const minimumInterval = getReviewIntervalPolicyMinimum(scheduled, input);

  return {
    maximumInterval,
    minimumInterval,
    selected: selectReviewDailyInterval(
      scheduled,
      input,
      minimumInterval,
      maximumInterval
    )
  };
}

export function getReviewIntervalPolicyMinimum(
  scheduled: ScheduleReviewResult,
  input: ScheduleReviewInput
) {
  return (
    input.intervalPolicy?.minimumInterval ??
    resolveReviewIntervalMinimum(input, scheduled)
  );
}

export function getReviewIntervalPolicyBaseInterval(
  scheduled: ScheduleReviewResult
) {
  return unroundedIntervalBySchedule.get(scheduled) ?? scheduled.scheduledDays;
}

export function calculateElapsedDays(
  lastReviewedAt: string | Date | null,
  nowIso: string | Date
) {
  if (!lastReviewedAt) {
    return null;
  }

  try {
    return Math.max(0, differenceInReviewStudyDays(lastReviewedAt, nowIso));
  } catch {
    return 0;
  }
}

function buildFsrsCard(
  current: ScheduleReviewInput["current"],
  now: Date
): Card {
  const normalizedState = normalizeSchedulableState(current.state);

  if (normalizedState === "new") {
    return createEmptyCard(now);
  }

  const elapsedDays = calculateElapsedDays(current.lastReviewedAt, now);
  const elapsedDayCount = Math.max(0, Math.round(elapsedDays ?? 0));
  const scheduledDays = normalizeCount(current.scheduledDays);
  const learningSteps = normalizeCount(current.learningSteps);

  return {
    difficulty: clampDifficulty(
      current.difficulty ?? reviewSchedulerConfig.difficulty.default
    ),
    due: current.dueAt ? new Date(current.dueAt) : now,
    elapsed_days: elapsedDayCount,
    lapses: normalizeCount(current.lapses),
    learning_steps: learningSteps,
    reps: normalizeCount(current.reps),
    scheduled_days: scheduledDays,
    stability: normalizeStability(current.stability, scheduledDays),
    state: mapReviewStateToFsrs(normalizedState),
    last_review: current.lastReviewedAt
      ? buildFsrsElapsedDayAnchor(now, elapsedDayCount)
      : undefined
  };
}

function buildFsrsElapsedDayAnchor(now: Date, elapsedDayCount: number) {
  const anchor = new Date(now);

  anchor.setUTCDate(anchor.getUTCDate() - elapsedDayCount);
  return anchor;
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

function normalizeSchedulableState(
  value: ReviewState | null
): SchedulableReviewState {
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
  logs: readonly ReviewLogReplayInput[],
  options: ReplayReviewHistoryOptions = {}
): ReplayedReviewHistory | null {
  if (logs.length === 0) {
    return null;
  }

  const orderedLogs = [...logs].sort((left, right) => {
    const answeredAtComparison =
      new Date(left.answeredAt).getTime() -
      new Date(right.answeredAt).getTime();

    if (answeredAtComparison !== 0) {
      return answeredAtComparison;
    }

    return left.id.localeCompare(right.id);
  });

  let card = createEmptyCard(new Date(orderedLogs[0]!.answeredAt));
  const replayedLogs: ReplayedReviewLog[] = [];
  let finalIntervalPolicy: ReplayedReviewIntervalPolicy | null = null;

  for (const [index, log] of orderedLogs.entries()) {
    const reviewAt = new Date(log.answeredAt);
    const startsFreshSession =
      index === 0 || normalizeSchedulableState(log.previousState) === "new";

    if (startsFreshSession) {
      card = createEmptyCard(reviewAt);
    }

    const lastReviewBeforeScheduling = card.last_review ?? null;
    const elapsedDays = resolveReplayElapsedDays(
      log.elapsedDays,
      lastReviewBeforeScheduling,
      reviewAt
    );
    const cardForScheduling = buildFsrsReplayCard(card, reviewAt, elapsedDays);
    const schedulerConfig = resolveReplayReviewSchedulerConfig(
      options,
      log,
      index
    );
    const scheduler = getReviewScheduler(schedulerConfig);
    const result = scheduler.next(
      cardForScheduling,
      reviewAt,
      mapReviewRating(log.rating)
    );

    normalizeInternalCardDueDate(result.card, reviewAt);
    finalIntervalPolicy = applyReplayDailyIntervalPolicy({
      cardBeforeScheduling: cardForScheduling,
      elapsedDays,
      log,
      resultCard: result.card,
      reviewAt,
      schedulingKey: options.schedulingKey,
      scheduler: schedulerConfig,
      unroundedScheduledDays:
        cardForScheduling.state === State.Review
          ? resolveUnroundedFsrsInterval(result.card, scheduler)
          : null
    });

    replayedLogs.push({
      answeredAt: log.answeredAt,
      elapsedDays:
        elapsedDays ??
        (Number.isFinite(result.log.elapsed_days)
          ? result.log.elapsed_days
          : 0),
      id: log.id,
      newState: mapFsrsState(result.card.state),
      previousState: mapFsrsState(result.log.state),
      rating: log.rating,
      responseMs: log.responseMs,
      scheduledDueAt: result.card.due.toISOString(),
      schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION
    });

    card = result.card;
  }

  const lastLog = orderedLogs.at(-1)!;

  return {
    finalIntervalPolicy,
    logs: replayedLogs,
    state: {
      difficulty: roundTo(card.difficulty, 3),
      dueAt: card.due.toISOString(),
      lapses: card.lapses,
      learningSteps: card.learning_steps,
      lastReviewedAt: lastLog.answeredAt,
      reps: card.reps,
      scheduledDays: card.scheduled_days,
      schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
      stability: roundTo(card.stability, 3),
      state: mapFsrsState(card.state)
    }
  };
}

function resolveReplayElapsedDays(
  persistedElapsedDays: number | null | undefined,
  lastReviewedAt: Date | null,
  reviewAt: Date
) {
  if (
    persistedElapsedDays !== null &&
    persistedElapsedDays !== undefined &&
    Number.isFinite(persistedElapsedDays)
  ) {
    return Math.max(0, Math.round(persistedElapsedDays));
  }

  return calculateElapsedDays(lastReviewedAt, reviewAt);
}

function buildFsrsReplayCard(
  card: Card,
  reviewAt: Date,
  elapsedDays: number | null
): Card {
  if (card.state === State.New || !card.last_review) {
    return card;
  }

  const elapsedDayCount = Math.max(0, Math.round(elapsedDays ?? 0));

  return {
    ...card,
    elapsed_days: elapsedDayCount,
    last_review: buildFsrsElapsedDayAnchor(reviewAt, elapsedDayCount)
  };
}

function resolveReplayReviewSchedulerConfig(
  options: ReplayReviewHistoryOptions,
  log: ReviewLogReplayInput,
  index: number
) {
  if (typeof options.scheduler === "function") {
    return options.scheduler(log, index) ?? undefined;
  }

  return options.scheduler;
}

function applyReplayDailyIntervalPolicy(input: {
  cardBeforeScheduling: Card;
  elapsedDays: number | null;
  log: ReviewLogReplayInput;
  resultCard: Card;
  reviewAt: Date;
  schedulingKey?: string | null;
  scheduler?: ReviewSchedulerRuntimeConfig | null;
  unroundedScheduledDays: number | null;
}) {
  if (input.resultCard.scheduled_days < 1) {
    return null;
  }

  const schedulingKey =
    input.schedulingKey?.trim() ||
    input.log.schedulingKey?.trim() ||
    input.log.id;
  const replayScheduleInput: ScheduleReviewInput = {
    current: {
      difficulty: input.cardBeforeScheduling.difficulty,
      dueAt: input.cardBeforeScheduling.due.toISOString(),
      lapses: input.cardBeforeScheduling.lapses,
      lastReviewedAt:
        input.cardBeforeScheduling.last_review?.toISOString() ?? null,
      learningSteps: input.cardBeforeScheduling.learning_steps,
      reps: input.cardBeforeScheduling.reps,
      scheduledDays: input.cardBeforeScheduling.scheduled_days,
      stability: input.cardBeforeScheduling.stability,
      state: mapFsrsState(input.cardBeforeScheduling.state)
    },
    intervalPolicy: {
      // Bulk replay deliberately avoids historical due-count queries. The
      // final interval still uses the same deterministic fuzz as live review.
      loadBalancingEnabled: false,
      schedulingKey
    },
    now: input.reviewAt,
    rating: input.log.rating,
    scheduler: input.scheduler ?? undefined
  };
  const baseSchedule: ScheduleReviewResult = {
    difficulty: roundTo(input.resultCard.difficulty, 3),
    dueAt: input.resultCard.due.toISOString(),
    elapsedDays: input.elapsedDays,
    lapses: input.resultCard.lapses,
    learningSteps: input.resultCard.learning_steps,
    reps: input.resultCard.reps,
    scheduledDays: input.resultCard.scheduled_days,
    schedulerVersion: CURRENT_REVIEW_SCHEDULER_VERSION,
    stability: roundTo(input.resultCard.stability, 3),
    state: mapFsrsState(input.resultCard.state)
  };
  if (input.unroundedScheduledDays !== null) {
    unroundedIntervalBySchedule.set(baseSchedule, input.unroundedScheduledDays);
  }
  const policy = resolveReviewIntervalPolicySelection(
    baseSchedule,
    replayScheduleInput
  );
  const scheduled = applyReviewIntervalPolicyToSchedule(
    baseSchedule,
    replayScheduleInput
  );

  input.resultCard.due = new Date(scheduled.dueAt);
  input.resultCard.scheduled_days = scheduled.scheduledDays;

  return {
    baseInterval: getReviewIntervalPolicyBaseInterval(baseSchedule),
    maximumInterval: policy.maximumInterval,
    minimumInterval: policy.minimumInterval,
    rating: input.log.rating,
    reps: input.cardBeforeScheduling.reps,
    reviewedAt: input.reviewAt.toISOString(),
    schedulingKey
  } satisfies ReplayedReviewIntervalPolicy;
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

function normalizeInternalCardDueDate(
  card: Pick<Card, "due" | "scheduled_days">,
  reviewedAt: Date
) {
  card.due = normalizeReviewDueAt({
    dueAt: card.due,
    reviewedAt,
    scheduledDays: card.scheduled_days
  });
}

const reviewSchedulerCache = new Map<string, ReturnType<typeof fsrs>>();

function getReviewScheduler(config?: ReviewSchedulerRuntimeConfig) {
  const normalizedConfig = normalizeReviewSchedulerRuntimeConfig(config);
  const cacheKey = JSON.stringify(normalizedConfig);
  const cached = reviewSchedulerCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const scheduler = fsrs(
    generatorParameters({
      ...reviewSchedulerConfig.fsrs,
      maximum_interval: normalizedConfig.maximumInterval,
      request_retention: normalizedConfig.desiredRetention,
      ...(normalizedConfig.weights ? { w: normalizedConfig.weights } : {})
    })
  );
  reviewSchedulerCache.set(cacheKey, scheduler);

  return scheduler;
}

function normalizeReviewSchedulerRuntimeConfig(
  config?: ReviewSchedulerRuntimeConfig
) {
  return {
    desiredRetention: normalizeDesiredRetention(config?.desiredRetention),
    maximumInterval: normalizeMaximumInterval(config?.maximumInterval),
    weights: normalizeWeights(config?.weights)
  };
}

function normalizeMaximumInterval(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return reviewSchedulerConfig.fsrs.maximum_interval;
  }

  return Math.min(
    DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS,
    Math.max(1, Math.round(value!))
  );
}

function resolveReviewIntervalMinimum(
  input: ScheduleReviewInput,
  scheduled: ScheduleReviewResult
) {
  const configuredMinimum = resolveGrowingReviewIntervalMinimum(
    input,
    scheduled
  );

  if (input.rating === "again" || input.rating === "hard") {
    return configuredMinimum;
  }

  const hardSchedule = scheduleReviewBase({
    ...input,
    rating: "hard"
  });
  const hardMinimum = resolveGrowingReviewIntervalMinimum(
    { ...input, rating: "hard" },
    hardSchedule
  );
  const hardInterval = selectReviewDailyInterval(
    hardSchedule,
    { ...input, rating: "hard" },
    hardMinimum,
    normalizeMaximumInterval(input.scheduler?.maximumInterval)
  ).interval;
  const goodMinimum = Math.max(
    configuredMinimum,
    hardInterval > 0 ? hardInterval + 1 : 1
  );

  if (input.rating === "good") {
    return goodMinimum;
  }

  const goodSchedule = scheduleReviewBase({
    ...input,
    rating: "good"
  });
  const goodInterval = selectReviewDailyInterval(
    goodSchedule,
    { ...input, rating: "good" },
    Math.max(
      resolveGrowingReviewIntervalMinimum(
        { ...input, rating: "good" },
        goodSchedule
      ),
      hardInterval > 0 ? hardInterval + 1 : 1
    ),
    normalizeMaximumInterval(input.scheduler?.maximumInterval)
  ).interval;

  return Math.max(configuredMinimum, goodInterval > 0 ? goodInterval + 1 : 1);
}

function resolveGrowingReviewIntervalMinimum(
  input: ScheduleReviewInput,
  scheduled: ScheduleReviewResult
) {
  const previousInterval = normalizeCount(input.current.scheduledDays);

  if (
    input.current.state === "review" &&
    input.rating !== "again" &&
    scheduled.scheduledDays > previousInterval
  ) {
    return previousInterval + 1;
  }

  return 1;
}

function selectReviewDailyInterval(
  scheduled: ScheduleReviewResult,
  input: ScheduleReviewInput,
  minimumInterval: number,
  maximumInterval: number
) {
  return applyReviewDailyIntervalPolicy({
    baseInterval: getReviewIntervalPolicyBaseInterval(scheduled),
    dueCountsByInterval: input.intervalPolicy?.dueCountsByInterval,
    easyDays: input.intervalPolicy?.easyDays,
    loadBalancingEnabled: input.intervalPolicy?.loadBalancingEnabled,
    maximumInterval,
    minimumInterval,
    rating: input.rating,
    reps: input.current.reps,
    reviewedAt: input.now,
    schedulingKey:
      input.intervalPolicy?.schedulingKey?.trim() ||
      buildFallbackSchedulingKey(input)
  });
}

function rememberUnroundedFsrsInterval(
  scheduled: ScheduleReviewResult,
  card: Pick<Card, "scheduled_days" | "stability">,
  scheduler: ReturnType<typeof fsrs>,
  useUnroundedInterval: boolean
) {
  if (!useUnroundedInterval) {
    return;
  }

  const interval = resolveUnroundedFsrsInterval(card, scheduler);

  if (interval !== null) {
    unroundedIntervalBySchedule.set(scheduled, interval);
  }
}

/**
 * ts-fsrs exposes both the resulting stability and its public
 * `interval_modifier` getter. Their product is the library's review interval
 * before `next_interval()` rounds it. Anki passes that value into fuzz as an
 * f32; learning/relearning exits intentionally keep ts-fsrs' rounded interval.
 */
function resolveUnroundedFsrsInterval(
  card: Pick<Card, "scheduled_days" | "stability">,
  scheduler: ReturnType<typeof fsrs>
) {
  if (card.scheduled_days < 1) {
    return null;
  }

  const interval = Math.fround(
    Math.fround(card.stability) * Math.fround(scheduler.interval_modifier)
  );

  return Number.isFinite(interval) && interval > 0
    ? Math.max(1, interval)
    : null;
}

function buildFallbackSchedulingKey(input: ScheduleReviewInput) {
  return [
    "review",
    input.current.lastReviewedAt ?? "never",
    input.current.dueAt ?? "no-due",
    input.current.state ?? "new"
  ].join(":");
}

function normalizeDesiredRetention(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return reviewSchedulerConfig.fsrs.request_retention;
  }

  return Math.min(0.99, Math.max(0.7, roundTo(value!, 3)));
}

function normalizeWeights(
  value: number[] | readonly number[] | null | undefined
) {
  if (
    !Array.isArray(value) ||
    value.length !== reviewSchedulerConfig.fsrs.w.length
  ) {
    return null;
  }

  return value.every((item) => Number.isFinite(item)) ? [...value] : null;
}
