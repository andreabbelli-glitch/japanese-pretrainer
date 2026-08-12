import type { Route } from "next";

import type { ReviewPageData, ReviewQueueCard } from "@/features/review/client";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/features/navigation";

import {
  buildReviewGradePreviewLookup,
  resolveRequestedSelectedReviewCardId
} from "./review-page-client-utils";
import {
  buildReviewHydrationRequestKey,
  collectQueuedAdvanceCandidateCardIds,
  isReviewPageData,
  resolveReviewQueuePosition,
  showCompletionTopUp
} from "./review-page-helpers";
import type {
  ReviewForcedContrastSelection,
  ReviewPageClientData
} from "./review-page-state";

export type ReviewControllerSnapshotInput = {
  clientError: string | null;
  currentSearchParams?: Record<string, string | string[] | undefined>;
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  hasBlockingGradeSubmissionInFlight: boolean;
  pendingGradeCardIds: ReadonlySet<string>;
  queueCardIds: string[];
  revealedCardId: string | null;
  submittedGradeCardIds: ReadonlySet<string>;
  viewData: ReviewPageClientData;
};

export type ReviewControllerSnapshot = {
  actionRedirectMode: "advance_queue" | "preserve_card";
  activeQueueCardIds: string[];
  additionalNewCount: number;
  advanceWindowCardIds: string[];
  contextualGlossaryHref: Route;
  fullSelectedCard: ReviewQueueCard | null;
  fullSelectedCardContext: ReviewPageData["selectedCardContext"] | null;
  globalHydrationRequestKey: string | null;
  gradePreviewLookup: Map<string, string>;
  hasQueue: boolean;
  hasSupportCards: boolean;
  isAnswerRevealed: boolean;
  isFullReviewPageData: boolean;
  isGlobalReview: boolean;
  isGradeControlsDisabled: boolean;
  isHydratingFullData: boolean;
  isQueueCard: boolean;
  position: number | null;
  queueCardIndexLookup: Map<string, number>;
  queueIndex: number;
  remainingCount: number;
  requestedSelectedCardId: string | null;
  resolvedQueuePosition: ReturnType<typeof resolveReviewQueuePosition>;
  selectedCard: ReviewPageClientData["selectedCard"];
  selectedCardContext: ReviewPageClientData["selectedCardContext"];
  selectedCardId: string | null;
  serverAdvanceCardIds: Set<string>;
  serverAdvanceCards: ReviewQueueCard[];
  sessionHref: Route;
  showCompletionState: boolean;
  showFrontFurigana: boolean;
};

export function buildReviewControllerSnapshot(
  input: ReviewControllerSnapshotInput
): ReviewControllerSnapshot {
  const {
    clientError,
    currentSearchParams,
    forcedContrastSelection,
    hasBlockingGradeSubmissionInFlight,
    pendingGradeCardIds,
    queueCardIds,
    revealedCardId,
    submittedGradeCardIds,
    viewData
  } = input;
  const isFullReviewPageData = isReviewPageData(viewData);
  const isGlobalReview = viewData.scope === "global";
  const isHydratingFullData =
    !isFullReviewPageData &&
    currentSearchParams !== undefined &&
    viewData.scope === "global" &&
    clientError === null;
  const requestedSelectedCardId = resolveRequestedSelectedReviewCardId({
    isGlobalReview,
    searchParams: currentSearchParams
  });

  const selectedCard = viewData.selectedCard;
  const selectedCardId = selectedCard?.id ?? null;
  const selectedCardContext = viewData.selectedCardContext;
  const serverAdvanceCards = viewData.queue.advanceCards;
  const serverAdvanceCardIds = new Set(
    serverAdvanceCards.map((card) => card.id)
  );
  const queueCardIndexLookup = new Map(
    queueCardIds.map((cardId, index) => [cardId, index] as const)
  );
  const resolvedQueuePosition = resolveReviewQueuePosition({
    data: viewData,
    queueCardIndexLookup,
    queueCardIds,
    selectedCardId
  });
  const activeQueueCardIds = resolvedQueuePosition.queueCardIds;
  const queueIndex = selectedCard ? resolvedQueuePosition.queueIndex : -1;
  const isQueueCard = selectedCard ? selectedCardContext.isQueueCard : false;
  const isAnswerRevealed = selectedCard
    ? selectedCardContext.showAnswer || revealedCardId === selectedCardId
    : false;
  const shouldPersistAnswerReveal =
    isAnswerRevealed && hasExplicitAnswerRevealSearchParam(currentSearchParams);
  const advanceWindowCardIds =
    isQueueCard && queueIndex >= 0
      ? collectQueuedAdvanceCandidateCardIds({
          bufferSize: 3,
          queueCardIds: activeQueueCardIds,
          queueIndex
        })
      : [];
  const position = selectedCard ? selectedCardContext.position : null;
  const remainingCount =
    selectedCard && isQueueCard ? viewData.queue.queueCount : 0;
  const fullSelectedCardContext = isFullReviewPageData
    ? viewData.selectedCardContext
    : null;
  const fullSelectedCard = isFullReviewPageData
    ? (selectedCard as ReviewQueueCard | null)
    : null;
  const hasQueue = viewData.queue.queueCount > 0;
  const hasSupportCards =
    viewData.queue.manualCount +
      viewData.queue.suspendedCount +
      viewData.queue.upcomingCount >
    0;
  const showFrontFurigana =
    viewData.settings.reviewFrontFurigana || isAnswerRevealed;
  const additionalNewCount = showCompletionTopUp(viewData);
  const sessionHref = buildCanonicalReviewSessionHrefForBase({
    answeredCount: viewData.session.answeredCount,
    baseHref: viewData.media.reviewHref,
    cardId: selectedCardId,
    extraNewAnchorCount: viewData.session.extraNewAnchorCount,
    extraNewCount: viewData.session.extraNewCount,
    isQueueCard,
    mode: viewData.mode,
    position,
    segmentId: viewData.session.segmentId,
    showAnswer: shouldPersistAnswerReveal
  });
  const contextualGlossaryHref = appendReturnToParam(
    viewData.media.glossaryHref,
    sessionHref
  );
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = isQueueCard ? "advance_queue" : "preserve_card";
  const gradePreviewLookup = buildReviewGradePreviewLookup({
    data: viewData,
    fullSelectedCardContext
  });
  const globalHydrationRequestKey =
    currentSearchParams && viewData.scope === "global"
      ? buildReviewHydrationRequestKey(currentSearchParams)
      : null;
  const isGradeControlsDisabled =
    selectedCardId !== null &&
    (clientError !== null ||
      submittedGradeCardIds.has(selectedCardId) ||
      hasBlockingGradeSubmissionInFlight ||
      (forcedContrastSelection !== null && pendingGradeCardIds.size > 0));

  return {
    actionRedirectMode,
    activeQueueCardIds,
    additionalNewCount,
    advanceWindowCardIds,
    contextualGlossaryHref,
    fullSelectedCard,
    fullSelectedCardContext,
    globalHydrationRequestKey,
    gradePreviewLookup,
    hasQueue,
    hasSupportCards,
    isAnswerRevealed,
    isFullReviewPageData,
    isGlobalReview,
    isGradeControlsDisabled,
    isHydratingFullData,
    isQueueCard,
    position,
    queueCardIndexLookup,
    queueIndex,
    remainingCount,
    requestedSelectedCardId,
    resolvedQueuePosition,
    selectedCard,
    selectedCardContext,
    selectedCardId,
    serverAdvanceCardIds,
    serverAdvanceCards,
    sessionHref,
    showCompletionState,
    showFrontFurigana
  };
}

function hasExplicitAnswerRevealSearchParam(
  searchParams?: Record<string, string | string[] | undefined>
) {
  const rawValue = searchParams?.show;

  if (Array.isArray(rawValue)) {
    return rawValue.some((value) => value.trim() === "answer");
  }

  return rawValue?.trim() === "answer";
}
