import {
  FSRSBindingItem,
  FSRSBindingReview,
  computeParameters
} from "@open-spaced-repetition/binding";

import { db, type DatabaseClient } from "../../../db/index.ts";
import {
  type FsrsOptimizedParameters,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import {
  buildInitialFsrsOptimizationPresetResults,
  markFsrsOptimizationPresetTrained,
  planFsrsOptimizerRun,
  resolveFsrsTrainingReadiness,
  type FsrsOptimizationRunResult
} from "../model/training-policy.ts";
import {
  calculateFsrsOptimizerNewReviewThreshold,
  getBindingPackageVersion,
  getFsrsOptimizerSnapshot,
  invalidateFsrsOptimizerRuntimeContextCache,
  normalizeFsrsWeights,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState
} from "../server/settings-store.ts";
import {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviews,
  loadFsrsOptimizerLogRows
} from "../server/training-data.ts";

const DEFAULT_TRAINING_TIMEOUT_MS = 5_000;
const TRAINING_TIMEOUT_ENV = "FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS";

export async function runFsrsOptimizer(
  input: {
    database?: DatabaseClient;
    force?: boolean;
    now?: Date;
    trainingTimeoutMs?: number;
  } = {}
): Promise<FsrsOptimizationRunResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const trainingTimeoutMs =
    input.trainingTimeoutMs ??
    readTrainingTimeoutMsFromEnv() ??
    DEFAULT_TRAINING_TIMEOUT_MS;
  const [snapshot, totalEligibleReviews] = await Promise.all([
    getFsrsOptimizerSnapshot(database),
    countEligibleFsrsOptimizerReviews(database)
  ]);
  const newEligibleReviews = Math.max(
    totalEligibleReviews - snapshot.state.totalEligibleReviewsAtLastTraining,
    0
  );
  const newReviewThreshold = calculateFsrsOptimizerNewReviewThreshold({
    minNewReviews: snapshot.config.minNewReviews,
    totalEligibleReviewsAtLastTraining:
      snapshot.state.totalEligibleReviewsAtLastTraining
  });
  const runPlan = planFsrsOptimizerRun({
    config: snapshot.config,
    force: input.force ?? false,
    newEligibleReviews,
    newReviewThreshold,
    now,
    state: snapshot.state
  });

  await writeFsrsOptimizerConfig(snapshot.config, database, nowIso);

  if (runPlan.action === "skip") {
    await writeSkippedFsrsOptimizerState({
      database,
      nowIso,
      newEligibleReviews,
      state: snapshot.state
    });

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: runPlan.reason,
      status: "skipped",
      totalEligibleReviews
    };
  }

  const rows = await loadFsrsOptimizerLogRows(database);
  const trainingSnapshotRows = rows.filter((row) => row.answeredAt < nowIso);
  const trainingSnapshotEligibleReviewCount = trainingSnapshotRows.length;
  const recognitionDataset = buildFsrsTrainingDataset(
    trainingSnapshotRows,
    "recognition"
  );
  const conceptDataset = buildFsrsTrainingDataset(
    trainingSnapshotRows,
    "concept"
  );
  const readiness = resolveFsrsTrainingReadiness({
    conceptDataset,
    recognitionDataset
  });

  if (!readiness.hasTrainableData) {
    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastAttemptAt: nowIso,
        lastCheckAt: nowIso,
        lastTrainingError: null,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    return {
      lastCheckAt: nowIso,
      newEligibleReviews,
      reason: "no-trainable-data",
      status: "skipped",
      totalEligibleReviews
    };
  }

  try {
    const presetResults = buildInitialFsrsOptimizationPresetResults({
      conceptTrainingReviewCount: conceptDataset.reviewCount,
      recognitionTrainingReviewCount: recognitionDataset.reviewCount
    });
    const [recognitionParameters, conceptParameters] = await Promise.all([
      readiness.recognitionTrainable
        ? trainFsrsPreset(
            "recognition",
            recognitionDataset.items,
            recognitionDataset.reviewCount,
            snapshot.config.desiredRetention,
            nowIso,
            trainingTimeoutMs
          )
        : null,
      readiness.conceptTrainable
        ? trainFsrsPreset(
            "concept",
            conceptDataset.items,
            conceptDataset.reviewCount,
            snapshot.config.desiredRetention,
            nowIso,
            trainingTimeoutMs
          )
        : null
    ]);
    const trainedParameters = [recognitionParameters, conceptParameters].filter(
      (parameters): parameters is FsrsOptimizedParameters => parameters !== null
    );

    markFsrsOptimizationPresetTrained(presetResults, recognitionParameters);
    markFsrsOptimizationPresetTrained(presetResults, conceptParameters);

    const liveEligibleReviews =
      await countEligibleFsrsOptimizerReviews(database);
    const newEligibleReviewsSinceLastTraining = Math.max(
      liveEligibleReviews - trainingSnapshotEligibleReviewCount,
      0
    );

    await database.transaction(async (tx) => {
      for (const parameters of trainedParameters) {
        await writeFsrsOptimizedParameters(parameters, tx, nowIso);
      }

      await writeFsrsOptimizerState(
        {
          bindingVersion: getBindingPackageVersion(),
          lastAttemptAt: nowIso,
          lastCheckAt: nowIso,
          lastSuccessfulTrainingAt: nowIso,
          lastTrainingError: null,
          newEligibleReviewsSinceLastTraining,
          totalEligibleReviewsAtLastTraining:
            trainingSnapshotEligibleReviewCount
        },
        tx,
        nowIso
      );
    });
    invalidateFsrsOptimizerRuntimeContextCache();

    return {
      lastCheckAt: nowIso,
      newEligibleReviews: newEligibleReviewsSinceLastTraining,
      presetResults,
      status: "trained",
      totalEligibleReviews: trainingSnapshotEligibleReviewCount,
      trainedAt: nowIso
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await writeFsrsOptimizerState(
      {
        ...snapshot.state,
        bindingVersion: getBindingPackageVersion(),
        lastAttemptAt: nowIso,
        lastCheckAt: nowIso,
        lastTrainingError: message,
        newEligibleReviewsSinceLastTraining: newEligibleReviews
      },
      database,
      nowIso
    );

    throw error;
  }
}

function buildBindingItems(
  items: Array<Array<{ deltaT: number; rating: 1 | 2 | 3 | 4 }>>
) {
  return items.map(
    (reviews) =>
      new FSRSBindingItem(
        reviews.map(
          (review) => new FSRSBindingReview(review.rating, review.deltaT)
        )
      )
  );
}

function readTrainingTimeoutMsFromEnv() {
  const rawValue = process.env[TRAINING_TIMEOUT_ENV]?.trim();

  if (!rawValue || !/^\d+$/u.test(rawValue)) {
    return null;
  }

  const parsed = Number(rawValue);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function trainFsrsPreset(
  presetKey: FsrsPresetKey,
  items: Array<Array<{ deltaT: number; rating: 1 | 2 | 3 | 4 }>>,
  trainingReviewCount: number,
  desiredRetention: number,
  nowIso: string,
  trainingTimeoutMs: number
): Promise<FsrsOptimizedParameters> {
  const weights = await computeParameters(buildBindingItems(items), {
    enableShortTerm: true,
    numRelearningSteps: 1,
    timeout: trainingTimeoutMs
  });
  const normalizedWeights = normalizeFsrsWeights(weights);

  if (!normalizedWeights) {
    throw new Error(
      `${capitalizePresetKey(presetKey)} training produced invalid FSRS weights.`
    );
  }

  return {
    desiredRetention,
    presetKey,
    trainedAt: nowIso,
    trainingReviewCount,
    weights: normalizedWeights
  };
}

function capitalizePresetKey(presetKey: FsrsPresetKey) {
  return presetKey === "recognition" ? "Recognition" : "Concept";
}

async function writeSkippedFsrsOptimizerState(input: {
  database: DatabaseClient;
  nowIso: string;
  newEligibleReviews: number;
  state: FsrsOptimizerState;
}) {
  await writeFsrsOptimizerState(
    {
      ...input.state,
      bindingVersion: getBindingPackageVersion(),
      lastCheckAt: input.nowIso,
      newEligibleReviewsSinceLastTraining: input.newEligibleReviews
    },
    input.database,
    input.nowIso
  );
}
