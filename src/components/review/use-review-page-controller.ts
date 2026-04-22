"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type RefObject
} from "react";

import {
  gradeReviewCardSessionAction,
  markLinkedEntryKnownSessionAction,
  loadReviewPageDataSessionAction,
  prefetchReviewCardSessionAction,
  resetReviewCardSessionAction,
  setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction
} from "@/actions/review";
import { useGlossaryAutocomplete } from "@/components/glossary/use-glossary-autocomplete";
import type { GlobalGlossaryAutocompleteSuggestion } from "@/lib/glossary";
import {
  getSafeReviewForcedContrastClientErrorMessage
} from "@/lib/review-error-messages";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/lib/site";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  resolveReviewGradePreviews,
  shouldAdoptServerFirstCandidateData,
  shouldAcceptServerReviewData,
  toReviewForcedContrastSelection,
  type ReviewForcedContrastSelection,
  type ReviewPageClientData
} from "./review-page-state";
import {
  buildOptimisticGradeResult,
  buildOptimisticFirstCandidateGradeResult,
  collectQueuedAdvanceCandidateCardIds,
  collectQueuedPrefetchCardIds,
  buildReviewHydrationRequestKey,
  isReviewPageData,
  resolveOptimisticReviewAdvanceCardForClientData,
  resolveReviewAdvanceCandidateCardId,
  resolveReviewAdvanceCandidateQueuePosition,
  resolveReviewQueuePosition,
  showCompletionTopUp,
  type ReviewGradeValue
} from "./review-page-helpers";
import {
  buildReviewGradePreviewLookup,
  buildReviewSessionActionInput,
  buildSearchParamsRecord,
  buildSuccessfulHydrationResult,
  resolveHydratedFirstCandidateRevealedCardId
} from "./review-page-client-utils";

type ReviewSessionActionInput = Parameters<
  typeof markLinkedEntryKnownSessionAction
>[0];

type ReviewForcedContrastUiState = {
  cardId: string | null;
  isOpen: boolean;
  query: string;
  selection: ReviewForcedContrastSelection | null;
};

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
  const prefetchBufferRef = useRef<Map<string, ReviewQueueCard>>(new Map());
  const prefetchInFlightRef = useRef<Set<string>>(new Set());
  const gradeSubmissionInFlightRef = useRef(false);
  const latestViewDataRef = useRef<ReviewPageClientData>(data);
  const lastGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const inFlightGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const gradedCardIdsRef = useRef<Set<string>>(new Set());
  const lastAcceptedServerDataRef = useRef(data);
  const forcedContrastInputRef = useRef<HTMLInputElement>(null);
  const [forcedContrastUiState, setForcedContrastUiState] =
    useState<ReviewForcedContrastUiState>({
      cardId: data.selectedCard?.id ?? null,
      isOpen: false,
      query: "",
      selection: null
    });
  const [isPending, startTransition] = useTransition();
  const currentSearchParams = useMemo(
    () => buildSearchParamsRecord(liveSearchParams, searchParams),
    [liveSearchParams, searchParams]
  );
  const isFullReviewPageData = isReviewPageData(viewData);
  const isHydratingFullData =
    !isFullReviewPageData &&
    currentSearchParams !== undefined &&
    viewData.scope === "global" &&
    clientError === null;
  const isGlobalReview = viewData.scope === "global";
  const requestedSelectedCardId =
    isGlobalReview &&
    currentSearchParams &&
    typeof currentSearchParams.card === "string"
      ? currentSearchParams.card
      : isGlobalReview && Array.isArray(currentSearchParams?.card)
        ? (currentSearchParams.card[0] ?? null)
        : null;

  const selectedCard = viewData.selectedCard;
  const selectedCardId = selectedCard?.id ?? null;
  const selectedCardContext = viewData.selectedCardContext;
  const serverAdvanceCards = viewData.queue.advanceCards;
  const serverAdvanceCardIds = useMemo(
    () => new Set(serverAdvanceCards.map((card) => card.id)),
    [serverAdvanceCards]
  );
  const queueCardIndexLookup = useMemo(
    () => new Map(queueCardIds.map((cardId, index) => [cardId, index] as const)),
    [queueCardIds]
  );
  const resolvedQueuePosition = useMemo(
    () =>
      resolveReviewQueuePosition({
        data: viewData,
        queueCardIndexLookup,
        queueCardIds,
        selectedCardId
      }),
    [queueCardIds, queueCardIndexLookup, selectedCardId, viewData]
  );
  const activeQueueCardIds = resolvedQueuePosition.queueCardIds;
  const queueIndex = selectedCard ? resolvedQueuePosition.queueIndex : -1;
  const isQueueCard = selectedCard ? selectedCardContext.isQueueCard : false;
  const isAnswerRevealed = selectedCard
    ? selectedCardContext.showAnswer || revealedCardId === selectedCardId
    : false;
  const advanceWindowCardIds = useMemo(
    () =>
      isQueueCard && queueIndex >= 0
        ? collectQueuedAdvanceCandidateCardIds({
            bufferSize: 3,
            queueCardIds: activeQueueCardIds,
            queueIndex
          })
        : [],
    [activeQueueCardIds, isQueueCard, queueIndex]
  );
  const position = selectedCard ? selectedCardContext.position : null;
  const remainingCount = selectedCard ? selectedCardContext.remainingCount : 0;
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
    extraNewCount: viewData.session.extraNewCount,
    isQueueCard,
    position,
    segmentId: viewData.session.segmentId,
    showAnswer: isAnswerRevealed
  });
  const contextualGlossaryHref = appendReturnToParam(
    viewData.media.glossaryHref,
    sessionHref
  );
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = isQueueCard ? "advance_queue" : "preserve_card";
  const gradePreviewLookup = useMemo(
    () =>
      buildReviewGradePreviewLookup({
        data: viewData,
        fullSelectedCardContext
      }),
    [fullSelectedCardContext, viewData]
  );
  const globalHydrationRequestKey =
    currentSearchParams && viewData.scope === "global"
      ? buildReviewHydrationRequestKey(currentSearchParams)
      : null;
  const forcedContrastState =
    forcedContrastUiState.cardId === selectedCardId
      ? forcedContrastUiState
      : {
          cardId: selectedCardId,
          isOpen: false,
          query: "",
          selection: null
        };
  const forcedContrastQuery = forcedContrastState.query;
  const forcedContrastSelection = forcedContrastState.selection;
  const isForcedContrastOpen = forcedContrastState.isOpen;
  const forcedContrastAutocomplete = useGlossaryAutocomplete({
    filters: {
      cards: "with_cards",
      entryType: "all",
      media: "all",
      study: "all"
    },
    isOpen: isForcedContrastOpen,
    query: forcedContrastQuery
  });

  useEffect(() => {
    latestViewDataRef.current = viewData;
  }, [viewData]);

  useEffect(() => {
    if (!isForcedContrastOpen) {
      return;
    }

    forcedContrastInputRef.current?.focus?.();
  }, [isForcedContrastOpen]);

  useEffect(() => {
    if (!selectedCard || !isAnswerRevealed) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "Escape") {
        if (!isForcedContrastOpen) {
          return;
        }

        event.preventDefault();
        setForcedContrastUiState((currentState) => ({
          ...currentState,
          cardId: selectedCardId,
          isOpen: false
        }));
        forcedContrastInputRef.current?.blur?.();
        return;
      }

      if (event.key.toLowerCase() !== "c" || isEditableTarget) {
        return;
      }

      event.preventDefault();
      setForcedContrastUiState((currentState) => ({
        ...currentState,
        cardId: selectedCardId,
        isOpen: !isForcedContrastOpen
      }));
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [isAnswerRevealed, isForcedContrastOpen, selectedCard, selectedCardId]);

  useEffect(() => {
    if (data === lastAcceptedServerDataRef.current) {
      if (isReviewPageData(data) && globalHydrationRequestKey !== null) {
        lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
      }
      return;
    }
    lastAcceptedServerDataRef.current = data;

    if (!isReviewPageData(data)) {
      if (
        shouldAdoptServerFirstCandidateData({
          currentData: latestViewDataRef.current,
          nextData: data,
          globalHydrationRequestKey,
          lastGlobalHydrationRequestKey:
            lastGlobalHydrationRequestKeyRef.current
        })
      ) {
        const nextRevealedCardId = resolveHydratedFirstCandidateRevealedCardId({
          currentData: latestViewDataRef.current,
          nextData: data
        });
        latestViewDataRef.current = data;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- preserve full client state until session counters move forward.
        setViewData(data);
        setRevealedCardId(nextRevealedCardId);
        setQueueCardIds(data.queueCardIds);
        setClientError(null);
      }
      return;
    }

    const currentViewData = latestViewDataRef.current;
    if (
      !shouldAcceptServerReviewData(
        currentViewData,
        data,
        requestedSelectedCardId,
        isGlobalReview
      )
    ) {
      return;
    }

    const merged = mergeReviewPageData(currentViewData, data);
    if (merged.scope === "global" && globalHydrationRequestKey !== null) {
      lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
    }
    latestViewDataRef.current = merged;
    setViewData(merged);
    setRevealedCardId(getInitiallyRevealedCardId(merged));
    setQueueCardIds(data.queueCardIds);
    setClientError(null);
  }, [
    data,
    globalHydrationRequestKey,
    isGlobalReview,
    requestedSelectedCardId
  ]);

  useEffect(() => {
    if (
      !currentSearchParams ||
      viewData.scope !== "global" ||
      globalHydrationRequestKey === null ||
      lastGlobalHydrationRequestKeyRef.current === globalHydrationRequestKey ||
      inFlightGlobalHydrationRequestKeyRef.current === globalHydrationRequestKey
    ) {
      return;
    }

    let cancelled = false;
    inFlightGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;

    void loadReviewPageDataSessionAction({
      scope: "global",
      searchParams: currentSearchParams
    })
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        inFlightGlobalHydrationRequestKeyRef.current = null;
        lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
        const hydrationResult = buildSuccessfulHydrationResult(
          latestViewDataRef.current,
          nextData
        );

        latestViewDataRef.current = hydrationResult.viewData;
        setViewData(hydrationResult.viewData);
        setQueueCardIds(hydrationResult.queueCardIds);
        setClientError(hydrationResult.clientError);
      })
      .catch((error) => {
        console.error(error);

        if (cancelled) {
          return;
        }

        if (
          inFlightGlobalHydrationRequestKeyRef.current ===
          globalHydrationRequestKey
        ) {
          inFlightGlobalHydrationRequestKeyRef.current = null;
        }
        setClientError(
          "Non sono riuscito a completare i dettagli della review. La stage resta disponibile."
        );
      });

    return () => {
      cancelled = true;
      if (
        inFlightGlobalHydrationRequestKeyRef.current ===
        globalHydrationRequestKey
      ) {
        inFlightGlobalHydrationRequestKeyRef.current = null;
      }
    };
  }, [currentSearchParams, globalHydrationRequestKey, viewData.scope]);

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (currentHref !== sessionHref) {
      window.history.replaceState(window.history.state, "", sessionHref);
    }
  }, [sessionHref]);

  useEffect(() => {
    if (
      pendingAnsweredCountScroll === null ||
      viewData.session.answeredCount <= pendingAnsweredCountScroll
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".review-stage")
        ?.scrollIntoView({ block: "start" });
      setPendingAnsweredCountScroll(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pendingAnsweredCountScroll, viewData.session.answeredCount]);

  useEffect(() => {
    if (!selectedCard || !isQueueCard) {
      return;
    }

    const cardIdsToFetch = collectQueuedPrefetchCardIds({
      bufferSize: 3,
      coveredCardIds: serverAdvanceCardIds,
      prefetchedCardIds: new Set(prefetchBufferRef.current.keys()),
      prefetchingCardIds: prefetchInFlightRef.current,
      queueCardIds: activeQueueCardIds,
      queueIndex
    });

    if (cardIdsToFetch.length === 0) {
      return;
    }

    let cancelled = false;

    for (const cardId of cardIdsToFetch) {
      prefetchInFlightRef.current.add(cardId);

      void prefetchReviewCardSessionAction({ cardId })
        .then((card) => {
          if (cancelled || !card) {
            return;
          }

          prefetchBufferRef.current.set(cardId, card);
        })
        .catch((error) => {
          console.error(error);
        })
        .finally(() => {
          prefetchInFlightRef.current.delete(cardId);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    isQueueCard,
    isFullReviewPageData,
    activeQueueCardIds,
    queueIndex,
    selectedCard,
    serverAdvanceCardIds
  ]);

  function handleOpenForcedContrast() {
    if (!selectedCard || !isAnswerRevealed) {
      return;
    }

    setForcedContrastUiState((currentState) => ({
      ...currentState,
      cardId: selectedCardId,
      isOpen: true
    }));
  }

  function handleCloseForcedContrast() {
    setForcedContrastUiState((currentState) => ({
      ...currentState,
      cardId: selectedCardId,
      isOpen: false
    }));
    forcedContrastInputRef.current?.blur?.();
  }

  function handleForcedContrastQueryChange(value: string) {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: true,
      query: value,
      selection: null
    });
  }

  function handleForcedContrastSelect(
    suggestion: GlobalGlossaryAutocompleteSuggestion
  ) {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: false,
      query: suggestion.label,
      selection: toReviewForcedContrastSelection(suggestion)
    });
    forcedContrastInputRef.current?.blur?.();
  }

  function handleRemoveForcedContrast() {
    setForcedContrastUiState({
      cardId: selectedCardId,
      isOpen: false,
      query: "",
      selection: null
    });
  }

  function runSessionUpdate(
    loadNextData: () => Promise<ReviewPageData>,
    options?: {
      errorResolver?: (error: unknown) => string;
      onError?: () => void;
      onSuccess?: (nextData: ReviewPageData) => void;
      optimisticUpdate?: () => (() => void) | void;
      shouldLogError?: (error: unknown) => boolean;
      shouldSyncQueueCardIds?: (nextData: ReviewPageData) => boolean;
    }
  ) {
    setClientError(null);
    const rollbackOptimisticUpdate = options?.optimisticUpdate?.();

    startTransition(() => {
      void loadNextData()
        .then((nextData) => {
          const mergedData = mergeReviewPageData(
            latestViewDataRef.current,
            nextData
          );

          latestViewDataRef.current = mergedData;
          setViewData(mergedData);
          setRevealedCardId(getInitiallyRevealedCardId(mergedData));
          if (options?.shouldSyncQueueCardIds?.(nextData) ?? true) {
            setQueueCardIds(nextData.queueCardIds);
          }
          options?.onSuccess?.(mergedData);
        })
        .catch((error) => {
          if (options?.shouldLogError?.(error) ?? true) {
            console.error(error);
          }
          rollbackOptimisticUpdate?.();
          options?.onError?.();
          setClientError(
            options?.errorResolver?.(error) ??
              "Non sono riuscito ad aggiornare la review. Riprova un attimo."
          );
        });
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

  function handleGradeCard(rating: ReviewGradeValue) {
    if (!selectedCard) {
      return;
    }

    if (gradeSubmissionInFlightRef.current) {
      return;
    }

    const sessionViewData = viewData;
    const fullViewData = isReviewPageData(sessionViewData)
      ? sessionViewData
      : null;
    const forcedKanjiClashContrast = forcedContrastSelection
      ? {
          source: "review-grading" as const,
          targetLabel: forcedContrastSelection.label,
          targetResultKey: forcedContrastSelection.resultKey
        }
      : undefined;

    gradedCardIdsRef.current.add(selectedCard.id);
    setPendingAnsweredCountScroll(sessionViewData.session.answeredCount);
    gradeSubmissionInFlightRef.current = true;

    if (!isQueueCard) {
      runSessionUpdate(
        () =>
          gradeReviewCardSessionAction(
            {
              answeredCount: sessionViewData.session.answeredCount,
              cardId: selectedCard.id,
              cardMediaSlug: selectedCard.mediaSlug,
              extraNewCount: sessionViewData.session.extraNewCount,
              expectedUpdatedAt:
                sessionViewData.selectedCardContext.reviewStateUpdatedAt ??
                undefined,
              gradedCardIds: Array.from(gradedCardIdsRef.current),
              mediaSlug:
                sessionViewData.scope === "media"
                  ? sessionViewData.media.slug
                  : undefined,
            rating,
            segmentId: sessionViewData.session.segmentId,
            sessionMedia:
              sessionViewData.scope === "media"
                ? sessionViewData.media
                : undefined,
            scope: sessionViewData.scope,
            ...(forcedKanjiClashContrast
              ? { forcedKanjiClashContrast }
              : {})
          } as Parameters<typeof gradeReviewCardSessionAction>[0]
          ),
        {
          ...(forcedKanjiClashContrast
            ? {
                errorResolver: (error: unknown) =>
                  getSafeReviewForcedContrastClientErrorMessage(error) ??
                  "Non sono riuscito ad aggiornare la review. Riprova un attimo.",
                shouldLogError: (error: unknown) =>
                  getSafeReviewForcedContrastClientErrorMessage(error) === null
              }
            : {}),
          onError: () => {
            gradeSubmissionInFlightRef.current = false;
            setPendingAnsweredCountScroll(null);
          },
          onSuccess: () => {
            gradeSubmissionInFlightRef.current = false;
          }
        }
      );
      return;
    }

    const nextQueueCardIds = activeQueueCardIds.filter(
      (id) => id !== selectedCard.id
    );
    const preferredNextCardId = resolveReviewAdvanceCandidateCardId({
      candidateCardIds: advanceWindowCardIds,
      prefetchedCardIds: new Set(prefetchBufferRef.current.keys())
    });
    const candidateCardIds = advanceWindowCardIds;
    const nextCardId = preferredNextCardId ?? candidateCardIds[0] ?? null;
    const optimisticNextCard = resolveOptimisticReviewAdvanceCardForClientData(
      {
        candidateCardIds,
        data: sessionViewData,
        preferredCardId: preferredNextCardId,
        prefetchedCards: prefetchBufferRef.current
      }
    );
    const optimisticNextCardId = optimisticNextCard?.id ?? null;
    const optimisticNextQueuePosition = resolveReviewAdvanceCandidateQueuePosition(
      {
        candidateCardIds: nextQueueCardIds,
        selectedCardId: optimisticNextCardId
      }
    );
    const optimisticSourceData =
      fullViewData ?? (isHydratingFullData ? viewData : null);
    const canOptimisticallyAdvance =
      optimisticSourceData !== null &&
      optimisticNextCard !== null &&
      forcedKanjiClashContrast === undefined;

    runSessionUpdate(
      () =>
        gradeReviewCardSessionAction(
          {
            answeredCount: sessionViewData.session.answeredCount,
            cardId: selectedCard.id,
            cardMediaSlug: selectedCard.mediaSlug,
            candidateCardIds,
            canonicalCandidateCardIds: nextQueueCardIds,
            extraNewCount: sessionViewData.session.extraNewCount,
            expectedUpdatedAt:
              sessionViewData.selectedCardContext.reviewStateUpdatedAt ??
              undefined,
            gradedCardBucket: selectedCard.bucket,
            gradedCardIds: Array.from(gradedCardIdsRef.current),
            mediaSlug:
              sessionViewData.scope === "media"
                ? sessionViewData.media.slug
                : undefined,
            nextCardId,
            rating,
            segmentId: sessionViewData.session.segmentId,
            scope: sessionViewData.scope,
            sessionMedia: sessionViewData.media,
            sessionQueue: fullViewData?.queue,
            sessionSettings: fullViewData?.settings,
            ...(forcedKanjiClashContrast
              ? { forcedKanjiClashContrast }
              : {})
          } as Parameters<typeof gradeReviewCardSessionAction>[0]
        ),
        {
          ...(forcedKanjiClashContrast
            ? {
                errorResolver: (error: unknown) =>
                  getSafeReviewForcedContrastClientErrorMessage(error) ??
                  "Non sono riuscito ad aggiornare la review. Riprova un attimo.",
                shouldLogError: (error: unknown) =>
                  getSafeReviewForcedContrastClientErrorMessage(error) === null
              }
            : {}),
        onError: () => {
          gradeSubmissionInFlightRef.current = false;
          setPendingAnsweredCountScroll(null);
        },
        optimisticUpdate: canOptimisticallyAdvance
          ? () => {
              const previousViewData = optimisticSourceData;
              const previousQueueCardIds = queueCardIds;

              setViewData(
                fullViewData
                  ? buildOptimisticGradeResult({
                      currentData: fullViewData,
                      gradedCardBucket: selectedCard.bucket,
                      nextCard: optimisticNextCard ?? null,
                      nextQueuePosition: optimisticNextQueuePosition,
                      nextQueueCardIds
                    })
                  : buildOptimisticFirstCandidateGradeResult({
                      currentData: optimisticSourceData!,
                      gradedCardBucket: selectedCard.bucket,
                      nextCard: optimisticNextCard ?? null,
                      nextQueuePosition: optimisticNextQueuePosition,
                      nextQueueCardIds
                    })
              );
              setQueueCardIds(nextQueueCardIds);

              return () => {
                setViewData(previousViewData);
                setQueueCardIds(previousQueueCardIds);
              };
            }
          : undefined,
        onSuccess: (nextData) => {
          gradeSubmissionInFlightRef.current = false;
          if (nextData.queueCardIds.length === 0) {
            setQueueCardIds(nextQueueCardIds);
          }
        },
        shouldSyncQueueCardIds: (nextData) => nextData.queueCardIds.length > 0
      }
    );
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
      Array.from(gradedCardIdsRef.current),
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
      Array.from(gradedCardIdsRef.current),
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
    forcedContrastInputRef,
    forcedContrastListboxId: forcedContrastAutocomplete.listboxId,
    forcedContrastQuery,
    forcedContrastSelection,
    forcedContrastShouldShowSuggestions:
      forcedContrastAutocomplete.shouldShowSuggestions,
    forcedContrastSuggestions: forcedContrastAutocomplete.suggestions,
    fullSelectedCard,
    gradePreviewLookup,
    handleCloseForcedContrast,
    handleForcedContrastQueryChange,
    handleForcedContrastSelect,
    handleGradeCard,
    handleMarkKnown,
    handleOpenForcedContrast,
    handleResetCard,
    handleRevealAnswer,
    handleRemoveForcedContrast,
    handleSetLearning,
    handleToggleSuspended,
    hasSupportCards,
    isAnswerRevealed,
    isForcedContrastOpen,
    isFullReviewPageData,
    isGlobalReview,
    isHydratingFullData,
    isPending,
    remainingCount,
    sessionHref,
    showCompletionState,
    showFrontFurigana,
    viewData
  };
}
