import type { ReviewSeedState } from "../../review/model/grade-previews.ts";

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

export type FsrsOptimizerSeedSnapshot = Pick<
  FsrsOptimizerSnapshot,
  "config" | "presets"
>;

export const DEFAULT_FSRS_OPTIMIZER_CONFIG: FsrsOptimizerConfig = {
  desiredRetention: 0.9,
  enabled: true,
  minDaysBetweenRuns: 30,
  minNewReviews: 500,
  presetStrategy: "card_type_v1"
};

export const DEFAULT_FSRS_OPTIMIZER_SEED_SNAPSHOT: FsrsOptimizerSeedSnapshot = {
  config: DEFAULT_FSRS_OPTIMIZER_CONFIG,
  presets: {
    concept: null,
    recognition: null
  }
};

export function resolveFsrsPresetKey(cardType: string): FsrsPresetKey | null {
  if (cardType === "recognition" || cardType === "concept") {
    return cardType;
  }

  return null;
}

export function buildReviewSeedStateWithFsrsPreset(
  reviewSeedState: ReviewSeedState,
  cardType: string,
  snapshot: FsrsOptimizerSeedSnapshot
): ReviewSeedState {
  const presetKey = resolveFsrsPresetKey(cardType);
  const preset = presetKey ? snapshot.presets[presetKey] : null;

  return {
    ...reviewSeedState,
    fsrsDesiredRetention: snapshot.config.desiredRetention,
    fsrsWeights: preset?.weights ?? null
  };
}
