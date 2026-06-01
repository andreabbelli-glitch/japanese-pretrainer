import fs from "node:fs";
import path from "node:path";

import { generatorParameters } from "ts-fsrs";

import { db, type DatabaseClient } from "../../../db/index.ts";
import {
  getUserSettingByKey,
  listUserSettingsByKeys,
  mapUserSettingsByKey,
  parseOptionalUserSettingValue,
  parseUserSettingValue,
  upsertUserSettingValue,
  type UserSettingKey,
  type UserSettingStorageRow
} from "../../../db/queries/user-settings.ts";
import {
  buildReviewSeedStateWithFsrsPreset,
  DEFAULT_FSRS_OPTIMIZER_CONFIG,
  resolveFsrsPresetKey,
  type FsrsOptimizedParameters,
  type FsrsOptimizerConfig,
  type FsrsOptimizerSnapshot,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import { countEligibleFsrsOptimizerReviews } from "./training-data.ts";

export {
  buildReviewSeedStateWithFsrsPreset,
  DEFAULT_FSRS_OPTIMIZER_CONFIG,
  resolveFsrsPresetKey
};
export type {
  FsrsOptimizedParameters,
  FsrsOptimizerConfig,
  FsrsOptimizerSnapshot,
  FsrsOptimizerState,
  FsrsPresetKey
};
export {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviews,
  loadFsrsOptimizerLogRows
} from "./training-data.ts";
export type {
  FsrsOptimizerLogRow,
  FsrsTrainingDataset,
  FsrsTrainingReview
} from "./training-data.ts";

export type FsrsOptimizerPresetStatus = {
  desiredRetention: number;
  presetKey: FsrsPresetKey;
  trainedAt: string | null;
  trainingReviewCount: number;
  usesOptimizedParameters: boolean;
};

export type FsrsOptimizerStatus = {
  config: FsrsOptimizerConfig;
  state: FsrsOptimizerState;
  newEligibleReviews: number;
  nextTrainingNewReviewThreshold: number;
  presets: Record<FsrsPresetKey, FsrsOptimizerPresetStatus>;
  totalEligibleReviews: number;
};

type FsrsOptimizationPresetResult = {
  status: "trained" | "unchanged";
  trainingReviewCount: number;
};

export type FsrsOptimizationRunResult =
  | {
      lastCheckAt: string;
      newEligibleReviews: number;
      reason: "disabled" | "insufficient-new-reviews" | "too-soon";
      status: "skipped";
      totalEligibleReviews: number;
    }
  | {
      lastCheckAt: string;
      newEligibleReviews: number;
      reason: "no-trainable-data";
      status: "skipped";
      totalEligibleReviews: number;
    }
  | {
      lastCheckAt: string;
      newEligibleReviews: number;
      presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult>;
      status: "trained";
      totalEligibleReviews: number;
      trainedAt: string;
    };

type FsrsOptimizerSettingRow = UserSettingStorageRow;

const fsrsWeightCount = generatorParameters({}).w.length;

export const FSRS_OPTIMIZER_CONFIG_KEY = "fsrs_optimizer_config";
export const FSRS_OPTIMIZER_STATE_KEY = "fsrs_optimizer_state";
export const FSRS_PARAMS_RECOGNITION_KEY = "fsrs_params_recognition";
export const FSRS_PARAMS_CONCEPT_KEY = "fsrs_params_concept";

const fsrsOptimizerSettingKeys = [
  FSRS_OPTIMIZER_CONFIG_KEY,
  FSRS_OPTIMIZER_STATE_KEY,
  FSRS_PARAMS_RECOGNITION_KEY,
  FSRS_PARAMS_CONCEPT_KEY
] as const satisfies readonly UserSettingKey[];

const fsrsOptimizerRuntimeCacheKeySettingKeys = [
  FSRS_OPTIMIZER_CONFIG_KEY,
  FSRS_PARAMS_RECOGNITION_KEY,
  FSRS_PARAMS_CONCEPT_KEY
] as const satisfies readonly UserSettingKey[];

const FSRS_RUNTIME_CONTEXT_TTL_MS = 60_000;
const FSRS_OPTIMIZER_NEW_REVIEW_RATIO = 0.25;
const FSRS_OPTIMIZER_MAX_NEW_REVIEW_THRESHOLD = 3_000;

const defaultFsrsOptimizerConfig = DEFAULT_FSRS_OPTIMIZER_CONFIG;

type FsrsSettingsReader = Pick<DatabaseClient, "query" | "select">;
type FsrsSettingsWriter = Pick<DatabaseClient, "insert" | "query">;

let cachedFsrsRuntimeContext: {
  expiresAt: number;
  promise: Promise<{
    cacheKeyPart: string;
    snapshot: FsrsOptimizerSnapshot;
  }>;
} | null = null;

function defaultFsrsOptimizerState(): FsrsOptimizerState {
  return {
    bindingVersion: getBindingPackageVersion(),
    lastAttemptAt: null,
    lastCheckAt: null,
    lastSuccessfulTrainingAt: null,
    lastTrainingError: null,
    newEligibleReviewsSinceLastTraining: 0,
    totalEligibleReviewsAtLastTraining: 0
  };
}

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

export function buildDefaultFsrsOptimizerSnapshot(): FsrsOptimizerSnapshot {
  return {
    config: defaultFsrsOptimizerConfig,
    presets: {
      concept: null,
      recognition: null
    },
    state: defaultFsrsOptimizerState()
  };
}

export async function getFsrsOptimizerSnapshot(
  database: FsrsSettingsReader = db
): Promise<FsrsOptimizerSnapshot> {
  return buildFsrsOptimizerSnapshotFromRows(
    await loadFsrsOptimizerRows(database, fsrsOptimizerSettingKeys)
  );
}

export async function getFsrsOptimizerRuntimeContext(
  database: DatabaseClient = db
): Promise<{
  cacheKeyPart: string;
  snapshot: FsrsOptimizerSnapshot;
}> {
  if (!canUseFsrsRuntimeContextCache(database)) {
    return loadFsrsOptimizerRuntimeContext(database);
  }

  const now = Date.now();

  if (cachedFsrsRuntimeContext && cachedFsrsRuntimeContext.expiresAt > now) {
    return cachedFsrsRuntimeContext.promise;
  }

  const promise = loadFsrsOptimizerRuntimeContext(database).catch((error) => {
    if (cachedFsrsRuntimeContext?.promise === promise) {
      cachedFsrsRuntimeContext = null;
    }

    throw error;
  });

  cachedFsrsRuntimeContext = {
    expiresAt: now + FSRS_RUNTIME_CONTEXT_TTL_MS,
    promise
  };

  return promise;
}

export async function getFsrsOptimizerRuntimeSnapshot(
  database: DatabaseClient = db
): Promise<FsrsOptimizerSnapshot> {
  return (await getFsrsOptimizerRuntimeContext(database)).snapshot;
}

export async function getFsrsOptimizerStatus(
  database: DatabaseClient = db
): Promise<FsrsOptimizerStatus> {
  const [snapshot, totalEligibleReviews] = await Promise.all([
    getFsrsOptimizerSnapshot(database),
    countEligibleFsrsOptimizerReviews(database)
  ]);
  const newEligibleReviews = Math.max(
    totalEligibleReviews - snapshot.state.totalEligibleReviewsAtLastTraining,
    0
  );

  return {
    config: snapshot.config,
    newEligibleReviews,
    nextTrainingNewReviewThreshold: calculateFsrsOptimizerNewReviewThreshold({
      minNewReviews: snapshot.config.minNewReviews,
      totalEligibleReviewsAtLastTraining:
        snapshot.state.totalEligibleReviewsAtLastTraining
    }),
    presets: {
      concept: buildPresetStatus(
        "concept",
        snapshot.config.desiredRetention,
        snapshot.presets.concept
      ),
      recognition: buildPresetStatus(
        "recognition",
        snapshot.config.desiredRetention,
        snapshot.presets.recognition
      )
    },
    state: {
      ...snapshot.state,
      newEligibleReviewsSinceLastTraining: newEligibleReviews
    },
    totalEligibleReviews
  };
}

export async function getFsrsOptimizerCacheKeyPart(
  database: DatabaseClient = db
): Promise<string> {
  return buildFsrsOptimizerCacheKeyPartFromRows(
    await loadFsrsOptimizerRows(
      database,
      fsrsOptimizerRuntimeCacheKeySettingKeys
    )
  );
}

export async function writeFsrsOptimizerConfig(
  config: FsrsOptimizerConfig,
  database: FsrsSettingsWriter = db,
  nowIso = new Date().toISOString()
) {
  const normalizedConfig = normalizeFsrsOptimizerConfig(config);
  const existingConfig = await getUserSettingByKey(
    database,
    FSRS_OPTIMIZER_CONFIG_KEY
  );

  if (existingConfig) {
    const parsedExistingConfig = parseFsrsOptimizerConfigValue(
      existingConfig.valueJson
    );

    if (
      parsedExistingConfig &&
      areFsrsOptimizerConfigsEqual(parsedExistingConfig, normalizedConfig)
    ) {
      return;
    }
  }

  await upsertUserSettingValue({
    database,
    key: FSRS_OPTIMIZER_CONFIG_KEY,
    nowIso,
    valueJson: JSON.stringify(normalizedConfig)
  });
  invalidateFsrsOptimizerRuntimeContextCache();
  await revalidateReviewFirstCandidateCacheIfSupported();
}

export async function writeFsrsOptimizerState(
  state: FsrsOptimizerState,
  database: FsrsSettingsWriter = db,
  nowIso = new Date().toISOString()
) {
  await upsertUserSettingValue({
    database,
    key: FSRS_OPTIMIZER_STATE_KEY,
    nowIso,
    valueJson: JSON.stringify(normalizeFsrsOptimizerState(state))
  });
}

export async function writeFsrsOptimizedParameters(
  parameters: FsrsOptimizedParameters,
  database: FsrsSettingsWriter = db,
  nowIso = new Date().toISOString()
) {
  const key =
    parameters.presetKey === "concept"
      ? FSRS_PARAMS_CONCEPT_KEY
      : FSRS_PARAMS_RECOGNITION_KEY;

  await upsertUserSettingValue({
    database,
    key,
    nowIso,
    valueJson: JSON.stringify(normalizeFsrsOptimizedParameters(parameters))
  });
  invalidateFsrsOptimizerRuntimeContextCache();
  await revalidateReviewFirstCandidateCacheIfSupported();
}

function buildPresetStatus(
  presetKey: FsrsPresetKey,
  desiredRetention: number,
  parameters: FsrsOptimizedParameters | null
): FsrsOptimizerPresetStatus {
  return {
    desiredRetention,
    presetKey,
    trainedAt: parameters?.trainedAt ?? null,
    trainingReviewCount: parameters?.trainingReviewCount ?? 0,
    usesOptimizedParameters: parameters !== null
  };
}

async function loadFsrsOptimizerRows(
  database: FsrsSettingsReader,
  keys: readonly UserSettingKey[]
) {
  return listUserSettingsByKeys(database, keys);
}

async function loadFsrsOptimizerRuntimeContext(
  database: DatabaseClient
): Promise<{
  cacheKeyPart: string;
  snapshot: FsrsOptimizerSnapshot;
}> {
  const rows = await loadFsrsOptimizerRows(
    database,
    fsrsOptimizerRuntimeCacheKeySettingKeys
  );

  return {
    cacheKeyPart: buildFsrsOptimizerCacheKeyPartFromRows(rows),
    snapshot: buildFsrsOptimizerSnapshotFromRows(rows)
  };
}

function buildFsrsOptimizerSnapshotFromRows(
  rows: FsrsOptimizerSettingRow[]
): FsrsOptimizerSnapshot {
  const valueByKey = mapUserSettingsByKey(rows);

  return {
    config: parseConfigValue(valueByKey.get(FSRS_OPTIMIZER_CONFIG_KEY)),
    presets: {
      concept: parseParamsValue(
        valueByKey.get(FSRS_PARAMS_CONCEPT_KEY),
        "concept"
      ),
      recognition: parseParamsValue(
        valueByKey.get(FSRS_PARAMS_RECOGNITION_KEY),
        "recognition"
      )
    },
    state: parseStateValue(valueByKey.get(FSRS_OPTIMIZER_STATE_KEY))
  };
}

function buildFsrsOptimizerCacheKeyPartFromRows(
  rows: FsrsOptimizerSettingRow[]
) {
  const byKey = new Map(rows.map((row) => [row.key, row.updatedAt]));

  return [
    byKey.get(FSRS_OPTIMIZER_CONFIG_KEY) ?? "none",
    byKey.get(FSRS_PARAMS_RECOGNITION_KEY) ?? "none",
    byKey.get(FSRS_PARAMS_CONCEPT_KEY) ?? "none"
  ].join("|");
}

function canUseFsrsRuntimeContextCache(database: DatabaseClient) {
  return (
    database === db && process.env.NODE_ENV !== "test" && !process.env.VITEST
  );
}

export function invalidateFsrsOptimizerRuntimeContextCache() {
  cachedFsrsRuntimeContext = null;
}

type NextCacheModule = {
  revalidateTag?: (tag: string, profile?: "max") => void;
};

async function revalidateReviewFirstCandidateCacheIfSupported() {
  const nextCache = await loadNextCacheModule();

  if (typeof nextCache?.revalidateTag !== "function") {
    return;
  }

  try {
    nextCache.revalidateTag("review-first-candidate", "max");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("static generation store missing")
    ) {
      throw error;
    }
  }
}

async function loadNextCacheModule(): Promise<NextCacheModule | null> {
  try {
    return (await import("next/cache")) as NextCacheModule;
  } catch (error) {
    if (!isNextCacheModuleResolutionError(error)) {
      throw error;
    }
  }

  try {
    return (await import("next/cache.js")) as NextCacheModule;
  } catch (error) {
    if (isNextCacheModuleResolutionError(error)) {
      return null;
    }

    throw error;
  }
}

function isNextCacheModuleResolutionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND"
  );
}

function parseConfigValue(valueJson: string | undefined): FsrsOptimizerConfig {
  return parseUserSettingValue(
    valueJson,
    normalizeFsrsOptimizerConfig,
    defaultFsrsOptimizerConfig
  );
}

function parseFsrsOptimizerConfigValue(
  valueJson: string | undefined
): FsrsOptimizerConfig | null {
  return parseOptionalUserSettingValue(valueJson, normalizeFsrsOptimizerConfig);
}

function parseStateValue(valueJson: string | undefined): FsrsOptimizerState {
  return parseUserSettingValue(
    valueJson,
    normalizeFsrsOptimizerState,
    defaultFsrsOptimizerState()
  );
}

function parseParamsValue(
  valueJson: string | undefined,
  presetKey: FsrsPresetKey
): FsrsOptimizedParameters | null {
  return parseOptionalUserSettingValue(
    valueJson,
    (value: Partial<FsrsOptimizedParameters>) =>
      normalizeFsrsOptimizedParameters(value, presetKey)
  );
}

function normalizeFsrsOptimizerConfig(
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

function areFsrsOptimizerConfigsEqual(
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

function normalizeFsrsOptimizerState(
  input: Partial<FsrsOptimizerState>
): FsrsOptimizerState {
  return {
    bindingVersion:
      typeof input.bindingVersion === "string" &&
      input.bindingVersion.length > 0
        ? input.bindingVersion
        : getBindingPackageVersion(),
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

function normalizeFsrsOptimizedParameters(
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

export function normalizeFsrsWeights(value: unknown) {
  if (!Array.isArray(value) || value.length !== fsrsWeightCount) {
    return null;
  }

  const weights = value.map((item) =>
    typeof item === "number" ? item : Number.NaN
  );

  return weights.every((item) => Number.isFinite(item)) ? weights : null;
}

let cachedBindingPackageVersion: string | null = null;
export function getBindingPackageVersion() {
  if (cachedBindingPackageVersion) {
    return cachedBindingPackageVersion;
  }

  try {
    const packageJson = path.join(
      process.cwd(),
      "node_modules",
      "@open-spaced-repetition",
      "binding",
      "package.json"
    );
    const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8")) as {
      version?: string;
    };
    cachedBindingPackageVersion =
      typeof parsed.version === "string" && parsed.version.length > 0
        ? parsed.version
        : "unknown";
  } catch {
    cachedBindingPackageVersion = "unknown";
  }

  return cachedBindingPackageVersion;
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
