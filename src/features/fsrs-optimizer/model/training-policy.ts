import type {
  FsrsModelEvaluation,
  FsrsOptimizedParameters,
  FsrsOptimizerState,
  FsrsPresetKey
} from "./snapshot.ts";

const DAY = 24 * 60 * 60_000;
const CRON_DELIVERY_TOLERANCE_MS = 60 * 60_000;
const MIN_TRAINING_REVIEW_COUNT = 201;
const MIN_TRAINING_ITEM_COUNT = 100;
const MIN_HOLDOUT_ITEM_COUNT = 100;
const HOLDOUT_RATIO = 0.2;
const MIN_LOG_LOSS_ABSOLUTE_IMPROVEMENT = 0.0001;
const MIN_LOG_LOSS_RELATIVE_IMPROVEMENT = 0.001;
const MAX_RMSE_ABSOLUTE_REGRESSION = 0.002;
const MAX_RMSE_RELATIVE_REGRESSION = 0.02;
const INSUFFICIENT_DATA_RETRY_COOLDOWN_DAYS = 7;

export const FSRS_OPTIMIZER_DATASET_VERSION = "fsrs6-prefix-target-v2";

export type FsrsOptimizationPresetResult = {
  candidateEvaluation?: FsrsModelEvaluation;
  holdoutItemCount?: number;
  incumbentEvaluation?: FsrsModelEvaluation;
  reason?:
    | "candidate-improved"
    | "candidate-not-better"
    | "insufficient-data"
    | "not-due"
    | "training-error";
  error?: string;
  status: "failed" | "trained" | "unchanged";
  trainingItemCount?: number;
  trainingReviewCount: number;
};

export type FsrsOptimizationRunResult =
  | {
      lastCheckAt: string;
      newEligibleReviews: number;
      reason:
        | "disabled"
        | "insufficient-new-reviews"
        | "retry-cooldown"
        | "stale-run"
        | "too-soon";
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
    }
  | {
      error: string;
      failedAt: string;
      lastCheckAt: string;
      newEligibleReviews: number;
      presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult>;
      reason: "all-presets-failed";
      status: "failed";
      totalEligibleReviews: number;
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

export type FsrsOptimizerPresetRunPlan = Record<
  FsrsPresetKey,
  | { action: "evaluate" }
  | {
      action: "skip";
      reason: "insufficient-new-reviews" | "retry-cooldown" | "too-soon";
    }
>;

export type FsrsTimeSeriesItem = {
  targetAnsweredAt: string;
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

export function planFsrsOptimizerPresetRuns(input: {
  config: {
    enabled: boolean;
    minDaysBetweenRuns: number;
  };
  force: boolean;
  lastAttemptAt: Record<FsrsPresetKey, string | null>;
  lastEvaluationAt: Record<FsrsPresetKey, string | null>;
  newEligibleReviews: Record<FsrsPresetKey, number>;
  newReviewThreshold: Record<FsrsPresetKey, number>;
  now: Date;
}):
  | {
      action: "skip";
      reason:
        | "disabled"
        | "insufficient-new-reviews"
        | "retry-cooldown"
        | "too-soon";
    }
  | { action: "evaluate"; presets: FsrsOptimizerPresetRunPlan } {
  if (!input.force && !input.config.enabled) {
    return { action: "skip", reason: "disabled" };
  }

  const plans = {} as FsrsOptimizerPresetRunPlan;
  let hasEvaluation = false;

  for (const presetKey of ["recognition", "concept"] as const) {
    if (input.force) {
      plans[presetKey] = { action: "evaluate" };
      hasEvaluation = true;
      continue;
    }

    const lastEvaluationAt = input.lastEvaluationAt[presetKey];
    const tooSoon =
      lastEvaluationAt !== null &&
      input.now.getTime() - new Date(lastEvaluationAt).getTime() <
        input.config.minDaysBetweenRuns * DAY - CRON_DELIVERY_TOLERANCE_MS;

    if (tooSoon) {
      plans[presetKey] = { action: "skip", reason: "too-soon" };
      continue;
    }

    const lastAttemptAt = input.lastAttemptAt[presetKey];
    const attemptWasNotEvaluated =
      lastAttemptAt !== null &&
      (lastEvaluationAt === null || lastAttemptAt > lastEvaluationAt);
    const retryCooldownDays = Math.min(
      INSUFFICIENT_DATA_RETRY_COOLDOWN_DAYS,
      Math.max(1, input.config.minDaysBetweenRuns)
    );
    const retryCooldownActive =
      attemptWasNotEvaluated &&
      input.now.getTime() - new Date(lastAttemptAt).getTime() <
        retryCooldownDays * DAY - CRON_DELIVERY_TOLERANCE_MS;

    if (retryCooldownActive) {
      plans[presetKey] = { action: "skip", reason: "retry-cooldown" };
      continue;
    }

    if (
      input.newEligibleReviews[presetKey] < input.newReviewThreshold[presetKey]
    ) {
      plans[presetKey] = {
        action: "skip",
        reason: "insufficient-new-reviews"
      };
      continue;
    }

    plans[presetKey] = { action: "evaluate" };
    hasEvaluation = true;
  }

  if (!hasEvaluation) {
    const hasSkipReason = (reason: "retry-cooldown" | "too-soon") =>
      (["recognition", "concept"] as const).some((presetKey) => {
        const plan = plans[presetKey];

        return plan.action === "skip" && plan.reason === reason;
      });

    return {
      action: "skip",
      reason: hasSkipReason("too-soon")
        ? "too-soon"
        : hasSkipReason("retry-cooldown")
          ? "retry-cooldown"
          : "insufficient-new-reviews"
    };
  }

  return { action: "evaluate", presets: plans };
}

export function resolveFsrsTrainingReadiness(input: {
  conceptDataset: FsrsTrainingDatasetStats;
  minimumHoldoutItemCount?: number;
  minimumReviewCount?: number;
  minimumTrainingItemCount?: number;
  recognitionDataset: FsrsTrainingDatasetStats;
}) {
  const minimumHoldoutItemCount =
    input.minimumHoldoutItemCount ?? MIN_HOLDOUT_ITEM_COUNT;
  const minimumReviewCount =
    input.minimumReviewCount ?? MIN_TRAINING_REVIEW_COUNT;
  const minimumTrainingItemCount =
    input.minimumTrainingItemCount ?? MIN_TRAINING_ITEM_COUNT;
  const recognitionTrainable =
    input.recognitionDataset.itemCount >=
      minimumTrainingItemCount + minimumHoldoutItemCount &&
    input.recognitionDataset.reviewCount >= minimumReviewCount;
  const conceptTrainable =
    input.conceptDataset.itemCount >=
      minimumTrainingItemCount + minimumHoldoutItemCount &&
    input.conceptDataset.reviewCount >= minimumReviewCount;

  return {
    conceptTrainable,
    hasTrainableData: recognitionTrainable || conceptTrainable,
    recognitionTrainable
  };
}

export function splitFsrsTimeSeries<T extends FsrsTimeSeriesItem>(
  items: T[],
  minimums: {
    holdoutItemCount?: number;
    trainingItemCount?: number;
  } = {}
) {
  const minimumHoldoutItemCount =
    minimums.holdoutItemCount ?? MIN_HOLDOUT_ITEM_COUNT;
  const minimumTrainingItemCount =
    minimums.trainingItemCount ?? MIN_TRAINING_ITEM_COUNT;

  if (items.length < minimumTrainingItemCount + minimumHoldoutItemCount) {
    return null;
  }

  const ordered = [...items].sort((left, right) =>
    left.targetAnsweredAt.localeCompare(right.targetAnsweredAt)
  );
  const desiredHoldoutCount = Math.max(
    minimumHoldoutItemCount,
    Math.ceil(ordered.length * HOLDOUT_RATIO)
  );
  let splitIndex = ordered.length - desiredHoldoutCount;
  const splitTimestamp = ordered[splitIndex]?.targetAnsweredAt;

  while (
    splitIndex > 0 &&
    ordered[splitIndex - 1]?.targetAnsweredAt === splitTimestamp
  ) {
    splitIndex -= 1;
  }

  const training = ordered.slice(0, splitIndex);
  const holdout = ordered.slice(splitIndex);

  if (
    training.length < minimumTrainingItemCount ||
    holdout.length < minimumHoldoutItemCount
  ) {
    return null;
  }

  return { holdout, training };
}

export function decideFsrsCandidatePromotion(input: {
  candidate: FsrsModelEvaluation;
  incumbent: FsrsModelEvaluation;
}) {
  if (
    !isFiniteEvaluation(input.candidate) ||
    !isFiniteEvaluation(input.incumbent)
  ) {
    return {
      promote: false,
      reason: "invalid-evaluation" as const
    };
  }

  const requiredLogLossImprovement = Math.max(
    MIN_LOG_LOSS_ABSOLUTE_IMPROVEMENT,
    Math.abs(input.incumbent.logLoss) * MIN_LOG_LOSS_RELATIVE_IMPROVEMENT
  );
  const allowedRmseRegression = Math.max(
    MAX_RMSE_ABSOLUTE_REGRESSION,
    Math.abs(input.incumbent.rmseBins) * MAX_RMSE_RELATIVE_REGRESSION
  );
  const logLossImproved =
    input.candidate.logLoss <=
    input.incumbent.logLoss - requiredLogLossImprovement;
  const rmseWithinGuardrail =
    input.candidate.rmseBins <=
    input.incumbent.rmseBins + allowedRmseRegression;

  return {
    promote: logLossImproved && rmseWithinGuardrail,
    reason:
      logLossImproved && rmseWithinGuardrail
        ? ("candidate-improved" as const)
        : ("candidate-not-better" as const)
  };
}

export function buildInitialFsrsOptimizationPresetResults(input: {
  conceptTrainingReviewCount: number;
  recognitionTrainingReviewCount: number;
}): Record<FsrsPresetKey, FsrsOptimizationPresetResult> {
  return {
    concept: {
      reason: "not-due",
      status: "unchanged",
      trainingReviewCount: input.conceptTrainingReviewCount
    },
    recognition: {
      reason: "not-due",
      status: "unchanged",
      trainingReviewCount: input.recognitionTrainingReviewCount
    }
  };
}

function isFiniteEvaluation(value: FsrsModelEvaluation) {
  return (
    Number.isFinite(value.logLoss) &&
    value.logLoss >= 0 &&
    Number.isFinite(value.rmseBins) &&
    value.rmseBins >= 0
  );
}

export function markFsrsOptimizationPresetTrained(
  presetResults: Record<FsrsPresetKey, FsrsOptimizationPresetResult>,
  parameters: FsrsOptimizedParameters | null
) {
  if (parameters) {
    presetResults[parameters.presetKey].status = "trained";
  }
}
