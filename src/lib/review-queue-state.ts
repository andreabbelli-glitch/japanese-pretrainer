import { formatReviewStateLabel } from "@/lib/study-format";

import {
  isReviewCardDue,
  isReviewCardNew,
  resolveEffectiveReviewState,
  type EffectiveReviewState
} from "./review-model";
import { type ReviewState } from "./review-scheduler";
import type { ReviewSubjectStateSnapshot } from "./review-subject";
import type { ReviewQueueCard } from "./review-types";

export type ReviewQueueStateSnapshot = {
  bucket: ReviewQueueCard["bucket"];
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  rawReviewLabel: string;
  reviewSeedState: ReviewQueueCard["reviewSeedState"];
};

export function resolveReviewQueueState(
  cardStatus: string,
  reviewState: ReviewSubjectStateSnapshot | null,
  nowIso: string
): ReviewQueueStateSnapshot {
  const effectiveState = resolveEffectiveReviewState({
    cardStatus,
    reviewState: reviewState
      ? {
          manualOverride: reviewState.manualOverride,
          suspended: reviewState.suspended,
          state: reviewState.state as ReviewState
        }
      : null
  });
  const rawReviewLabel = formatReviewStateLabel(
    reviewState?.state ?? null,
    reviewState?.manualOverride ?? false
  );
  const dueAt = reviewState?.dueAt ?? null;

  return {
    bucket: resolveCardBucket({
      asOfIso: nowIso,
      dueAt,
      effectiveState: effectiveState.state,
      reviewState: (reviewState?.state as ReviewState | null) ?? null
    }),
    dueAt,
    effectiveState: effectiveState.state,
    rawReviewLabel,
    reviewSeedState: {
      difficulty: reviewState?.difficulty ?? null,
      dueAt: reviewState?.dueAt ?? null,
      lapses: reviewState?.lapses ?? 0,
      lastReviewedAt: reviewState?.lastReviewedAt ?? null,
      learningSteps: reviewState?.learningSteps ?? 0,
      reps: reviewState?.reps ?? 0,
      scheduledDays: reviewState?.scheduledDays ?? 0,
      stability: reviewState?.stability ?? null,
      state: (reviewState?.state as ReviewState | null) ?? null
    }
  };
}

function resolveCardBucket(input: {
  asOfIso: string;
  dueAt: string | null;
  effectiveState: EffectiveReviewState["state"];
  reviewState: ReviewState | null;
}): ReviewQueueCard["bucket"] {
  if (input.effectiveState === "suspended") {
    return "suspended";
  }

  if (input.effectiveState === "known_manual") {
    return "manual";
  }

  if (
    isReviewCardDue({
      asOfIso: input.asOfIso,
      dueAt: input.dueAt,
      effectiveState: input.effectiveState,
      reviewState: input.reviewState
    })
  ) {
    return "due";
  }

  if (isReviewCardNew(input.reviewState)) {
    return "new";
  }

  return "upcoming";
}
