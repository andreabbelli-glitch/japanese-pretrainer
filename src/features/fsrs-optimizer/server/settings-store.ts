import fs from "node:fs";
import path from "node:path";

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
  type FsrsOptimizedParameters,
  type FsrsOptimizerConfig,
  type FsrsOptimizerSnapshot,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import {
  areFsrsOptimizerConfigsEqual,
  buildDefaultFsrsOptimizerSnapshot as buildDefaultFsrsOptimizerSnapshotFromCodec,
  calculateFsrsOptimizerNewReviewThreshold,
  getFsrsOptimizerConfigDefaults,
  normalizeFsrsOptimizedParameters,
  normalizeFsrsOptimizerConfig,
  normalizeFsrsOptimizerState,
  normalizeFsrsWeights
} from "../model/settings-codec.ts";

type FsrsOptimizerSettingRow = UserSettingStorageRow;

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

type FsrsSettingsReader = Pick<DatabaseClient, "query" | "select">;
type FsrsSettingsWriter = Pick<DatabaseClient, "insert" | "query">;

let cachedFsrsRuntimeContext: {
  expiresAt: number;
  promise: Promise<{
    cacheKeyPart: string;
    snapshot: FsrsOptimizerSnapshot;
  }>;
} | null = null;

export function buildDefaultFsrsOptimizerSnapshot(): FsrsOptimizerSnapshot {
  return buildDefaultFsrsOptimizerSnapshotFromCodec(getBindingPackageVersion());
}

export {
  calculateFsrsOptimizerNewReviewThreshold,
  getFsrsOptimizerConfigDefaults,
  normalizeFsrsWeights
};

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

export async function getFsrsOptimizerCacheKeyPart(
  database: FsrsSettingsReader = db
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
    valueJson: JSON.stringify(
      normalizeFsrsOptimizerState(state, getBindingPackageVersion())
    )
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
    getFsrsOptimizerConfigDefaults()
  );
}

function parseFsrsOptimizerConfigValue(
  valueJson: string | undefined
): FsrsOptimizerConfig | null {
  return parseOptionalUserSettingValue(valueJson, normalizeFsrsOptimizerConfig);
}

function parseStateValue(valueJson: string | undefined): FsrsOptimizerState {
  const fallbackBindingVersion = getBindingPackageVersion();

  return parseUserSettingValue(
    valueJson,
    (value: Partial<FsrsOptimizerState>) =>
      normalizeFsrsOptimizerState(value, fallbackBindingVersion),
    normalizeFsrsOptimizerState({}, fallbackBindingVersion)
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
