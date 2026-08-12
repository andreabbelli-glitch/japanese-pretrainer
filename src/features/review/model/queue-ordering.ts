import { forgetting_curve } from "ts-fsrs";

import type { FsrsOptimizerSeedSnapshot } from "@/features/fsrs-optimizer/model/snapshot";
import { reviewSchedulerConfig } from "@/features/review/model/scheduler";
import type { ReviewSubjectModel } from "@/features/review/model/queue-types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
// Bump this whenever ordering semantics change so Vercel cannot serve a stale first candidate.
export const REVIEW_QUEUE_ORDERING_VERSION = "mastery-first-v2";

export type ReviewQueueOrderingContext = {
  fsrsOptimizerSnapshot?: FsrsOptimizerSeedSnapshot;
  nowIso: string;
  stableOrderBySubjectKey?: ReadonlyMap<string, number>;
};

type ReviewSubjectRecallRank = {
  difficulty: number | null;
  retrievability: number | null;
  stability: number | null;
};

export function sortDueReviewSubjectModelsEasiestFirst(
  models: ReviewSubjectModel[],
  context: ReviewQueueOrderingContext
) {
  const rankByModel = new Map(
    models.map((model) => [model, buildReviewSubjectRecallRank(model, context)])
  );

  models.sort((left, right) =>
    compareDueReviewSubjectModels(
      left,
      right,
      rankByModel.get(left)!,
      rankByModel.get(right)!,
      context.stableOrderBySubjectKey
    )
  );
}

export function sortReviewSubjectModelsByDueTime(
  models: ReviewSubjectModel[],
  stableOrderBySubjectKey?: ReadonlyMap<string, number>
) {
  models.sort((left, right) => {
    const dueTimeDifference = compareReviewSubjectModelsByDueTime(
      left,
      right,
      false
    );

    return (
      dueTimeDifference ||
      compareReviewSubjectModelsByCanonicalOrder(
        left,
        right,
        stableOrderBySubjectKey
      ) ||
      compareReviewSubjectModelsByStableFallback(left, right)
    );
  });
}

export function calculateReviewSubjectRetrievability(
  model: ReviewSubjectModel,
  context: ReviewQueueOrderingContext
) {
  const state = model.group.subjectState;
  const stability = normalizeFiniteNumber(state?.stability);
  const lastReviewedAt = state?.lastReviewedAt ?? null;

  if (
    stability === null ||
    stability <= 0 ||
    !lastReviewedAt ||
    !Number.isFinite(new Date(lastReviewedAt).getTime())
  ) {
    return null;
  }

  const elapsedDays = calculateExactElapsedDays(lastReviewedAt, context.nowIso);

  if (elapsedDays === null || !Number.isFinite(elapsedDays)) {
    return null;
  }

  const recallTask = model.group.identity.recallTask;
  const preset =
    recallTask === "recognition" || recallTask === "concept"
      ? context.fsrsOptimizerSnapshot?.presets[recallTask]
      : null;
  const weights = preset?.weights ?? reviewSchedulerConfig.fsrs.w;

  try {
    const retrievability = forgetting_curve(weights, elapsedDays, stability);

    return Number.isFinite(retrievability) ? retrievability : null;
  } catch {
    return null;
  }
}

function calculateExactElapsedDays(lastReviewedAt: string, nowIso: string) {
  const lastReviewedTime = new Date(lastReviewedAt).getTime();
  const nowTime = new Date(nowIso).getTime();

  if (!Number.isFinite(lastReviewedTime) || !Number.isFinite(nowTime)) {
    return null;
  }

  return Math.max(0, (nowTime - lastReviewedTime) / MILLISECONDS_PER_DAY);
}

export function isIntradayLearningModel(model: ReviewSubjectModel) {
  const subjectState = model.group.subjectState;

  return (
    (subjectState?.state === "learning" ||
      subjectState?.state === "relearning") &&
    (subjectState.scheduledDays ?? 0) === 0 &&
    model.queueStateSnapshot.dueAt !== null
  );
}

function buildReviewSubjectRecallRank(
  model: ReviewSubjectModel,
  context: ReviewQueueOrderingContext
): ReviewSubjectRecallRank {
  const state = model.group.subjectState;

  return {
    difficulty: normalizeFiniteNumber(state?.difficulty),
    retrievability: calculateReviewSubjectRetrievability(model, context),
    stability: normalizeFiniteNumber(state?.stability)
  };
}

function compareDueReviewSubjectModels(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel,
  leftRank: ReviewSubjectRecallRank,
  rightRank: ReviewSubjectRecallRank,
  stableOrderBySubjectKey?: ReadonlyMap<string, number>
) {
  const leftIsTransient = isTransientLearningModel(left);
  const rightIsTransient = isTransientLearningModel(right);

  if (leftIsTransient !== rightIsTransient) {
    return leftIsTransient ? 1 : -1;
  }

  if (leftIsTransient) {
    return compareDueTransientReviewSubjectModels(
      left,
      right,
      leftRank,
      rightRank,
      stableOrderBySubjectKey
    );
  }

  if (leftRank.retrievability === null && rightRank.retrievability === null) {
    return (
      compareReviewSubjectModelsByDueTime(left, right, false) ||
      compareReviewSubjectModelsByCanonicalOrder(
        left,
        right,
        stableOrderBySubjectKey
      ) ||
      compareReviewSubjectModelsByStableFallback(left, right)
    );
  }

  const retrievabilityDifference = compareNullableNumbers(
    leftRank.retrievability,
    rightRank.retrievability,
    "descending"
  );

  if (retrievabilityDifference !== 0) {
    return retrievabilityDifference;
  }

  const difficultyDifference = compareNullableNumbers(
    leftRank.difficulty,
    rightRank.difficulty,
    "ascending"
  );

  if (difficultyDifference !== 0) {
    return difficultyDifference;
  }

  const stabilityDifference = compareNullableNumbers(
    leftRank.stability,
    rightRank.stability,
    "descending"
  );

  if (stabilityDifference !== 0) {
    return stabilityDifference;
  }

  const dueAtDifference = (right.queueStateSnapshot.dueAt ?? "").localeCompare(
    left.queueStateSnapshot.dueAt ?? ""
  );

  if (dueAtDifference !== 0) {
    return dueAtDifference;
  }

  const canonicalOrderDifference = compareReviewSubjectModelsByCanonicalOrder(
    left,
    right,
    stableOrderBySubjectKey
  );

  if (canonicalOrderDifference !== 0) {
    return canonicalOrderDifference;
  }

  return compareReviewSubjectModelsByStableFallback(left, right);
}

function compareDueTransientReviewSubjectModels(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel,
  leftRank: ReviewSubjectRecallRank,
  rightRank: ReviewSubjectRecallRank,
  stableOrderBySubjectKey?: ReadonlyMap<string, number>
) {
  const difficultyDifference = compareNullableNumbers(
    leftRank.difficulty,
    rightRank.difficulty,
    "ascending"
  );

  if (difficultyDifference !== 0) {
    return difficultyDifference;
  }

  const retrievabilityDifference = compareNullableNumbers(
    leftRank.retrievability,
    rightRank.retrievability,
    "descending"
  );

  if (retrievabilityDifference !== 0) {
    return retrievabilityDifference;
  }

  const stabilityDifference = compareNullableNumbers(
    leftRank.stability,
    rightRank.stability,
    "descending"
  );

  if (stabilityDifference !== 0) {
    return stabilityDifference;
  }

  const dueAtDifference = (right.queueStateSnapshot.dueAt ?? "").localeCompare(
    left.queueStateSnapshot.dueAt ?? ""
  );

  if (dueAtDifference !== 0) {
    return dueAtDifference;
  }

  return (
    compareReviewSubjectModelsByCanonicalOrder(
      left,
      right,
      stableOrderBySubjectKey
    ) || compareReviewSubjectModelsByStableFallback(left, right)
  );
}

function isTransientLearningModel(model: ReviewSubjectModel) {
  const state = model.group.subjectState?.state;

  return state === "learning" || state === "relearning";
}

function compareReviewSubjectModelsByDueTime(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel,
  includeStableFallback = true
) {
  if (
    (left.queueStateSnapshot.dueAt ?? "") !==
    (right.queueStateSnapshot.dueAt ?? "")
  ) {
    return (left.queueStateSnapshot.dueAt ?? "9999").localeCompare(
      right.queueStateSnapshot.dueAt ?? "9999"
    );
  }

  return includeStableFallback
    ? compareReviewSubjectModelsByStableFallback(left, right)
    : 0;
}

function compareReviewSubjectModelsByCanonicalOrder(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel,
  stableOrderBySubjectKey?: ReadonlyMap<string, number>
) {
  if (!stableOrderBySubjectKey) {
    return 0;
  }

  return (
    (stableOrderBySubjectKey.get(left.group.identity.subjectKey) ??
      Number.MAX_SAFE_INTEGER) -
    (stableOrderBySubjectKey.get(right.group.identity.subjectKey) ??
      Number.MAX_SAFE_INTEGER)
  );
}

function compareReviewSubjectModelsByStableFallback(
  left: ReviewSubjectModel,
  right: ReviewSubjectModel
) {
  const interactionDifference = right.group.lastInteractionAt.localeCompare(
    left.group.lastInteractionAt
  );

  if (interactionDifference !== 0) {
    return interactionDifference;
  }

  const orderDifference =
    (left.card.orderIndex ?? Number.MAX_SAFE_INTEGER) -
    (right.card.orderIndex ?? Number.MAX_SAFE_INTEGER);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  const createdAtDifference = left.card.createdAt.localeCompare(
    right.card.createdAt
  );

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return left.group.identity.subjectKey.localeCompare(
    right.group.identity.subjectKey
  );
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "ascending" | "descending"
) {
  if (left === null || right === null) {
    if (left === right) {
      return 0;
    }

    return left === null ? 1 : -1;
  }

  return direction === "ascending" ? left - right : right - left;
}

function normalizeFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
