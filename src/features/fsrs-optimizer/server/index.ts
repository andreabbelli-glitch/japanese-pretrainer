import { db, type DatabaseClient } from "../../../db/index.ts";
import {
  type FsrsOptimizedParameters,
  type FsrsOptimizerConfig,
  type FsrsOptimizerState,
  type FsrsPresetKey
} from "../model/snapshot.ts";
import {
  calculateFsrsOptimizerNewReviewThreshold,
  getFsrsOptimizerSnapshot
} from "./settings-store.ts";
import { countEligibleFsrsOptimizerReviews } from "./training-data.ts";

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
  getFsrsOptimizerCacheKeyPart,
  getFsrsOptimizerConfigDefaults,
  getFsrsOptimizerRuntimeContext,
  getFsrsOptimizerRuntimeSnapshot,
  getFsrsOptimizerSnapshot,
  invalidateFsrsOptimizerRuntimeContextCache,
  normalizeFsrsWeights,
  writeFsrsOptimizedParameters,
  writeFsrsOptimizerConfig,
  writeFsrsOptimizerState
} from "./settings-store.ts";
export {
  buildFsrsTrainingDataset,
  countEligibleFsrsOptimizerReviews,
  loadFsrsOptimizerLogRows
} from "./training-data.ts";
export {
  applyFsrsReschedule,
  buildFsrsReschedulePreview
} from "./reschedule.ts";
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
