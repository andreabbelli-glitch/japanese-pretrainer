import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card
} from "ts-fsrs";

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
export type ReviewSchedulerVersion = "fsrs_v1";
export type ReviewSchedulerRuntimeConfig = {
  desiredRetention?: number | null;
  weights?: number[] | null;
};

const DAY = 24 * 60 * 60_000;
const MAX_DAILY_INTERVAL_TRUNCATION_MS = DAY / 2;
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
  schedulerVersion: "fsrs_v1";
  stability: number;
  state: SchedulableReviewState;
};

export type ReviewLogReplayInput = {
  answeredAt: string;
  cardType?: string | null;
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

export type ReplayReviewHistoryOptions = {
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
  const card = buildFsrsCard(input.current, input.now);
  const result = getReviewScheduler(input.scheduler).next(
    card,
    input.now,
    mapReviewRating(input.rating)
  );

  clampInternalCardDueDate(result.card, input.now);

  const elapsedDays = calculateElapsedDays(
    input.current.lastReviewedAt,
    input.now
  );

  return {
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
    schedulerVersion: "fsrs_v1",
    stability: roundTo(result.card.stability, 3),
    state: mapFsrsState(result.card.state)
  };
}

export function calculateElapsedDays(
  lastReviewedAt: string | Date | null,
  nowIso: string | Date
) {
  if (!lastReviewedAt) {
    return null;
  }

  const startMs =
    typeof lastReviewedAt === "string"
      ? new Date(lastReviewedAt).getTime()
      : lastReviewedAt.getTime();
  const endMs =
    typeof nowIso === "string" ? new Date(nowIso).getTime() : nowIso.getTime();
  const elapsedMs = endMs - startMs;

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
  return new Date(now.getTime() - elapsedDayCount * DAY);
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

  for (const [index, log] of orderedLogs.entries()) {
    const reviewAt = new Date(log.answeredAt);
    const startsFreshSession =
      index === 0 || normalizeSchedulableState(log.previousState) === "new";

    if (startsFreshSession) {
      card = createEmptyCard(reviewAt);
    }

    const lastReviewBeforeScheduling = card.last_review ?? null;
    const elapsedDays = calculateElapsedDays(
      lastReviewBeforeScheduling,
      reviewAt
    );
    const cardForScheduling = buildFsrsReplayCard(card, reviewAt, elapsedDays);
    const result = getReviewScheduler(
      resolveReplayReviewSchedulerConfig(options, log, index)
    ).next(
      cardForScheduling,
      reviewAt,
      mapReviewRating(log.rating)
    );

    clampInternalCardDueDate(result.card, reviewAt);

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

function clampInternalCardDueDate(
  card: Pick<Card, "due" | "scheduled_days">,
  reviewedAt: Date
) {
  if (card.scheduled_days >= 1) {
    const clampedDue = new Date(
      Date.UTC(
        card.due.getUTCFullYear(),
        card.due.getUTCMonth(),
        card.due.getUTCDate()
      )
    );
    const earliestDue =
      reviewedAt.getTime() +
      card.scheduled_days * DAY -
      MAX_DAILY_INTERVAL_TRUNCATION_MS;

    if (clampedDue.getTime() < earliestDue) {
      clampedDue.setUTCDate(clampedDue.getUTCDate() + 1);
    }

    card.due = clampedDue;
  }
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
    weights: normalizeWeights(config?.weights)
  };
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
