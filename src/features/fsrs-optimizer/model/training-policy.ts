import type {
  FsrsOptimizedParameters,
  FsrsOptimizerState,
  FsrsPresetKey
} from "./snapshot.ts";

const DAY = 24 * 60 * 60_000;
const CRON_DELIVERY_TOLERANCE_MS = 60 * 60_000;
const MIN_TRAINING_REVIEW_COUNT = 10;
const MIN_TRAINING_ITEM_COUNT = 5;

export type FsrsOptimizationPresetResult = {
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

export type FsrsOptimizerRunPlan =
  | {
      action: "skip";
      reason: Extract<
        FsrsOptimizationRunResult,
        { status: "skipped" }
      >["reason"];
    }
  | {
      action: "train";
    };

export type FsrsTrainingDatasetStats = {
  itemCount: number;
  reviewCount: number;
};

export function planFsrsOptimizerRun(input: {
  config: {
    enabled: boolean;
    minDaysBetweenRuns: number;
  };
  force: boolean;
  newEligibleReviews: number;
  newReviewThreshold: number;
  now: Date;
  state: Pick<FsrsOptimizerState, "lastSuccessfulTrainingAt">;
}): FsrsOptimizerRunPlan {
  if (!input.force && !input.config.enabled) {
    return {
      action: "skip",
      reason: "disabled"
    };
  }

  if (
    !input.force &&
    input.state.lastSuccessfulTrainingAt &&
    input.now.getTime() -
      new Date(input.state.lastSuccessfulTrainingAt).getTime() <
      input.config.minDaysBetweenRuns * DAY - CRON_DELIVERY_TOLERANCE_MS
  ) {
    return {
      action: "skip",
      reason: "too-soon"
    };
  }

  if (!input.force && input.newEligibleReviews < input.newReviewThreshold) {
    return {
      action: "skip",
      reason: "insufficient-new-reviews"
    };
  }

  return {
    action: "train"
  };
}

export function resolveFsrsTrainingReadiness(input: {
  conceptDataset: FsrsTrainingDatasetStats;
  recognitionDataset: FsrsTrainingDatasetStats;
}) {
  const recognitionTrainable =
    input.recognitionDataset.itemCount >= MIN_TRAINING_ITEM_COUNT &&
    input.recognitionDataset.reviewCount >= MIN_TRAINING_REVIEW_COUNT;
  const conceptTrainable =
    input.conceptDataset.itemCount >= MIN_TRAINING_ITEM_COUNT &&
    input.conceptDataset.reviewCount >= MIN_TRAINING_REVIEW_COUNT;

  return {
    conceptTrainable,
    hasTrainableData: recognitionTrainable || conceptTrainable,
    recognitionTrainable
  };
}

export function buildInitialFsrsOptimizationPresetResults(input: {
  conceptTrainingReviewCount: number;
  recognitionTrainingReviewCount: number;
}): Record<FsrsPresetKey, FsrsOptimizationPresetResult> {
  return {
    concept: {
      status: "unchanged",
      trainingReviewCount: input.conceptTrainingReviewCount
    },
    recognition: {
      status: "unchanged",
      trainingReviewCount: input.recognitionTrainingReviewCount
    }
  };
}

export function markFsrsOptimizationPresetTrained(
  presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult>,
  parameters: FsrsOptimizedParameters | null
) {
  if (parameters) {
    presetResults[parameters.presetKey].status = "trained";
  }
}
