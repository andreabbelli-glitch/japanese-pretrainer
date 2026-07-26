import { addReviewStudyDays, getReviewStudyDay } from "./study-day.ts";

export const REVIEW_DAILY_INTERVAL_POLICY_VERSION = "anki-25.07" as const;
export const REVIEW_LOAD_BALANCE_MAX_INTERVAL_DAYS = 90;
export const DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS = 36_500;

export const reviewEasyDayValues = ["minimum", "reduced", "normal"] as const;
export type ReviewEasyDay = (typeof reviewEasyDayValues)[number];
export type ReviewEasyDays = readonly [
  ReviewEasyDay,
  ReviewEasyDay,
  ReviewEasyDay,
  ReviewEasyDay,
  ReviewEasyDay,
  ReviewEasyDay,
  ReviewEasyDay
];

/** Monday first, matching Anki's weekday indexing. */
export const DEFAULT_REVIEW_EASY_DAYS: ReviewEasyDays = [
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "normal"
];

export type ReviewDailyIntervalRating = "again" | "hard" | "good" | "easy";

export type ReviewFuzzBounds = {
  lower: number;
  upper: number;
};

export type ReviewDailyIntervalPolicyInput = {
  baseInterval: number;
  dueCountsByInterval?: ReadonlyMap<number, number> | null;
  easyDays?: ReviewEasyDays;
  loadBalancingEnabled?: boolean;
  maximumInterval?: number;
  minimumInterval?: number;
  rating: ReviewDailyIntervalRating;
  reps: number;
  reviewedAt: Date | string;
  schedulingKey: string;
};

export type ReviewDailyIntervalPolicyResult = ReviewFuzzBounds & {
  interval: number;
  loadBalanced: boolean;
};

type FuzzRange = {
  end: number;
  factor: number;
  start: number;
};

const FUZZ_RANGES: readonly FuzzRange[] = [
  { end: 7, factor: 0.15, start: 2.5 },
  { end: 20, factor: 0.1, start: 7 },
  { end: Number.POSITIVE_INFINITY, factor: 0.05, start: 20 }
];

const EASY_DAY_LOAD_MODIFIER: Record<ReviewEasyDay, number> = {
  minimum: 0.0001,
  normal: 1,
  reduced: 0.5
};

export function getReviewDailyIntervalPolicyKey() {
  return "daily-interval:v2:anki-25.07:app-fuzz-shared-rating-seed:load-balance-90:easy-days-normal";
}

/**
 * Anki 25.07's daily fuzz window, including its min/max constraints and the
 * one-day widening used when a clamped range would otherwise collapse.
 */
export function getReviewFuzzBounds(
  interval: number,
  minimum = 1,
  maximum = DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS
): ReviewFuzzBounds {
  const normalizedMaximum = normalizeMaximumInterval(maximum);
  const normalizedMinimum = Math.min(
    normalizeMinimumInterval(minimum),
    normalizedMaximum
  );
  const normalizedInterval = clamp(
    Math.fround(normalizeFiniteInterval(interval)),
    normalizedMinimum,
    normalizedMaximum
  );
  const delta = getReviewFuzzDelta(normalizedInterval);
  let lower = clamp(
    Math.round(Math.fround(normalizedInterval - delta)),
    normalizedMinimum,
    normalizedMaximum
  );
  let upper = clamp(
    Math.round(Math.fround(normalizedInterval + delta)),
    normalizedMinimum,
    normalizedMaximum
  );

  if (upper === lower && upper > 2 && upper < normalizedMaximum) {
    upper = lower + 1;
  }

  // Defensive normalization for unusual caller-provided limits.
  lower = Math.min(lower, upper);

  return { lower, upper };
}

export function getReviewFuzzDelta(interval: number) {
  const normalizedInterval = Math.fround(normalizeFiniteInterval(interval));

  if (normalizedInterval < 2.5) {
    return 0;
  }

  return FUZZ_RANGES.reduce(
    (delta, range) =>
      Math.fround(
        delta +
          Math.fround(
            Math.fround(range.factor) *
              Math.fround(
                Math.max(
                  Math.fround(
                    Math.min(normalizedInterval, Math.fround(range.end)) -
                      Math.fround(range.start)
                  ),
                  0
                )
              )
          )
      ),
    1
  );
}

export function buildReviewDailyIntervalSeed(input: {
  reps: number;
  schedulingKey: string;
}) {
  return `${input.schedulingKey.trim() || "unknown"}:reps-${Math.max(
    0,
    Math.round(input.reps)
  )}`;
}

/** Matches Anki's `interval as usize > 90 || minimum as usize > 90` gate. */
export function canLoadBalanceReviewInterval(
  baseInterval: number,
  minimumInterval = 1
) {
  return (
    Math.trunc(normalizeFiniteInterval(baseInterval)) <=
      REVIEW_LOAD_BALANCE_MAX_INTERVAL_DAYS &&
    Math.trunc(normalizeFiniteInterval(minimumInterval)) <=
      REVIEW_LOAD_BALANCE_MAX_INTERVAL_DAYS
  );
}

/**
 * Applies deterministic daily fuzz and, when counts are supplied, Anki-style
 * weighted load balancing inside exactly the same fuzz bounds.
 */
export function applyReviewDailyIntervalPolicy(
  input: ReviewDailyIntervalPolicyInput
): ReviewDailyIntervalPolicyResult {
  const maximumInterval = normalizeMaximumInterval(input.maximumInterval);
  const baseInterval = clamp(
    normalizeFiniteInterval(input.baseInterval),
    0,
    maximumInterval
  );

  // Intraday learning/relearning steps retain their exact FSRS timestamp.
  if (baseInterval < 1) {
    return {
      interval: baseInterval,
      loadBalanced: false,
      lower: baseInterval,
      upper: baseInterval
    };
  }

  const minimumInterval = Math.min(
    normalizeMinimumInterval(input.minimumInterval),
    maximumInterval
  );
  const bounds = getReviewFuzzBounds(
    baseInterval,
    minimumInterval,
    maximumInterval
  );
  const seed = buildReviewDailyIntervalSeed(input);
  const randomUnit = deterministicUnitInterval(seed);
  const canLoadBalance =
    input.loadBalancingEnabled !== false &&
    input.dueCountsByInterval != null &&
    canLoadBalanceReviewInterval(baseInterval, minimumInterval);

  if (!canLoadBalance) {
    return {
      ...bounds,
      interval: selectUniformInterval(bounds, randomUnit),
      loadBalanced: false
    };
  }

  const intervals = buildWeightedIntervals({
    bounds,
    dueCountsByInterval: input.dueCountsByInterval!,
    easyDays: input.easyDays ?? DEFAULT_REVIEW_EASY_DAYS,
    reviewedAt: input.reviewedAt
  });
  const selected = selectWeightedInterval(intervals, randomUnit);

  return {
    ...bounds,
    interval: selected ?? selectUniformInterval(bounds, randomUnit),
    loadBalanced: selected !== null
  };
}

export function deterministicUnitInterval(seed: string) {
  // FNV-1a followed by an avalanche step. It is small, browser-safe and stable
  // across runtimes; this is a reproducibility seed, not a security primitive.
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 0x1_0000_0000;
}

function buildWeightedIntervals(input: {
  bounds: ReviewFuzzBounds;
  dueCountsByInterval: ReadonlyMap<number, number>;
  easyDays: ReviewEasyDays;
  reviewedAt: Date | string;
}) {
  const candidates = Array.from(
    { length: input.bounds.upper - input.bounds.lower + 1 },
    (_, index) => {
      const interval = input.bounds.lower + index;

      return {
        count: normalizeCount(input.dueCountsByInterval.get(interval)),
        interval,
        weekday: getReviewIntervalWeekday(input.reviewedAt, interval)
      };
    }
  );
  const easyDayModifiers = calculateReviewEasyDayModifiers(
    input.easyDays,
    candidates.map((candidate) => candidate.weekday),
    candidates.map((candidate) => candidate.count)
  );

  return candidates.map((candidate, index) => ({
    interval: candidate.interval,
    weight:
      candidate.count === 0
        ? 1
        : Math.pow(1 / candidate.count, 2.15) *
          Math.pow(1 / candidate.interval, 3) *
          easyDayModifiers[index]!
  }));
}

export function calculateReviewEasyDayModifiers(
  easyDays: ReviewEasyDays,
  weekdays: readonly number[],
  reviewCounts: readonly number[]
) {
  if (weekdays.length !== reviewCounts.length) {
    throw new Error(
      "Easy-day weekdays and review counts must have equal length."
    );
  }

  const totalReviewCount = reviewCounts.reduce(
    (total, count) => total + normalizeCount(count),
    0
  );
  const totalPercent = weekdays.reduce(
    (total, weekday) =>
      total + EASY_DAY_LOAD_MODIFIER[resolveEasyDay(easyDays, weekday)],
    0
  );

  return weekdays.map((weekday, index) => {
    const configuredDay = resolveEasyDay(easyDays, weekday);

    if (configuredDay !== "reduced") {
      return EASY_DAY_LOAD_MODIFIER[configuredDay];
    }

    const count = normalizeCount(reviewCounts[index]);
    const otherDaysReviewTotal = totalReviewCount - count;
    const otherDaysPercentTotal = totalPercent - 0.5;
    const normalizedCount = count / 0.5;
    const exceedsReducedThreshold =
      otherDaysPercentTotal > 0 &&
      normalizedCount > otherDaysReviewTotal / otherDaysPercentTotal;

    return EASY_DAY_LOAD_MODIFIER[
      exceedsReducedThreshold ? "minimum" : "normal"
    ];
  });
}

function selectWeightedInterval(
  candidates: readonly { interval: number; weight: number }[],
  randomUnit: number
) {
  const totalWeight = candidates.reduce(
    (total, candidate) =>
      total +
      (Number.isFinite(candidate.weight) && candidate.weight > 0
        ? candidate.weight
        : 0),
    0
  );

  if (!(totalWeight > 0)) {
    return null;
  }

  let cursor = randomUnit * totalWeight;

  for (const candidate of candidates) {
    const weight =
      Number.isFinite(candidate.weight) && candidate.weight > 0
        ? candidate.weight
        : 0;

    if (cursor < weight) {
      return candidate.interval;
    }

    cursor -= weight;
  }

  return candidates.at(-1)?.interval ?? null;
}

function selectUniformInterval(bounds: ReviewFuzzBounds, randomUnit: number) {
  return (
    bounds.lower + Math.floor(randomUnit * (bounds.upper - bounds.lower + 1))
  );
}

function getReviewIntervalWeekday(reviewedAt: Date | string, interval: number) {
  const studyDay = addReviewStudyDays(getReviewStudyDay(reviewedAt), interval);
  const [year, month, day] = studyDay.split("-").map(Number);
  const sundayFirst = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();

  return (sundayFirst + 6) % 7;
}

function resolveEasyDay(easyDays: ReviewEasyDays, weekday: number) {
  const normalizedWeekday = clamp(Math.round(weekday), 0, 6);

  return easyDays[normalizedWeekday] ?? "normal";
}

function normalizeMaximumInterval(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_REVIEW_MAXIMUM_INTERVAL_DAYS;
  }

  return Math.max(1, Math.round(value!));
}

function normalizeMinimumInterval(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value!));
}

function normalizeFiniteInterval(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value!)) : 0;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
