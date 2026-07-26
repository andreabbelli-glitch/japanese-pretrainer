import { randomUUID } from "node:crypto";

import {
  FSRSBinding,
  FSRSBindingItem,
  FSRSBindingReview,
  computeParameters,
  type ModelEvaluation
} from "@open-spaced-repetition/binding";

import { db, type DatabaseClient } from "../../../db/index.ts";
import { reviewSchedulerConfig } from "../../review/model/scheduler.ts";
import { getReviewStudyDayPolicyKey } from "../../review/model/study-day.ts";
import {
  resolveFsrsOptimizerPresetProgress,
  summarizeFsrsOptimizerPresetProgress
} from "../model/progress.ts";
import {
  type FsrsModelEvaluation,
  type FsrsOptimizedParameters,
  type FsrsOptimizerPresetProgress,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import {
  FSRS_OPTIMIZER_DATASET_VERSION,
  buildInitialFsrsOptimizationPresetResults,
  decideFsrsCandidatePromotion,
  planFsrsOptimizerPresetRuns,
  resolveFsrsTrainingReadiness,
  splitFsrsTimeSeries,
  type FsrsOptimizationPresetResult,
  type FsrsOptimizationRunResult,
  type FsrsOptimizerPresetRunPlan
} from "../model/training-policy.ts";
import {
  calculateFsrsOptimizerNewReviewThreshold,
  getBindingPackageVersion,
  getFreshFsrsOptimizerTrainingContext,
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerSnapshot,
  invalidateFsrsOptimizerCaches,
  normalizeFsrsWeights,
  writeFsrsOptimizedParametersToDatabase,
  writeFsrsOptimizerState
} from "../server/settings-store.ts";
import {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviewsByPreset,
  loadFsrsOptimizerLogRows,
  type FsrsEligibleReviewCounts,
  type FsrsTrainingDataset,
  type FsrsTrainingSequence
} from "../server/training-data.ts";

const DEFAULT_TRAINING_TIMEOUT_MS = 4_000;
const TRAINING_TIMEOUT_ENV = "FSRS_OPTIMIZER_TRAINING_TIMEOUT_MS";
const TRAINING_COMPUTE_BUDGET_RATIO = 0.9;
const PRESET_KEYS = ["recognition", "concept"] as const;

export type FsrsTrainingAdapter = {
  compute: (items: FSRSBindingItem[], timeoutMs: number) => Promise<number[]>;
  evaluate: (
    weights: number[],
    items: FSRSBindingItem[]
  ) => FsrsModelEvaluation;
  minimumHoldoutItemCount: number;
  minimumReviewCount: number;
  minimumTrainingItemCount: number;
};

const nativeFsrsTrainingAdapter: FsrsTrainingAdapter = {
  compute: (items, timeoutMs) =>
    computeParameters(items, {
      enableShortTerm: true,
      numRelearningSteps: 1,
      timeout: timeoutMs
    }),
  evaluate: (weights, items) =>
    normalizeModelEvaluation(new FSRSBinding(weights).evaluate(items)),
  minimumHoldoutItemCount: 101,
  minimumReviewCount: 202,
  minimumTrainingItemCount: 100
};

export async function runFsrsOptimizer(
  input: {
    database?: DatabaseClient;
    force?: boolean;
    now?: Date;
    trainingAdapter?: FsrsTrainingAdapter;
    trainingTimeoutMs?: number;
  } = {}
): Promise<FsrsOptimizationRunResult> {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const trainingAdapter = input.trainingAdapter ?? nativeFsrsTrainingAdapter;
  const trainingTimeoutMs =
    input.trainingTimeoutMs ??
    readTrainingTimeoutMsFromEnv() ??
    DEFAULT_TRAINING_TIMEOUT_MS;
  const [runtimeContext, eligibleReviewCounts] = await Promise.all([
    getFreshFsrsOptimizerTrainingContext(database),
    countEligibleFsrsOptimizerReviewsByPreset(database)
  ]);
  const { cacheKeyPart: startingCacheKeyPart, snapshot } = runtimeContext;
  const totalEligibleReviews = sumPresetCounts(eligibleReviewCounts);
  const presetProgress = resolveFsrsOptimizerPresetProgress(
    snapshot.state,
    eligibleReviewCounts
  );
  const progressSummary = summarizeFsrsOptimizerPresetProgress(presetProgress);
  const newReviewThreshold = buildPresetReviewThresholds(
    snapshot.config.minNewReviews,
    presetProgress
  );
  const runPlan = planFsrsOptimizerPresetRuns({
    config: snapshot.config,
    force: input.force ?? false,
    lastAttemptAt: {
      concept: presetProgress.concept.lastAttemptAt,
      recognition: presetProgress.recognition.lastAttemptAt
    },
    lastEvaluationAt: {
      concept: presetProgress.concept.lastEvaluationAt,
      recognition: presetProgress.recognition.lastEvaluationAt
    },
    newEligibleReviews: {
      concept: presetProgress.concept.newEligibleReviewsSinceLastEvaluation,
      recognition:
        presetProgress.recognition.newEligibleReviewsSinceLastEvaluation
    },
    newReviewThreshold,
    now
  });

  if (runPlan.action === "skip") {
    await writeSkippedFsrsOptimizerState({
      database,
      nowIso,
      presetProgress,
      state: snapshot.state
    });

    return {
      lastCheckAt: nowIso,
      newEligibleReviews: progressSummary.newEligibleReviewsSinceLastTraining,
      reason: runPlan.reason,
      status: "skipped",
      totalEligibleReviews
    };
  }

  const runId = `fsrs_optimizer_${randomUUID()}`;

  await writeFsrsOptimizerState(
    {
      ...snapshot.state,
      ...progressSummary,
      activeRunId: runId,
      bindingVersion: getBindingPackageVersion(),
      datasetVersion: FSRS_OPTIMIZER_DATASET_VERSION,
      lastAttemptAt: nowIso,
      lastCheckAt: nowIso,
      lastTrainingError: snapshot.state.lastTrainingError,
      presetProgress: markPlannedPresetAttempts(
        presetProgress,
        runPlan.presets,
        nowIso
      )
    },
    database,
    nowIso
  );

  try {
    const ledgerStartedAt = Date.now();
    const rows = await waitForOptimizerDeadline(
      loadFsrsOptimizerLogRows(database),
      ledgerStartedAt + trainingTimeoutMs,
      "FSRS optimizer shared ledger deadline exceeded."
    );
    const presetExecutionBudgetMs =
      trainingTimeoutMs - (Date.now() - ledgerStartedAt);

    if (presetExecutionBudgetMs <= 0) {
      throw new Error("FSRS optimizer shared ledger deadline exceeded.");
    }

    const trainingSnapshotRows = rows.filter((row) => row.answeredAt < nowIso);
    const trainingSnapshotCounts =
      countTrainingRowsByPreset(trainingSnapshotRows);
    const presetResults = buildInitialFsrsOptimizationPresetResults({
      conceptTrainingReviewCount: trainingSnapshotCounts.concept,
      recognitionTrainingReviewCount: trainingSnapshotCounts.recognition
    });
    const nextPresetProgress = clonePresetProgress(presetProgress);
    const promotedParameters: FsrsOptimizedParameters[] = [];
    let presetErrorCount = 0;
    let successfulEvaluationCount = 0;

    // Keep CPU and memory bounded on Hobby/free-tier runtimes: the two preset
    // optimizations are intentionally sequential and each has its own timeout.
    for (const presetKey of PRESET_KEYS) {
      const plan = runPlan.presets[presetKey];

      if (plan.action !== "evaluate") {
        presetResults[presetKey].reason = "not-due";
        continue;
      }

      // Each preset gets its own sequential execution window, minus the time
      // already spent loading the shared ledger. This includes the shared IO
      // in both end-to-end budgets without charging concept for recognition.
      const deadlineAt = Date.now() + presetExecutionBudgetMs;
      let dataset: FsrsTrainingDataset | null = null;

      try {
        dataset = buildFsrsTrainingDataset(trainingSnapshotRows, presetKey);
        assertPresetDeadline(deadlineAt, presetKey, "dataset");
        presetResults[presetKey].trainingReviewCount = dataset.reviewCount;

        if (!isFsrsPresetDatasetReady(dataset, presetKey, trainingAdapter)) {
          presetResults[presetKey].reason = "insufficient-data";
          nextPresetProgress[presetKey] = markInsufficientPresetAttempt(
            nextPresetProgress[presetKey],
            nowIso
          );
          continue;
        }

        const split = splitFsrsTimeSeries(dataset.sequences, {
          holdoutItemCount: trainingAdapter.minimumHoldoutItemCount,
          trainingItemCount: trainingAdapter.minimumTrainingItemCount
        });

        assertPresetDeadline(deadlineAt, presetKey, "split");

        if (!split) {
          presetResults[presetKey].reason = "insufficient-data";
          nextPresetProgress[presetKey] = markInsufficientPresetAttempt(
            nextPresetProgress[presetKey],
            nowIso
          );
          continue;
        }

        const outcome = await trainAndEvaluateFsrsPreset({
          dataset,
          deadlineAt,
          desiredRetention: snapshot.config.desiredRetention,
          incumbentWeights: snapshot.presets[presetKey]?.weights ?? [
            ...reviewSchedulerConfig.fsrs.w
          ],
          nowIso,
          presetKey,
          split,
          trainingAdapter
        });

        successfulEvaluationCount += 1;
        presetResults[presetKey] = outcome.result;
        nextPresetProgress[presetKey] = {
          eligibleReviewCountAtLastEvaluation:
            trainingSnapshotCounts[presetKey],
          lastAttemptAt: nowIso,
          lastCandidateEvaluation: outcome.candidateEvaluation,
          lastError: null,
          lastEvaluationAt: nowIso,
          lastIncumbentEvaluation: outcome.incumbentEvaluation,
          lastWatermarkAnsweredAt: findPresetWatermark(
            trainingSnapshotRows,
            presetKey
          ),
          newEligibleReviewsSinceLastEvaluation: 0
        };

        if (outcome.parameters) {
          promotedParameters.push(outcome.parameters);
        }
      } catch (error) {
        const message = getErrorMessage(error);

        presetErrorCount += 1;
        presetResults[presetKey] = {
          error: message,
          reason: "training-error",
          status: "failed",
          trainingReviewCount:
            dataset?.reviewCount ?? trainingSnapshotCounts[presetKey]
        };
        nextPresetProgress[presetKey] = {
          ...nextPresetProgress[presetKey],
          lastAttemptAt: nowIso,
          lastError: message
        };
      }
    }

    if (successfulEvaluationCount === 0 && presetErrorCount === 0) {
      const finalized = await finishRunWithoutEvaluation({
        database,
        nowIso,
        presetProgress: nextPresetProgress,
        runId,
        startingCacheKeyPart
      });

      if (!finalized) {
        return buildStaleRunResult(database, nowIso, totalEligibleReviews);
      }

      return {
        lastCheckAt: nowIso,
        newEligibleReviews: progressSummary.newEligibleReviewsSinceLastTraining,
        reason: "no-trainable-data",
        status: "skipped",
        totalEligibleReviews
      };
    }

    const liveEligibleReviewCounts =
      await countEligibleFsrsOptimizerReviewsByPreset(database);

    for (const presetKey of PRESET_KEYS) {
      nextPresetProgress[presetKey].newEligibleReviewsSinceLastEvaluation =
        Math.max(
          liveEligibleReviewCounts[presetKey] -
            nextPresetProgress[presetKey].eligibleReviewCountAtLastEvaluation,
          0
        );
    }

    const nextProgressSummary =
      summarizeFsrsOptimizerPresetProgress(nextPresetProgress);
    const allPresetsFailed =
      successfulEvaluationCount === 0 && presetErrorCount > 0;
    const allPresetsFailureMessage = allPresetsFailed
      ? buildPresetFailureSummary(presetResults)
      : null;
    let staleRun = false;

    await database.transaction(async (tx) => {
      const [liveSnapshot, liveCacheKeyPart] = await Promise.all([
        getFsrsOptimizerSnapshot(tx),
        getFsrsOptimizerCacheKeyPart(tx)
      ]);

      if (
        liveSnapshot.state.activeRunId !== runId ||
        liveCacheKeyPart !== startingCacheKeyPart
      ) {
        staleRun = true;

        if (liveSnapshot.state.activeRunId === runId) {
          await writeFsrsOptimizerState(
            {
              ...liveSnapshot.state,
              activeRunId: null,
              lastCheckAt: nowIso
            },
            tx,
            nowIso
          );
        }

        return;
      }

      for (const parameters of promotedParameters) {
        await writeFsrsOptimizedParametersToDatabase(parameters, tx, nowIso);
      }

      await writeFsrsOptimizerState(
        {
          ...liveSnapshot.state,
          ...nextProgressSummary,
          activeRunId: null,
          bindingVersion: getBindingPackageVersion(),
          datasetVersion: FSRS_OPTIMIZER_DATASET_VERSION,
          lastAttemptAt: nowIso,
          lastCheckAt: nowIso,
          lastSuccessfulTrainingAt:
            successfulEvaluationCount > 0
              ? nowIso
              : liveSnapshot.state.lastSuccessfulTrainingAt,
          lastTrainingError:
            allPresetsFailureMessage ??
            (successfulEvaluationCount > 0
              ? null
              : liveSnapshot.state.lastTrainingError),
          presetProgress: nextPresetProgress
        },
        tx,
        nowIso
      );
    });

    if (staleRun) {
      return buildStaleRunResult(
        database,
        nowIso,
        sumPresetCounts(liveEligibleReviewCounts)
      );
    }

    if (promotedParameters.length > 0) {
      await invalidateFsrsOptimizerCaches();
    }

    if (allPresetsFailed) {
      return {
        error: allPresetsFailureMessage!,
        failedAt: nowIso,
        lastCheckAt: nowIso,
        newEligibleReviews:
          nextProgressSummary.newEligibleReviewsSinceLastTraining,
        presetResults,
        reason: "all-presets-failed",
        status: "failed",
        totalEligibleReviews: sumPresetCounts(trainingSnapshotCounts)
      };
    }

    return {
      lastCheckAt: nowIso,
      newEligibleReviews:
        nextProgressSummary.newEligibleReviewsSinceLastTraining,
      presetResults,
      status: "trained",
      totalEligibleReviews: sumPresetCounts(trainingSnapshotCounts),
      trainedAt: nowIso
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const liveSnapshot = await getFsrsOptimizerSnapshot(database);

    if (liveSnapshot.state.activeRunId === runId) {
      const failedProgress = clonePresetProgress(presetProgress);
      const failedSummary =
        summarizeFsrsOptimizerPresetProgress(failedProgress);

      await writeFsrsOptimizerState(
        {
          ...liveSnapshot.state,
          ...failedSummary,
          activeRunId: null,
          bindingVersion: getBindingPackageVersion(),
          datasetVersion: FSRS_OPTIMIZER_DATASET_VERSION,
          lastAttemptAt: nowIso,
          lastCheckAt: nowIso,
          lastTrainingError: message,
          presetProgress: failedProgress
        },
        database,
        nowIso
      );
    }

    throw error;
  }
}

async function trainAndEvaluateFsrsPreset(input: {
  dataset: FsrsTrainingDataset;
  deadlineAt: number;
  desiredRetention: number;
  incumbentWeights: number[];
  nowIso: string;
  presetKey: FsrsPresetKey;
  split: {
    holdout: FsrsTrainingSequence[];
    training: FsrsTrainingSequence[];
  };
  trainingAdapter: FsrsTrainingAdapter;
}): Promise<{
  candidateEvaluation: FsrsModelEvaluation;
  incumbentEvaluation: FsrsModelEvaluation;
  parameters: FsrsOptimizedParameters | null;
  result: FsrsOptimizationPresetResult;
}> {
  const trainingItems = buildBindingItems(
    input.split.training.map((sequence) => sequence.reviews)
  );
  const holdoutItems = buildBindingItems(
    input.split.holdout.map((sequence) => sequence.reviews)
  );
  assertPresetDeadline(input.deadlineAt, input.presetKey, "binding-items");
  const computeTimeoutMs = resolveFsrsComputeTimeoutMs(input.deadlineAt);
  const candidateWeights = normalizeFsrsWeights(
    await waitForPresetDeadline(
      input.trainingAdapter.compute(trainingItems, computeTimeoutMs),
      input.deadlineAt,
      input.presetKey
    )
  );

  assertPresetDeadline(input.deadlineAt, input.presetKey, "training");

  if (!candidateWeights) {
    throw new Error(
      `${capitalizePresetKey(input.presetKey)} training produced invalid FSRS weights.`
    );
  }

  const candidateEvaluation = normalizeModelEvaluation(
    input.trainingAdapter.evaluate(candidateWeights, holdoutItems)
  );
  assertPresetDeadline(
    input.deadlineAt,
    input.presetKey,
    "candidate-evaluation"
  );
  const incumbentEvaluation = normalizeModelEvaluation(
    input.trainingAdapter.evaluate(input.incumbentWeights, holdoutItems)
  );
  assertPresetDeadline(
    input.deadlineAt,
    input.presetKey,
    "incumbent-evaluation"
  );
  const decision = decideFsrsCandidatePromotion({
    candidate: candidateEvaluation,
    incumbent: incumbentEvaluation
  });
  const parameters: FsrsOptimizedParameters | null = decision.promote
    ? {
        algorithmVersion: "fsrs6",
        bindingVersion: getBindingPackageVersion(),
        candidateEvaluation,
        datasetVersion: FSRS_OPTIMIZER_DATASET_VERSION,
        desiredRetention: input.desiredRetention,
        holdoutItemCount: input.split.holdout.length,
        incumbentEvaluation,
        metric: "log_loss",
        presetKey: input.presetKey,
        studyDayPolicy: getReviewStudyDayPolicyKey(),
        trainedAt: input.nowIso,
        trainingItemCount: input.split.training.length,
        trainingReviewCount: input.dataset.reviewCount,
        weights: candidateWeights
      }
    : null;

  return {
    candidateEvaluation,
    incumbentEvaluation,
    parameters,
    result: {
      candidateEvaluation,
      holdoutItemCount: input.split.holdout.length,
      incumbentEvaluation,
      reason: decision.promote ? "candidate-improved" : "candidate-not-better",
      status: decision.promote ? "trained" : "unchanged",
      trainingItemCount: input.split.training.length,
      trainingReviewCount: input.dataset.reviewCount
    }
  };
}

function resolveFsrsComputeTimeoutMs(deadlineAt: number) {
  const remainingMs = Math.max(1, deadlineAt - Date.now());

  // The native binding treats its timeout as a training budget and resolves
  // just after that budget expires with the best weights found so far. Keep a
  // separate tail for the promise handoff and both holdout evaluations instead
  // of racing the binding against an identical outer deadline.
  return Math.max(1, Math.floor(remainingMs * TRAINING_COMPUTE_BUDGET_RATIO));
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

function normalizeModelEvaluation(
  evaluation: ModelEvaluation | FsrsModelEvaluation
): FsrsModelEvaluation {
  if (
    !Number.isFinite(evaluation.logLoss) ||
    evaluation.logLoss < 0 ||
    !Number.isFinite(evaluation.rmseBins) ||
    evaluation.rmseBins < 0
  ) {
    throw new Error("FSRS evaluation produced invalid metrics.");
  }

  return {
    logLoss: evaluation.logLoss,
    rmseBins: evaluation.rmseBins
  };
}

function isFsrsPresetDatasetReady(
  dataset: FsrsTrainingDataset,
  presetKey: FsrsPresetKey,
  trainingAdapter: FsrsTrainingAdapter
) {
  const emptyDataset = { itemCount: 0, reviewCount: 0 };
  const readiness = resolveFsrsTrainingReadiness({
    conceptDataset: presetKey === "concept" ? dataset : emptyDataset,
    minimumHoldoutItemCount: trainingAdapter.minimumHoldoutItemCount,
    minimumReviewCount: trainingAdapter.minimumReviewCount,
    minimumTrainingItemCount: trainingAdapter.minimumTrainingItemCount,
    recognitionDataset: presetKey === "recognition" ? dataset : emptyDataset
  });

  return presetKey === "concept"
    ? readiness.conceptTrainable
    : readiness.recognitionTrainable;
}

function markInsufficientPresetAttempt(
  progress: FsrsOptimizerPresetProgress,
  nowIso: string
): FsrsOptimizerPresetProgress {
  return {
    ...progress,
    lastAttemptAt: nowIso,
    lastError: null
  };
}

function assertPresetDeadline(
  deadlineAt: number,
  presetKey: FsrsPresetKey,
  phase: string
) {
  if (Date.now() >= deadlineAt) {
    throw new Error(
      `${capitalizePresetKey(presetKey)} optimizer deadline exceeded during ${phase}.`
    );
  }
}

async function waitForPresetDeadline<T>(
  promise: Promise<T>,
  deadlineAt: number,
  presetKey: FsrsPresetKey
) {
  return waitForOptimizerDeadline(
    promise,
    deadlineAt,
    `${capitalizePresetKey(presetKey)} optimizer deadline exceeded during training.`
  );
}

async function waitForOptimizerDeadline<T>(
  promise: Promise<T>,
  deadlineAt: number,
  errorMessage: string
) {
  const remainingMs = deadlineAt - Date.now();

  if (remainingMs <= 0) {
    throw new Error(errorMessage);
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(errorMessage));
        }, remainingMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function buildPresetFailureSummary(
  presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult>
) {
  const failures = PRESET_KEYS.flatMap((presetKey) => {
    const result = presetResults[presetKey];

    return result.status === "failed"
      ? [`${presetKey}: ${result.error ?? "unknown error"}`]
      : [];
  });

  return `FSRS optimizer failed for every evaluated preset (${failures.join("; ")}).`;
}

function buildPresetReviewThresholds(
  minNewReviews: number,
  progress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>
) {
  return {
    concept: calculateFsrsOptimizerNewReviewThreshold({
      minNewReviews,
      totalEligibleReviewsAtLastTraining:
        progress.concept.eligibleReviewCountAtLastEvaluation
    }),
    recognition: calculateFsrsOptimizerNewReviewThreshold({
      minNewReviews,
      totalEligibleReviewsAtLastTraining:
        progress.recognition.eligibleReviewCountAtLastEvaluation
    })
  };
}

function markPlannedPresetAttempts(
  progress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>,
  plan: FsrsOptimizerPresetRunPlan,
  nowIso: string
) {
  const next = clonePresetProgress(progress);

  for (const presetKey of PRESET_KEYS) {
    if (plan[presetKey].action === "evaluate") {
      next[presetKey].lastAttemptAt = nowIso;
      next[presetKey].lastError = null;
    }
  }

  return next;
}

function clonePresetProgress(
  progress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>
): Record<FsrsPresetKey, FsrsOptimizerPresetProgress> {
  return {
    concept: { ...progress.concept },
    recognition: { ...progress.recognition }
  };
}

function countTrainingRowsByPreset(
  rows: Awaited<ReturnType<typeof loadFsrsOptimizerLogRows>>
): FsrsEligibleReviewCounts {
  const counts: FsrsEligibleReviewCounts = { concept: 0, recognition: 0 };

  for (const row of rows) {
    if ((row.eventKind ?? "grade") !== "grade" || row.rating === null) {
      continue;
    }

    if (row.cardType === "recognition" || row.cardType === "concept") {
      counts[row.cardType] += 1;
    }
  }

  return counts;
}

function findPresetWatermark(
  rows: Awaited<ReturnType<typeof loadFsrsOptimizerLogRows>>,
  presetKey: FsrsPresetKey
) {
  let watermark: string | null = null;

  for (const row of rows) {
    if (
      (row.eventKind ?? "grade") === "grade" &&
      row.rating !== null &&
      row.cardType === presetKey &&
      (watermark === null || row.answeredAt > watermark)
    ) {
      watermark = row.answeredAt;
    }
  }

  return watermark;
}

async function finishRunWithoutEvaluation(input: {
  database: DatabaseClient;
  nowIso: string;
  presetProgress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>;
  runId: string;
  startingCacheKeyPart: string;
}) {
  let finalized = false;

  await input.database.transaction(async (tx) => {
    const [liveSnapshot, liveCacheKeyPart] = await Promise.all([
      getFsrsOptimizerSnapshot(tx),
      getFsrsOptimizerCacheKeyPart(tx)
    ]);

    if (
      liveSnapshot.state.activeRunId !== input.runId ||
      liveCacheKeyPart !== input.startingCacheKeyPart
    ) {
      if (liveSnapshot.state.activeRunId === input.runId) {
        await writeFsrsOptimizerState(
          {
            ...liveSnapshot.state,
            activeRunId: null,
            lastCheckAt: input.nowIso
          },
          tx,
          input.nowIso
        );
      }

      return;
    }

    await writeFsrsOptimizerState(
      {
        ...liveSnapshot.state,
        ...summarizeFsrsOptimizerPresetProgress(input.presetProgress),
        activeRunId: null,
        lastCheckAt: input.nowIso,
        lastTrainingError: null,
        presetProgress: input.presetProgress
      },
      tx,
      input.nowIso
    );
    finalized = true;
  });

  return finalized;
}

async function buildStaleRunResult(
  database: DatabaseClient,
  nowIso: string,
  fallbackTotalEligibleReviews: number
): Promise<FsrsOptimizationRunResult> {
  try {
    const [snapshot, counts] = await Promise.all([
      getFsrsOptimizerSnapshot(database),
      countEligibleFsrsOptimizerReviewsByPreset(database)
    ]);
    const progress = resolveFsrsOptimizerPresetProgress(snapshot.state, counts);

    return {
      lastCheckAt: nowIso,
      newEligibleReviews:
        summarizeFsrsOptimizerPresetProgress(progress)
          .newEligibleReviewsSinceLastTraining,
      reason: "stale-run",
      status: "skipped",
      totalEligibleReviews: sumPresetCounts(counts)
    };
  } catch {
    return {
      lastCheckAt: nowIso,
      newEligibleReviews: 0,
      reason: "stale-run",
      status: "skipped",
      totalEligibleReviews: fallbackTotalEligibleReviews
    };
  }
}

function readTrainingTimeoutMsFromEnv() {
  const rawValue = process.env[TRAINING_TIMEOUT_ENV]?.trim();

  if (!rawValue || !/^\d+$/u.test(rawValue)) {
    return null;
  }

  const parsed = Number(rawValue);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function capitalizePresetKey(presetKey: FsrsPresetKey) {
  return presetKey === "recognition" ? "Recognition" : "Concept";
}

function sumPresetCounts(counts: FsrsEligibleReviewCounts) {
  return counts.recognition + counts.concept;
}

async function writeSkippedFsrsOptimizerState(input: {
  database: DatabaseClient;
  nowIso: string;
  presetProgress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>;
  state: FsrsOptimizerState;
}) {
  const summary = summarizeFsrsOptimizerPresetProgress(input.presetProgress);

  await writeFsrsOptimizerState(
    {
      ...input.state,
      ...summary,
      bindingVersion: getBindingPackageVersion(),
      datasetVersion: FSRS_OPTIMIZER_DATASET_VERSION,
      lastCheckAt: input.nowIso,
      presetProgress: input.presetProgress
    },
    input.database,
    input.nowIso
  );
}
