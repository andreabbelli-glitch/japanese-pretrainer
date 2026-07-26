import { db, type DatabaseClient } from "../../../db/index.ts";
import {
  type FsrsOptimizedParameters,
  type FsrsOptimizerConfig,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import {
  resolveFsrsOptimizerPresetProgress,
  summarizeFsrsOptimizerPresetProgress
} from "../model/progress.ts";
import {
  calculateFsrsOptimizerNewReviewThreshold,
  getFsrsOptimizerSnapshot
} from "./settings-store.ts";
import { countEligibleFsrsOptimizerReviewsByPreset } from "./training-data.ts";

export {
  buildReviewSeedStateWithFsrsPreset,
  DEFAULT_FSRS_OPTIMIZER_CONFIG,
  resolveFsrsPresetKey
} from "../model/snapshot.ts";
export type {
  FsrsOptimizedParameters,
  FsrsOptimizerConfig,
  FsrsOptimizerSnapshot,
  FsrsOptimizerState,
  FsrsPresetKey
} from "../model/snapshot.ts";
export type {
  FsrsOptimizationPresetResult,
  FsrsOptimizationRunResult
} from "../model/training-policy.ts";
export {
  FSRS_OPTIMIZER_CONFIG_KEY,
  FSRS_OPTIMIZER_STATE_KEY,
  FSRS_PARAMS_CONCEPT_KEY,
  FSRS_PARAMS_RECOGNITION_KEY,
  buildDefaultFsrsOptimizerSnapshot,
  calculateFsrsOptimizerNewReviewThreshold,
  getBindingPackageVersion,
  getFreshFsrsOptimizerTrainingContext,
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerConfigDefaults,
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerRuntimeSnapshot,
  getFsrsOptimizerSnapshot,
  invalidateFsrsOptimizerCaches,
  invalidateFsrsOptimizerRuntimeContextCache,
  normalizeFsrsWeights,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizedParametersToDatabase,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState
} from "./settings-store.ts";
export {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviews,
  countEligibleFsrsOptimizerReviewsByPreset,
  loadFsrsOptimizerLogRows
} from "./training-data.ts";
export {
  applyFsrsReschedule,
  buildFsrsReschedulePreview
} from "./reschedule.ts";
export {
  buildFsrsParameterSet,
  persistFsrsParameterSet,
  persistFsrsParameterSetsForSnapshot
} from "./parameter-set.ts";
export type {
  FsrsOptimizerLogRow,
  FsrsTrainingDataset,
  FsrsTrainingReview
} from "./training-data.ts";
export type {
  FsrsRescheduleApplyResult,
  FsrsRescheduleDayDelta,
  FsrsReschedulePreview
} from "./reschedule.ts";

export type FsrsOptimizerPresetStatus = {
  desiredRetention: number;
  eligibleReviewCount?: number;
  lastError?: string | null;
  lastEvaluationAt?: string | null;
  newEligibleReviews?: number;
  nextTrainingNewReviewThreshold?: number;
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

export async function getFsrsOptimizerStatus(
  database: DatabaseClient = db
): Promise<FsrsOptimizerStatus> {
  const [snapshot, eligibleReviewCounts] = await Promise.all([
    getFsrsOptimizerSnapshot(database),
    countEligibleFsrsOptimizerReviewsByPreset(database)
  ]);
  const totalEligibleReviews =
    eligibleReviewCounts.recognition + eligibleReviewCounts.concept;
  const presetProgress = resolveFsrsOptimizerPresetProgress(
    snapshot.state,
    eligibleReviewCounts
  );
  const stateSummary = summarizeFsrsOptimizerPresetProgress(presetProgress);
  const presetThresholds = {
    concept: calculateFsrsOptimizerNewReviewThreshold({
      minNewReviews: snapshot.config.minNewReviews,
      totalEligibleReviewsAtLastTraining:
        presetProgress.concept.eligibleReviewCountAtLastEvaluation
    }),
    recognition: calculateFsrsOptimizerNewReviewThreshold({
      minNewReviews: snapshot.config.minNewReviews,
      totalEligibleReviewsAtLastTraining:
        presetProgress.recognition.eligibleReviewCountAtLastEvaluation
    })
  };

  return {
    config: snapshot.config,
    newEligibleReviews: stateSummary.newEligibleReviewsSinceLastTraining,
    nextTrainingNewReviewThreshold: Math.min(
      presetThresholds.recognition,
      presetThresholds.concept
    ),
    presets: {
      concept: buildPresetStatus(
        "concept",
        snapshot.config.desiredRetention,
        snapshot.presets.concept,
        eligibleReviewCounts.concept,
        presetProgress.concept,
        presetThresholds.concept
      ),
      recognition: buildPresetStatus(
        "recognition",
        snapshot.config.desiredRetention,
        snapshot.presets.recognition,
        eligibleReviewCounts.recognition,
        presetProgress.recognition,
        presetThresholds.recognition
      )
    },
    state: {
      ...snapshot.state,
      ...stateSummary,
      presetProgress
    },
    totalEligibleReviews
  };
}

function buildPresetStatus(
  presetKey: FsrsPresetKey,
  desiredRetention: number,
  parameters: FsrsOptimizedParameters | null,
  eligibleReviewCount: number,
  progress: NonNullable<FsrsOptimizerState["presetProgress"]>[FsrsPresetKey],
  nextTrainingNewReviewThreshold: number
): FsrsOptimizerPresetStatus {
  return {
    desiredRetention,
    eligibleReviewCount,
    lastError: progress?.lastError ?? null,
    lastEvaluationAt: progress?.lastEvaluationAt ?? null,
    newEligibleReviews:
      progress?.newEligibleReviewsSinceLastEvaluation ?? eligibleReviewCount,
    nextTrainingNewReviewThreshold,
    presetKey,
    trainedAt: parameters?.trainedAt ?? null,
    trainingReviewCount: parameters?.trainingReviewCount ?? 0,
    usesOptimizedParameters: parameters !== null
  };
}
