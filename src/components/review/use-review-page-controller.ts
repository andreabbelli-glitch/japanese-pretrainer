"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useMemo, useRef, useState, type RefObject } from "react";

import {
  markLinkedEntryKnownSessionAction,
  resetReviewCardSessionAction,
  setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction
} from "@/actions/review";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/features/glossary/types";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";

import {
  getInitiallyRevealedCardId,
  resolveReviewGradePreviews,
  type ReviewForcedContrastSelection,
  type ReviewPageClientData
} from "./review-page-state";
import { isReviewPageData, type ReviewGradeValue } from "./review-page-helpers";
import { buildReviewControllerSnapshot } from "./review-page-controller-snapshot";
import {
  buildReviewSessionActionInput,
  buildSearchParamsRecord
} from "./review-page-client-utils";
import { useReviewSessionUpdateRunner } from "./use-review-session-update-runner";
import { useReviewForcedContrastController } from "./use-review-forced-contrast-controller";
import { useReviewQueuedCardPrefetch } from "./use-review-queued-card-prefetch";
import { useReviewPageDataSync } from "./use-review-page-data-sync";
import { useReviewSessionBrowserEffects } from "./use-review-session-browser-effects";
import { useReviewGradeSubmissionController } from "./use-review-grade-submission-controller";

type ReviewSessionActionInput = Parameters<
  typeof markLinkedEntryKnownSessionAction
>[0];

export type ReviewPageControllerResult = {
  additionalNewCount: number;
  clientError: string | null;
  contextualGlossaryHref: Route;
  forcedContrastInputRef: RefObject<HTMLInputElement | null>;
  forcedContrastListboxId: string;
  forcedContrastQuery: string;
  forcedContrastSelection: ReviewForcedContrastSelection | null;
  forcedContrastShouldShowSuggestions: boolean;
  forcedContrastSuggestions: GlobalGlossaryAutocompleteSuggestion[];
  fullSelectedCard: ReviewQueueCard | null;
  gradePreviewLookup: Map<string, string>;
  handleCloseForcedContrast: () => void;
  handleForcedContrastQueryChange: (value: string) => void;
  handleForcedContrastSelect: (
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) => void;
  handleGradeCard: (rating: ReviewGradeValue) => void;
  handleMarkKnown: () => void;
  handleOpenForcedContrast: () => void;
  handleResetCard: () => void;
  handleRevealAnswer: () => void;
  handleRemoveForcedContrast: () => void;
  handleSetLearning: () => void;
  handleToggleSuspended: () => void;
  hasSupportCards: boolean;
  isAnswerRevealed: boolean;
  isForcedContrastOpen: boolean;
  isFullReviewPageData: boolean;
  isGlobalReview: boolean;
  isGradeControlsDisabled: boolean;
  isHydratingFullData: boolean;
  isPending: boolean;
  remainingCount: number;
  sessionHref: Route;
  showCompletionState: boolean;
  showFrontFurigana: boolean;
  viewData: ReviewPageClientData;
};

export function useReviewPageController(input: {
  data: ReviewPageClientData;
  searchParams?: Record<string, string | string[] | undefined>;
}): ReviewPageControllerResult {
  const { data, searchParams } = input;
  const [viewData, setViewData] = useState<ReviewPageClientData>(data);
  const [queueCardIds, setQueueCardIds] = useState<string[]>(
    "queueCardIds" in data ? data.queueCardIds : []
  );
  const liveSearchParams = useSearchParams();
  const [revealedCardId, setRevealedCardId] = useState<string | null>(() =>
    getInitiallyRevealedCardId(data)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [pendingAnsweredCountScroll, setPendingAnsweredCountScroll] = useState<
    number | null
  >(null);
  const latestViewDataRef = useRef<ReviewPageClientData>(data);
  const currentSearchParams = useMemo(
    () => buildSearchParamsRecord(liveSearchParams, searchParams),
    [liveSearchParams, searchParams]
  );
  const forcedContrastSelectedCard = viewData.selectedCard;
  const forcedContrastSelectedCardId = forcedContrastSelectedCard?.id ?? null;
  const forcedContrastIsAnswerRevealed = forcedContrastSelectedCard
    ? viewData.selectedCardContext.showAnswer ||
      revealedCardId === forcedContrastSelectedCardId
    : false;
  const forcedContrast = useReviewForcedContrastController({
    isAnswerRevealed: forcedContrastIsAnswerRevealed,
    selectedCardId: forcedContrastSelectedCardId
  });
  const forcedContrastSelection = forcedContrast.forcedContrastSelection;
  const runnerIsGlobalReview = viewData.scope === "global";
  const runnerRequestedSelectedCardId =
    runnerIsGlobalReview &&
    currentSearchParams &&
    typeof currentSearchParams.card === "string"
      ? currentSearchParams.card
      : runnerIsGlobalReview &&
          currentSearchParams &&
          Array.isArray(currentSearchParams.card)
        ? (currentSearchParams.card[0] ?? null)
        : null;
  const {
    enqueueOptimisticGradeSessionUpdate,
    isPending,
    resetQueuedGradeFailure,
    runSessionUpdate
  } = useReviewSessionUpdateRunner({
    getLatestViewData: () => latestViewDataRef.current,
    isGlobalReview: runnerIsGlobalReview,
    requestedSelectedCardId: runnerRequestedSelectedCardId,
    setClientError,
    setLatestViewData: (nextData) => {
      latestViewDataRef.current = nextData;
    },
    setQueueCardIds,
    setRevealedCardId,
    setViewData
  });
  const {
    getGradedCardIds,
    handleGradeCard: submitGradeCard,
    hasBlockingGradeSubmissionInFlight,
    pendingGradeCardIds,
    submittedGradeCardIds
  } = useReviewGradeSubmissionController({
    clientError,
    enqueueOptimisticGradeSessionUpdate,
    forcedContrastSelection,
    latestViewDataRef,
    runSessionUpdate,
    setPendingAnsweredCountScroll,
    setQueueCardIds,
    setViewData
  });
  const {
    actionRedirectMode,
    activeQueueCardIds,
    additionalNewCount,
    advanceWindowCardIds,
    contextualGlossaryHref,
    fullSelectedCard,
    globalHydrationRequestKey,
    gradePreviewLookup,
    hasSupportCards,
    isAnswerRevealed,
    isFullReviewPageData,
    isGlobalReview,
    isGradeControlsDisabled,
    isHydratingFullData,
    isQueueCard,
    queueIndex,
    remainingCount,
    requestedSelectedCardId,
    selectedCard,
    serverAdvanceCardIds,
    sessionHref,
    showCompletionState,
    showFrontFurigana
  } = useMemo(
    () =>
      buildReviewControllerSnapshot({
        clientError,
        currentSearchParams,
        forcedContrastSelection,
        hasBlockingGradeSubmissionInFlight,
        pendingGradeCardIds,
        queueCardIds,
        revealedCardId,
        submittedGradeCardIds,
        viewData
      }),
    [
      clientError,
      currentSearchParams,
      forcedContrastSelection,
      hasBlockingGradeSubmissionInFlight,
      pendingGradeCardIds,
      queueCardIds,
      revealedCardId,
      submittedGradeCardIds,
      viewData
    ]
  );
  const { getPrefetchedCards } = useReviewQueuedCardPrefetch({
    activeQueueCardIds,
    isQueueCard,
    queueCardIds,
    queueIndex,
    selectedCard,
    serverAdvanceCardIds
  });

  useReviewPageDataSync({
    currentSearchParams,
    data,
    globalHydrationRequestKey,
    isGlobalReview,
    latestViewDataRef,
    requestedSelectedCardId,
    resetQueuedGradeFailure,
    setClientError,
    setQueueCardIds,
    setRevealedCardId,
    setViewData,
    viewData
  });

  useReviewSessionBrowserEffects({
    answeredCount: viewData.session.answeredCount,
    pendingAnsweredCountScroll,
    sessionHref,
    setPendingAnsweredCountScroll
  });

  function handleGradeCard(rating: ReviewGradeValue) {
    submitGradeCard(rating, {
      activeQueueCardIds,
      advanceWindowCardIds,
      isHydratingFullData,
      isQueueCard,
      prefetchedCards: getPrefetchedCards(),
      queueCardIds,
      selectedCard,
      viewData
    });
  }

  function handleRevealAnswer() {
    if (!selectedCard) {
      return;
    }

    setRevealedCardId(selectedCard.id);

    if (isFullReviewPageData) {
      const fullViewData = viewData as ReviewPageData;
      const gradePreviews = resolveReviewGradePreviews({
        selectedCard,
        selectedCardContext: fullViewData.selectedCardContext
      });

      setViewData((prev) => ({
        ...prev,
        selectedCardContext: {
          ...prev.selectedCardContext,
          gradePreviews,
          showAnswer: true
        }
      }));
      return;
    }

    setViewData((prev) => ({
      ...prev,
      selectedCardContext: {
        ...prev.selectedCardContext,
        showAnswer: true
      }
    }));
  }

  function runCardAction(
    action: (input: ReviewSessionActionInput) => Promise<ReviewPageData>
  ) {
    if (!selectedCard || !isReviewPageData(viewData)) {
      return;
    }

    const actionInput = buildReviewSessionActionInput(
      viewData,
      selectedCard,
      getGradedCardIds(),
      actionRedirectMode
    );

    runSessionUpdate(() => action(actionInput));
  }

  function handleMarkKnown() {
    runCardAction(markLinkedEntryKnownSessionAction);
  }

  function handleSetLearning() {
    runCardAction(setLinkedEntryLearningSessionAction);
  }

  function handleResetCard() {
    runCardAction(resetReviewCardSessionAction);
  }

  function handleToggleSuspended() {
    if (!selectedCard || !isReviewPageData(viewData)) {
      return;
    }

    const actionInput = buildReviewSessionActionInput(
      viewData,
      selectedCard,
      getGradedCardIds(),
      actionRedirectMode
    );

    runSessionUpdate(() =>
      setReviewCardSuspendedSessionAction({
        ...actionInput,
        suspended: selectedCard.bucket !== "suspended"
      })
    );
  }

  return {
    additionalNewCount,
    clientError,
    contextualGlossaryHref,
    forcedContrastInputRef: forcedContrast.forcedContrastInputRef,
    forcedContrastListboxId: forcedContrast.forcedContrastListboxId,
    forcedContrastQuery: forcedContrast.forcedContrastQuery,
    forcedContrastSelection,
    forcedContrastShouldShowSuggestions:
      forcedContrast.forcedContrastShouldShowSuggestions,
    forcedContrastSuggestions: forcedContrast.forcedContrastSuggestions,
    fullSelectedCard,
    gradePreviewLookup,
    handleCloseForcedContrast: forcedContrast.handleCloseForcedContrast,
    handleForcedContrastQueryChange:
      forcedContrast.handleForcedContrastQueryChange,
    handleForcedContrastSelect: forcedContrast.handleForcedContrastSelect,
    handleGradeCard,
    handleMarkKnown,
    handleOpenForcedContrast: forcedContrast.handleOpenForcedContrast,
    handleResetCard,
    handleRevealAnswer,
    handleRemoveForcedContrast: forcedContrast.handleRemoveForcedContrast,
    handleSetLearning,
    handleToggleSuspended,
    hasSupportCards,
    isAnswerRevealed,
    isForcedContrastOpen: forcedContrast.isForcedContrastOpen,
    isFullReviewPageData,
    isGlobalReview,
    isGradeControlsDisabled,
    isHydratingFullData,
    isPending,
    remainingCount,
    sessionHref,
    showCompletionState,
    showFrontFurigana,
    viewData
  };
}
