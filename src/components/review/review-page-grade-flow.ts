import type {
  ReviewForcedContrastPayload,
  ReviewPageData,
  ReviewQueueCard,
  ReviewSessionInput
} from "@/features/review/client";

import {
  buildOptimisticFirstCandidateGradeResult,
  buildOptimisticGradeResult,
  isReviewPageData,
  resolveOptimisticReviewAdvanceCardForClientData,
  resolveReviewAdvanceCandidateQueuePosition,
  type ReviewGradeValue
} from "./review-page-helpers";
import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "./review-page-state";

export type ReviewGradeSessionActionInput = ReviewSessionInput & {
  rating: ReviewGradeValue;
};

type ReviewGradeSubmissionPlanBase = {
  actionInput: ReviewGradeSessionActionInput;
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  isBlockingGradeSubmission: boolean;
};

export type ReviewGradeSubmissionPlan =
  | {
      forcedKanjiClashContrast: ReviewForcedContrastPayload;
      kind: "blocked";
      reason: "pending-forced-contrast";
    }
  | ({
      kind: "preserve-card";
    } & ReviewGradeSubmissionPlanBase)
  | ({
      canOptimisticallyAdvance: boolean;
      candidateCardIds: string[];
      kind: "advance-queue";
      nextCardId: string | null;
      nextQueueCardIds: string[];
      optimisticNextCard: ReviewQueueCard | null;
      optimisticNextQueuePosition: number | null;
      optimisticSourceData: ReviewPageClientData | null;
      optimisticViewData: ReviewPageClientData | null;
    } & ReviewGradeSubmissionPlanBase);

export function buildReviewGradeSubmissionPlan(input: {
  activeQueueCardIds: string[];
  advanceWindowCardIds: string[];
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  fullViewData: ReviewPageData | null;
  isHydratingFullData: boolean;
  isQueueCard: boolean;
  pendingGradeSubmissionCount: number;
  prefetchedCards: ReadonlyMap<string, ReviewQueueCard>;
  rating: ReviewGradeValue;
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>;
  sessionViewData: ReviewPageClientData;
}): ReviewGradeSubmissionPlan {
  const forcedKanjiClashContrast = buildForcedContrastPayload(
    input.forcedContrastSelection
  );

  if (forcedKanjiClashContrast && input.pendingGradeSubmissionCount > 0) {
    return {
      forcedKanjiClashContrast,
      kind: "blocked",
      reason: "pending-forced-contrast"
    };
  }

  const isBlockingGradeSubmission =
    !input.isQueueCard || forcedKanjiClashContrast !== undefined;

  if (!input.isQueueCard) {
    return {
      actionInput: buildPreserveCardGradeActionInput({
        forcedKanjiClashContrast,
        rating: input.rating,
        selectedCard: input.selectedCard,
        sessionViewData: input.sessionViewData
      }),
      forcedKanjiClashContrast,
      isBlockingGradeSubmission,
      kind: "preserve-card"
    };
  }

  const nextQueueCardIds = input.activeQueueCardIds.filter(
    (id) => id !== input.selectedCard.id
  );
  const candidateCardIds = input.advanceWindowCardIds;
  const nextCardId = candidateCardIds[0] ?? null;
  const optimisticNextCard = resolveOptimisticReviewAdvanceCardForClientData({
    candidateCardIds,
    data: input.sessionViewData,
    prefetchedCards: input.prefetchedCards
  });
  const optimisticNextCardId = optimisticNextCard?.id ?? null;
  const optimisticNextQueuePosition =
    resolveReviewAdvanceCandidateQueuePosition({
      candidateCardIds: nextQueueCardIds,
      selectedCardId: optimisticNextCardId
    });
  const optimisticSourceData =
    input.fullViewData ??
    (input.isHydratingFullData ? input.sessionViewData : null);
  const canOptimisticallyCompleteQueue =
    nextQueueCardIds.length === 0 && nextCardId === null;
  const canOptimisticallyAdvance =
    optimisticSourceData !== null &&
    (optimisticNextCard !== null || canOptimisticallyCompleteQueue) &&
    input.selectedCard.bucket !== "upcoming" &&
    forcedKanjiClashContrast === undefined;
  const optimisticViewData = canOptimisticallyAdvance
    ? buildOptimisticViewData({
        currentData: optimisticSourceData,
        gradedCardBucket: input.selectedCard.bucket,
        nextCard: optimisticNextCard,
        nextQueueCardIds,
        nextQueuePosition: optimisticNextQueuePosition
      })
    : null;

  return {
    actionInput: buildAdvanceQueueGradeActionInput({
      candidateCardIds,
      forcedKanjiClashContrast,
      nextCardId,
      nextQueueCardIds,
      prefetchedCards: input.prefetchedCards,
      rating: input.rating,
      selectedCard: input.selectedCard,
      sessionViewData: input.sessionViewData
    }),
    canOptimisticallyAdvance,
    candidateCardIds,
    forcedKanjiClashContrast,
    isBlockingGradeSubmission,
    kind: "advance-queue",
    nextCardId,
    nextQueueCardIds,
    optimisticNextCard,
    optimisticNextQueuePosition,
    optimisticSourceData,
    optimisticViewData
  };
}

function buildForcedContrastPayload(
  selection: ReviewForcedContrastSelection | null
): ReviewForcedContrastPayload | undefined {
  if (!selection) {
    return undefined;
  }

  return {
    source: "review-grading",
    targetLabel: selection.label,
    targetResultKey: selection.resultKey
  };
}

function buildPreserveCardGradeActionInput(input: {
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  rating: ReviewGradeValue;
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>;
  sessionViewData: ReviewPageClientData;
}): ReviewGradeSessionActionInput {
  const actionInput = buildBaseGradeActionInput(input);

  if (input.sessionViewData.scope === "media") {
    actionInput.sessionMedia = input.sessionViewData.media;
  }

  return actionInput;
}

function buildAdvanceQueueGradeActionInput(input: {
  candidateCardIds: string[];
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  nextCardId: string | null;
  nextQueueCardIds: string[];
  prefetchedCards: ReadonlyMap<string, ReviewQueueCard>;
  rating: ReviewGradeValue;
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>;
  sessionViewData: ReviewPageClientData;
}): ReviewGradeSessionActionInput {
  const actionInput = buildBaseGradeActionInput(input);

  actionInput.candidateCardIds = input.candidateCardIds;
  actionInput.canonicalCandidateCardIds = input.nextQueueCardIds.slice(0, 4);
  const canonicalCandidate = resolveOptimisticReviewAdvanceCardForClientData({
    candidateCardIds: input.nextQueueCardIds,
    data: input.sessionViewData,
    prefetchedCards: input.prefetchedCards
  });

  if (
    canonicalCandidate &&
    canonicalCandidate.id === input.nextQueueCardIds[0]
  ) {
    actionInput.canonicalCandidateSnapshot = {
      bucket: canonicalCandidate.bucket,
      cardId: canonicalCandidate.id,
      reviewStateUpdatedAt: canonicalCandidate.reviewStateUpdatedAt ?? null,
      schedulingKey:
        canonicalCandidate.reviewSeedState.schedulingKey?.trim() || null
    };
  }
  actionInput.gradedCardBucket = input.selectedCard.bucket;
  actionInput.gradedCardDueAt = input.selectedCard.dueAt;
  actionInput.gradedCardScheduledDays =
    input.selectedCard.reviewSeedState.scheduledDays;
  actionInput.gradedCardState = input.selectedCard.reviewSeedState.state;
  actionInput.nextCardId = input.nextCardId;
  actionInput.sessionMedia = input.sessionViewData.media;
  actionInput.sessionQueue = {
    ...input.sessionViewData.queue,
    advanceCards: [],
    cards: [],
    manualCards: [],
    suspendedCards: [],
    upcomingCards: []
  };
  actionInput.sessionSettings = input.sessionViewData.settings;

  return actionInput;
}

function buildBaseGradeActionInput(input: {
  forcedKanjiClashContrast?: ReviewForcedContrastPayload;
  rating: ReviewGradeValue;
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>;
  sessionViewData: ReviewPageClientData;
}): ReviewGradeSessionActionInput {
  const actionInput: ReviewGradeSessionActionInput = {
    answeredCount: input.sessionViewData.session.answeredCount,
    cardId: input.selectedCard.id,
    cardMediaSlug: input.selectedCard.mediaSlug,
    extraNewAnchorCount:
      input.sessionViewData.session.extraNewAnchorCount ?? null,
    extraNewCount: input.sessionViewData.session.extraNewCount,
    expectedUpdatedAt:
      input.sessionViewData.selectedCardContext.reviewStateUpdatedAt ?? null,
    mediaSlug:
      input.sessionViewData.scope === "media"
        ? input.sessionViewData.media.slug
        : undefined,
    rating: input.rating,
    segmentId: input.sessionViewData.session.segmentId,
    scope: input.sessionViewData.scope
  };

  if (input.forcedKanjiClashContrast) {
    actionInput.forcedKanjiClashContrast = input.forcedKanjiClashContrast;
  }

  return actionInput;
}

function buildOptimisticViewData(input: {
  currentData: ReviewPageClientData | null;
  gradedCardBucket: ReviewQueueCard["bucket"];
  nextCard: ReviewQueueCard | null;
  nextQueueCardIds: string[];
  nextQueuePosition: number | null;
}): ReviewPageClientData | null {
  if (!input.currentData) {
    return null;
  }

  if (isReviewPageData(input.currentData)) {
    return buildOptimisticGradeResult({
      currentData: input.currentData,
      gradedCardBucket: input.gradedCardBucket,
      nextCard: input.nextCard,
      nextQueueCardIds: input.nextQueueCardIds,
      nextQueuePosition: input.nextQueuePosition
    });
  }

  return buildOptimisticFirstCandidateGradeResult({
    currentData: input.currentData,
    gradedCardBucket: input.gradedCardBucket,
    nextCard: input.nextCard,
    nextQueueCardIds: input.nextQueueCardIds,
    nextQueuePosition: input.nextQueuePosition
  });
}
