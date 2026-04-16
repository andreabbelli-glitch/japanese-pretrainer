import fs from "node:fs";
import path from "node:path";

import { eq, inArray, sql } from "drizzle-orm";
import { generatorParameters } from "ts-fsrs";

import {
  card,
  db,
  reviewSubjectLog,
  userSetting,
  type DatabaseClient
} from "../db/index.ts";
import type { ReviewSeedState } from "./review-grade-previews.ts";

export type FsrsPresetKey = "recognition" | "concept";

export type FsrsOptimizerConfig = {
  desiredRetention: number;
  enabled: boolean;
  minDaysBetweenRuns: number;
  minNewReviews: number;
  presetStrategy: "card_type_v1";
};

export type FsrsOptimizerState = {
  bindingVersion: string;
  lastAttemptAt: string | null;
  lastCheckAt: string | null;
  lastSuccessfulTrainingAt: string | null;
  lastTrainingError: string | null;
  newEligibleReviewsSinceLastTraining: number;
  totalEligibleReviewsAtLastTraining: number;
};

export type FsrsOptimizedParameters = {
  desiredRetention: number;
  presetKey: FsrsPresetKey;
  trainedAt: string;
  trainingReviewCount: number;
  weights: number[];
};

export type FsrsOptimizerSnapshot = {
  config: FsrsOptimizerConfig;
  presets: Record<FsrsPresetKey, FsrsOptimizedParameters | null>;
  state: FsrsOptimizerState;
};

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

type FsrsOptimizerLogRow = {
  answeredAt: string;
  cardType: string;
  elapsedDays: number | null;
  id: string;
  rating: string;
  subjectKey: string;
};

type FsrsTrainingReview = {
  deltaT: number;
  rating: 1 | 2 | 3 | 4;
};

type FsrsTrainingDataset = {
  itemCount: number;
  items: FsrsTrainingReview[][];
  reviewCount: number;
  subjectCount: number;
};

type FsrsOptimizerSettingRow = Pick<
  typeof userSetting.$inferSelect,
  "key" | "updatedAt" | "valueJson"
>;

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
] as const satisfies Array<(typeof userSetting.$inferSelect)["key"]>;

const fsrsOptimizerRuntimeCacheKeySettingKeys = [
  FSRS_OPTIMIZER_CONFIG_KEY,
  FSRS_PARAMS_RECOGNITION_KEY,
  FSRS_PARAMS_CONCEPT_KEY
] as const satisfies Array<(typeof userSetting.$inferSelect)["key"]>;

const FSRS_RUNTIME_CONTEXT_TTL_MS = 60_000;

const defaultFsrsOptimizerConfig: FsrsOptimizerConfig = {
  desiredRetention: 0.9,
  enabled: true,
  minDaysBetweenRuns: 30,
  minNewReviews: 500,
  presetStrategy: "card_type_v1"
};

type FsrsSettingsReader = Pick<DatabaseClient, "query" | "select">;
type FsrsSettingsWriter = Pick<DatabaseClient, "insert" | "query">;
type FsrsSettingsCounter = Pick<DatabaseClient, "select">;

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

export function resolveFsrsPresetKey(cardType: string): FsrsPresetKey | null {
  if (cardType === "recognition" || cardType === "concept") {
    return cardType;
  }

  return null;
}

export function buildReviewSeedStateWithFsrsPreset(
  reviewSeedState: ReviewSeedState,
  cardType: string,
  snapshot: FsrsOptimizerSnapshot
): ReviewSeedState {
  const presetKey = resolveFsrsPresetKey(cardType);
  const preset = presetKey ? snapshot.presets[presetKey] : null;

  return {
    ...reviewSeedState,
    fsrsDesiredRetention: snapshot.config.desiredRetention,
    fsrsWeights: preset?.weights ?? null
  };
}

export function getFsrsOptimizerConfigDefaults() {
  return defaultFsrsOptimizerConfig;
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
  const existingConfig = await database.query.userSetting.findFirst({
    where: inArray(userSetting.key, [FSRS_OPTIMIZER_CONFIG_KEY])
  });

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

  await upsertUserSetting({
    database,
    key: FSRS_OPTIMIZER_CONFIG_KEY,
    nowIso,
    valueJson: JSON.stringify(normalizedConfig)
  });
  invalidateFsrsOptimizerRuntimeContextCache();
}

export async function writeFsrsOptimizerState(
  state: FsrsOptimizerState,
  database: FsrsSettingsWriter = db,
  nowIso = new Date().toISOString()
) {
  await upsertUserSetting({
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

  await upsertUserSetting({
    database,
    key,
    nowIso,
    valueJson: JSON.stringify(normalizeFsrsOptimizedParameters(parameters))
  });
}

export function buildFsrsTrainingDataset(
  rows: FsrsOptimizerLogRow[],
  presetKey: FsrsPresetKey
): FsrsTrainingDataset {
  const reviewsBySubject = new Map<string, FsrsTrainingReview[]>();
  let reviewCount = 0;

  for (const row of rows) {
    if (resolveFsrsPresetKey(row.cardType) !== presetKey) {
      continue;
    }

    const rating = mapRatingToBindingValue(row.rating);

    if (rating === null) {
      continue;
    }

    const subjectReviews = reviewsBySubject.get(row.subjectKey) ?? [];
    const deltaT =
      subjectReviews.length === 0 ? 0 : normalizeElapsedDays(row.elapsedDays);

    subjectReviews.push({
      deltaT,
      rating
    });
    reviewsBySubject.set(row.subjectKey, subjectReviews);
    reviewCount += 1;
  }

  const items: FsrsTrainingReview[][] = [];

  for (const reviews of reviewsBySubject.values()) {
    for (let index = 1; index < reviews.length; index += 1) {
      const slice = reviews.slice(0, index + 1).map((review) => ({
        deltaT: review.deltaT,
        rating: review.rating
      }));

      if (!slice.some((review) => review.deltaT > 0)) {
        continue;
      }

      items.push(slice);
    }
  }

  return {
    itemCount: items.length,
    items,
    reviewCount,
    subjectCount: reviewsBySubject.size
  };
}

export async function countEligibleFsrsOptimizerReviews(
  database: FsrsSettingsCounter = db
) {
  const result = await database
    .select({
      count: sql<number>`cast(count(*) as integer)`
    })
    .from(reviewSubjectLog)
    .innerJoin(card, eq(card.id, reviewSubjectLog.cardId))
    .where(inArray(card.cardType, ["recognition", "concept"]));

  return Number(result[0]?.count ?? 0);
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

function mapRatingToBindingValue(rating: string) {
  switch (rating) {
    case "again":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    default:
      return null;
  }
}

function normalizeElapsedDays(value: number | null) {
  if (!Number.isFinite(value) || value === null) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

async function loadFsrsOptimizerRows(
  database: FsrsSettingsReader,
  keys: readonly (typeof userSetting.$inferSelect)["key"][]
) {
  return database.query.userSetting.findMany({
    where: inArray(userSetting.key, [...keys])
  }) as Promise<FsrsOptimizerSettingRow[]>;
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
  const valueByKey = new Map(rows.map((row) => [row.key, row.valueJson]));

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

function parseConfigValue(valueJson: string | undefined): FsrsOptimizerConfig {
  if (!valueJson) {
    return defaultFsrsOptimizerConfig;
  }

  try {
    return normalizeFsrsOptimizerConfig(
      JSON.parse(valueJson) as Partial<FsrsOptimizerConfig>
    );
  } catch {
    return defaultFsrsOptimizerConfig;
  }
}

function parseFsrsOptimizerConfigValue(
  valueJson: string | undefined
): FsrsOptimizerConfig | null {
  if (!valueJson) {
    return null;
  }

  try {
    return normalizeFsrsOptimizerConfig(
      JSON.parse(valueJson) as Partial<FsrsOptimizerConfig>
    );
  } catch {
    return null;
  }
}

function parseStateValue(valueJson: string | undefined): FsrsOptimizerState {
  if (!valueJson) {
    return defaultFsrsOptimizerState();
  }

  try {
    return normalizeFsrsOptimizerState(
      JSON.parse(valueJson) as Partial<FsrsOptimizerState>
    );
  } catch {
    return defaultFsrsOptimizerState();
  }
}

function parseParamsValue(
  valueJson: string | undefined,
  presetKey: FsrsPresetKey
): FsrsOptimizedParameters | null {
  if (!valueJson) {
    return null;
  }

  try {
    return normalizeFsrsOptimizedParameters(
      JSON.parse(valueJson) as Partial<FsrsOptimizedParameters>,
      presetKey
    );
  } catch {
    return null;
  }
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

export async function loadFsrsOptimizerLogRows(
  database: DatabaseClient
): Promise<FsrsOptimizerLogRow[]> {
  const result = await database.$client.execute({
    sql: `
      select
        rsl.id as id,
        rsl.subject_key as subjectKey,
        rsl.answered_at as answeredAt,
        rsl.rating as rating,
        rsl.elapsed_days as elapsedDays,
        c.card_type as cardType
      from review_subject_log rsl
      inner join card c on c.id = rsl.card_id
      where c.card_type in ('recognition', 'concept')
      order by rsl.subject_key asc, rsl.answered_at asc, rsl.id asc
    `
  });

  return result.rows.map((row) => ({
    answeredAt: String(row.answeredAt),
    cardType: String(row.cardType),
    elapsedDays:
      typeof row.elapsedDays === "number"
        ? row.elapsedDays
        : row.elapsedDays == null
          ? null
          : Number(row.elapsedDays),
    id: String(row.id),
    rating: String(row.rating),
    subjectKey: String(row.subjectKey)
  }));
}

async function upsertUserSetting(input: {
  database: FsrsSettingsWriter;
  key: (typeof userSetting.$inferInsert)["key"];
  nowIso: string;
  valueJson: string;
}) {
  await input.database
    .insert(userSetting)
    .values({
      key: input.key,
      valueJson: input.valueJson,
      updatedAt: input.nowIso
    })
    .onConflictDoUpdate({
      target: userSetting.key,
      set: {
        valueJson: input.valueJson,
        updatedAt: input.nowIso
      }
    });
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
