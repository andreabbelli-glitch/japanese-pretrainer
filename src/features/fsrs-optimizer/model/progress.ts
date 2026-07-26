import type {
  FsrsOptimizerPresetProgress,
  FsrsOptimizerState,
  FsrsPresetKey
} from "./snapshot.ts";

export type FsrsEligibleReviewCounts = Record<FsrsPresetKey, number>;

export function resolveFsrsOptimizerPresetProgress(
  state: FsrsOptimizerState,
  counts: FsrsEligibleReviewCounts
): Record<FsrsPresetKey, FsrsOptimizerPresetProgress> {
  const legacyBaselines = state.presetProgress
    ? null
    : distributeLegacyBaseline(
        state.totalEligibleReviewsAtLastTraining,
        counts
      );

  return {
    concept: resolvePresetProgress("concept", state, counts, legacyBaselines),
    recognition: resolvePresetProgress(
      "recognition",
      state,
      counts,
      legacyBaselines
    )
  };
}

export function summarizeFsrsOptimizerPresetProgress(
  progress: Record<FsrsPresetKey, FsrsOptimizerPresetProgress>
) {
  return {
    newEligibleReviewsSinceLastTraining:
      progress.recognition.newEligibleReviewsSinceLastEvaluation +
      progress.concept.newEligibleReviewsSinceLastEvaluation,
    totalEligibleReviewsAtLastTraining:
      progress.recognition.eligibleReviewCountAtLastEvaluation +
      progress.concept.eligibleReviewCountAtLastEvaluation
  };
}

function resolvePresetProgress(
  presetKey: FsrsPresetKey,
  state: FsrsOptimizerState,
  counts: FsrsEligibleReviewCounts,
  legacyBaselines: FsrsEligibleReviewCounts | null
): FsrsOptimizerPresetProgress {
  const stored = state.presetProgress?.[presetKey];
  const eligibleReviewCountAtLastEvaluation = Math.min(
    counts[presetKey],
    Math.max(
      0,
      stored?.eligibleReviewCountAtLastEvaluation ??
        legacyBaselines?.[presetKey] ??
        0
    )
  );

  return {
    eligibleReviewCountAtLastEvaluation,
    lastCandidateEvaluation: stored?.lastCandidateEvaluation ?? null,
    lastError: stored?.lastError ?? null,
    lastEvaluationAt:
      stored?.lastEvaluationAt ?? state.lastSuccessfulTrainingAt,
    lastIncumbentEvaluation: stored?.lastIncumbentEvaluation ?? null,
    lastAttemptAt: stored?.lastAttemptAt ?? state.lastAttemptAt,
    lastWatermarkAnsweredAt: stored?.lastWatermarkAnsweredAt ?? null,
    newEligibleReviewsSinceLastEvaluation: Math.max(
      counts[presetKey] - eligibleReviewCountAtLastEvaluation,
      0
    )
  };
}

function distributeLegacyBaseline(
  baseline: number,
  counts: FsrsEligibleReviewCounts
): FsrsEligibleReviewCounts {
  const totalCount = counts.recognition + counts.concept;
  const boundedBaseline = Math.min(Math.max(0, baseline), totalCount);

  if (totalCount === 0 || boundedBaseline === 0) {
    return { concept: 0, recognition: 0 };
  }

  let recognition = Math.min(
    counts.recognition,
    Math.floor((boundedBaseline * counts.recognition) / totalCount)
  );
  let concept = Math.min(counts.concept, boundedBaseline - recognition);
  let remaining = boundedBaseline - recognition - concept;

  if (remaining > 0) {
    const recognitionCapacity = counts.recognition - recognition;
    const recognitionIncrement = Math.min(remaining, recognitionCapacity);

    recognition += recognitionIncrement;
    remaining -= recognitionIncrement;
  }

  if (remaining > 0) {
    concept += Math.min(remaining, counts.concept - concept);
  }

  return { concept, recognition };
}
