import { generatorParameters } from "ts-fsrs";

import {
  DEFAULT_FSRS_OPTIMIZER_CONFIG,
  type FsrsOptimizedParameters,
  type FsrsOptimizerConfig,
  type FsrsOptimizerSnapshot,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "./snapshot.ts";

const fsrsWeightCount = generatorParameters({}).w.length;
const FSRS_OPTIMIZER_NEW_REVIEW_RATIO = 0.25;
const FSRS_OPTIMIZER_MAX_NEW_REVIEW_THRESHOLD = 3_000;

const defaultFsrsOptimizerConfig = DEFAULT_FSRS_OPTIMIZER_CONFIG;

export function getFsrsOptimizerConfigDefaults() {
  return defaultFsrsOptimizerConfig;
}

export function calculateFsrsOptimizerNewReviewThreshold(input: {
  minNewReviews: number;
  totalEligibleReviewsAtLastTraining: number;
}) {
  const floor = normalizePositiveInteger(
    input.minNewReviews,
    defaultFsrsOptimizerConfig.minNewReviews
  );
  const proportionalThreshold = Math.ceil(
    normalizeNonNegativeInteger(input.totalEligibleReviewsAtLastTraining) *
      FSRS_OPTIMIZER_NEW_REVIEW_RATIO
  );

  return Math.min(
    FSRS_OPTIMIZER_MAX_NEW_REVIEW_THRESHOLD,
    Math.max(floor, proportionalThreshold)
  );
}

export function buildDefaultFsrsOptimizerSnapshot(
  fallbackBindingVersion: string
): FsrsOptimizerSnapshot {
  return {
    config: defaultFsrsOptimizerConfig,
    presets: {
      concept: null,
      recognition: null
    },
    state: normalizeFsrsOptimizerState({}, fallbackBindingVersion)
  };
}

export function normalizeFsrsOptimizerConfig(
  input: Partial<FsrsOptimizerConfig>
): FsrsOptimizerConfig {
  return {
    desiredRetention: normalizeDesiredRetention(input.desiredRetention),
    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : defaultFsrsOptimizerConfig.enabled,
    minDaysBetweenRuns: normalizePositiveInteger(
      input.minDaysBetweenRuns,
      defaultFsrsOptimizerConfig.minDaysBetweenRuns
    ),
    minNewReviews: normalizePositiveInteger(
      input.minNewReviews,
      defaultFsrsOptimizerConfig.minNewReviews
    ),
    presetStrategy: "card_type_v1"
  };
}

export function areFsrsOptimizerConfigsEqual(
  left: FsrsOptimizerConfig,
  right: FsrsOptimizerConfig
) {
  return (
    left.desiredRetention === right.desiredRetention &&
    left.enabled === right.enabled &&
    left.minDaysBetweenRuns === right.minDaysBetweenRuns &&
    left.minNewReviews === right.minNewReviews &&
    left.presetStrategy === right.presetStrategy
  );
}

export function normalizeFsrsOptimizerState(
  input: Partial<FsrsOptimizerState>,
  fallbackBindingVersion: string
): FsrsOptimizerState {
  return {
    bindingVersion:
      typeof input.bindingVersion === "string" &&
      input.bindingVersion.length > 0
        ? input.bindingVersion
        : fallbackBindingVersion,
    lastAttemptAt: normalizeNullableIsoString(input.lastAttemptAt),
    lastCheckAt: normalizeNullableIsoString(input.lastCheckAt),
    lastSuccessfulTrainingAt: normalizeNullableIsoString(
      input.lastSuccessfulTrainingAt
    ),
    lastTrainingError:
      typeof input.lastTrainingError === "string" &&
      input.lastTrainingError.trim().length > 0
        ? input.lastTrainingError.trim()
        : null,
    newEligibleReviewsSinceLastTraining: normalizeNonNegativeInteger(
      input.newEligibleReviewsSinceLastTraining
    ),
    totalEligibleReviewsAtLastTraining: normalizeNonNegativeInteger(
      input.totalEligibleReviewsAtLastTraining
    )
  };
}

export function normalizeFsrsOptimizedParameters(
  input: Partial<FsrsOptimizedParameters>,
  fallbackPresetKey?: FsrsPresetKey
): FsrsOptimizedParameters | null {
  const presetKey =
    input.presetKey === "concept" || input.presetKey === "recognition"
      ? input.presetKey
      : fallbackPresetKey;
  const trainedAt = normalizeNullableIsoString(input.trainedAt);
  const weights = normalizeFsrsWeights(input.weights);

  if (!presetKey || !trainedAt || !weights) {
    return null;
  }

  return {
    desiredRetention: normalizeDesiredRetention(input.desiredRetention),
    presetKey,
    trainedAt,
    trainingReviewCount: normalizePositiveInteger(input.trainingReviewCount, 0),
    weights
  };
}

export function normalizeFsrsWeights(value: unknown) {
  if (!Array.isArray(value) || value.length !== fsrsWeightCount) {
    return null;
  }

  const weights = value.map((item) =>
    typeof item === "number" ? item : Number.NaN
  );

  return weights.every((item) => Number.isFinite(item)) ? weights : null;
}

function normalizeDesiredRetention(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return defaultFsrsOptimizerConfig.desiredRetention;
  }

  return Math.min(0.99, Math.max(0.7, roundTo(value!, 3)));
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.round(value!));
}

function normalizeNonNegativeInteger(value: number | undefined) {
  return normalizePositiveInteger(value, 0);
}

function normalizeNullableIsoString(value: string | null | undefined) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
