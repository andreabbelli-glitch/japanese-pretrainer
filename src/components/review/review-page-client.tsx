"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  gradeReviewCardSessionAction,
  markLinkedEntryKnownSessionAction,
  loadReviewPageDataSessionAction,
  prefetchReviewCardSessionAction,
  resetReviewCardSessionAction,
  setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction
} from "@/actions/review";
import { buildReviewGradePreviews } from "@/lib/review-grade-previews";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review-types";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/lib/site";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  shouldAcceptServerReviewData,
  type ReviewPageClientData
} from "./review-page-state";
import {
  buildOptimisticGradeResult,
  buildReviewHydrationRequestKey,
  isReviewPageData,
  resolveNextQueueCardId,
  showCompletionTopUp,
  type ReviewGradeValue
} from "./review-page-helpers";
import { ReviewPageSidebar } from "./review-page-sidebar";
import { ReviewPageStage } from "./review-page-stage";

type ReviewSessionActionInput = Parameters<
  typeof markLinkedEntryKnownSessionAction
>[0];

export function ReviewPageClient({
  data,
  searchParams
}: {
  data: ReviewPageClientData;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [viewData, setViewData] = useState<ReviewPageClientData>(data);
  const [queueCardIds, setQueueCardIds] = useState<string[]>(
    "queueCardIds" in data ? data.queueCardIds : []
  );
  const [revealedCardId, setRevealedCardId] = useState<string | null>(() =>
    getInitiallyRevealedCardId(data)
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [pendingAnsweredCountScroll, setPendingAnsweredCountScroll] = useState<
    number | null
  >(null);
  const prefetchBufferRef = useRef<Map<string, ReviewQueueCard>>(new Map());
  const latestViewDataRef = useRef<ReviewPageClientData>(data);
  const lastGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const inFlightGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const gradedCardIdsRef = useRef<Set<string>>(new Set());
  const lastAcceptedServerDataRef = useRef(data);
  const [isPending, startTransition] = useTransition();
  const isFullReviewPageData = isReviewPageData(viewData);
  const isHydratingFullData =
    !isFullReviewPageData &&
    searchParams !== undefined &&
    viewData.scope === "global" &&
    clientError === null;
  const isGlobalReview = viewData.scope === "global";
  const requestedSelectedCardId =
    searchParams && typeof searchParams.card === "string"
      ? searchParams.card
      : Array.isArray(searchParams?.card)
        ? searchParams.card[0] ?? null
        : null;

  const selectedCard = viewData.selectedCard;
  const selectedCardContext = viewData.selectedCardContext;
  const queueIndex =
    isFullReviewPageData && selectedCard
      ? queueCardIds.indexOf(selectedCard.id)
      : -1;
  const isQueueCard = selectedCard
    ? selectedCardContext.isQueueCard
    : false;
  const isAnswerRevealed = selectedCard
    ? selectedCardContext.showAnswer ||
      revealedCardId === selectedCard.id
    : false;
  const nextQueueCardId = resolveNextQueueCardId({
    data: viewData,
    isQueueCard,
    queueCardIds,
    selectedCardId: selectedCard?.id ?? null
  });
  const position = selectedCard ? selectedCardContext.position : null;
  const remainingCount = selectedCard
    ? selectedCardContext.remainingCount
    : 0;
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
    cardId: selectedCard?.id ?? null,
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
      fullSelectedCardContext
        ? new Map<string, string>(
            fullSelectedCardContext.gradePreviews.map((preview) => [
              preview.rating,
              preview.nextReviewLabel
            ])
          )
        : new Map<string, string>(),
    [fullSelectedCardContext]
  );
  const globalHydrationRequestKey =
    searchParams && viewData.scope === "global"
      ? buildReviewHydrationRequestKey(searchParams)
      : null;

  useEffect(() => {
    latestViewDataRef.current = viewData;
  }, [viewData]);

  useEffect(() => {
    if (data === lastAcceptedServerDataRef.current) {
      return;
    }
    lastAcceptedServerDataRef.current = data;

    if (!isReviewPageData(data)) {
      // Server sent FirstCandidate data.  Only reset viewData when the
      // session moved forward (e.g. "add more new" bumped extraNewCount).
      // After a server-action re-render the counts stay the same, so we
      // keep the full data the action just returned.
      const current = latestViewDataRef.current;
      if (data.session.extraNewCount > current.session.extraNewCount) {
        latestViewDataRef.current = data;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- preserve full client state until session counters move forward.
        setViewData(data);
        setRevealedCardId(getInitiallyRevealedCardId(data));
      }
      return;
    }

    const currentViewData = latestViewDataRef.current;
    if (
      !shouldAcceptServerReviewData(
        currentViewData,
        data,
        requestedSelectedCardId
      )
    ) {
      return;
    }

    const merged = mergeReviewPageData(currentViewData, data);
    latestViewDataRef.current = merged;
    setViewData(merged);
    setRevealedCardId(getInitiallyRevealedCardId(merged));
    setQueueCardIds(data.queueCardIds);
  }, [data, requestedSelectedCardId]);

  useEffect(() => {
    if (
      isFullReviewPageData ||
      !searchParams ||
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
      searchParams
    })
      .then((nextData) => {
        if (cancelled) {
          return;
        }

        inFlightGlobalHydrationRequestKeyRef.current = null;
        lastGlobalHydrationRequestKeyRef.current = globalHydrationRequestKey;
        setViewData((currentData) =>
          mergeReviewPageData(currentData, nextData)
        );
        setQueueCardIds(nextData.queueCardIds);
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
  }, [
    globalHydrationRequestKey,
    isFullReviewPageData,
    searchParams,
    viewData.scope
  ]);

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
    if (!selectedCard || !isQueueCard || !isFullReviewPageData) {
      return;
    }

    const bufferSize = 3;
    const startIndex = queueIndex + 1;
    const endIndex = Math.min(
      startIndex + bufferSize,
      queueCardIds.length
    );
    const cardIdsToFetch: string[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const id = queueCardIds[i];

      if (id && !prefetchBufferRef.current.has(id)) {
        cardIdsToFetch.push(id);
      }
    }

    if (cardIdsToFetch.length === 0) {
      return;
    }

    let cancelled = false;

    for (const cardId of cardIdsToFetch) {
      void prefetchReviewCardSessionAction({ cardId })
        .then((card) => {
          if (cancelled || !card) {
            return;
          }

          prefetchBufferRef.current.set(cardId, card);
        })
        .catch((error) => {
          console.error(error);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isQueueCard, isFullReviewPageData, queueIndex, queueCardIds, selectedCard]);

  function runSessionUpdate(
    loadNextData: () => Promise<ReviewPageData>,
    options?: {
      onError?: () => void;
      onSuccess?: (nextData: ReviewPageData) => void;
      optimisticUpdate?: () => (() => void) | void;
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
          console.error(error);
          rollbackOptimisticUpdate?.();
          options?.onError?.();
          setClientError(
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
      const gradePreviews =
        fullViewData.selectedCardContext.gradePreviews.length > 0
          ? fullViewData.selectedCardContext.gradePreviews
          : buildReviewGradePreviews(selectedCard.reviewSeedState, new Date());

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

    const sessionViewData = viewData;
    const fullViewData = isReviewPageData(sessionViewData)
      ? sessionViewData
      : null;

    gradedCardIdsRef.current.add(selectedCard.id);
    setPendingAnsweredCountScroll(sessionViewData.session.answeredCount);

    if (!isQueueCard) {
      runSessionUpdate(
        () =>
          gradeReviewCardSessionAction({
            answeredCount: sessionViewData.session.answeredCount,
            cardId: selectedCard.id,
            cardMediaSlug: selectedCard.mediaSlug,
            extraNewCount: sessionViewData.session.extraNewCount,
            gradedCardIds: Array.from(gradedCardIdsRef.current),
            mediaSlug:
              sessionViewData.scope === "media"
                ? sessionViewData.media.slug
                : undefined,
            rating,
            segmentId: sessionViewData.session.segmentId,
            scope: sessionViewData.scope
          }),
        {
          onError: () => {
            setPendingAnsweredCountScroll(null);
          }
        }
      );
      return;
    }

    const nextCardId = nextQueueCardId;
    const nextQueueCardIds = queueCardIds.filter(
      (id) => id !== selectedCard.id
    );
    const optimisticNextCard = nextCardId
      ? (prefetchBufferRef.current.get(nextCardId) ?? null)
      : null;
    const canOptimisticallyAdvance =
      fullViewData !== null && (!nextCardId || optimisticNextCard !== null);

    runSessionUpdate(
      () =>
        gradeReviewCardSessionAction({
          answeredCount: sessionViewData.session.answeredCount,
          cardId: selectedCard.id,
          cardMediaSlug: selectedCard.mediaSlug,
          extraNewCount: sessionViewData.session.extraNewCount,
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
          sessionSettings: fullViewData?.settings
        }),
      {
        onError: () => {
          setPendingAnsweredCountScroll(null);
        },
        optimisticUpdate: fullViewData !== null && canOptimisticallyAdvance
          ? () => {
              const previousViewData = fullViewData;
              const previousQueueCardIds = queueCardIds;

              setViewData(
                buildOptimisticGradeResult({
                  currentData: fullViewData,
                  gradedCardBucket: selectedCard.bucket,
                  nextCard: optimisticNextCard ?? null,
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
          if (nextData.queueCardIds.length === 0) {
            setQueueCardIds(nextQueueCardIds);
          }
        },
        shouldSyncQueueCardIds: (nextData) => nextData.queueCardIds.length > 0
      }
    );
  }

  function handleMarkKnown() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;
    const actionInput = buildReviewSessionActionInput(
      fullViewData,
      selectedCard,
      Array.from(gradedCardIdsRef.current),
      actionRedirectMode
    );

    runSessionUpdate(() => markLinkedEntryKnownSessionAction(actionInput));
  }

  function handleSetLearning() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;
    const actionInput = buildReviewSessionActionInput(
      fullViewData,
      selectedCard,
      Array.from(gradedCardIdsRef.current),
      actionRedirectMode
    );

    runSessionUpdate(() => setLinkedEntryLearningSessionAction(actionInput));
  }

  function handleResetCard() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;
    const actionInput = buildReviewSessionActionInput(
      fullViewData,
      selectedCard,
      Array.from(gradedCardIdsRef.current),
      actionRedirectMode
    );

    runSessionUpdate(() => resetReviewCardSessionAction(actionInput));
  }

  function handleToggleSuspended() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;
    const actionInput = buildReviewSessionActionInput(
      fullViewData,
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

  return (
    <div className="review-page">
      <section className="hero-grid hero-grid--detail review-workspace">
        <ReviewPageStage
          additionalNewCount={additionalNewCount}
          contextualGlossaryHref={contextualGlossaryHref}
          fullSelectedCard={fullSelectedCard}
          gradePreviewLookup={gradePreviewLookup}
          handleGradeCard={handleGradeCard}
          handleMarkKnown={handleMarkKnown}
          handleResetCard={handleResetCard}
          handleRevealAnswer={handleRevealAnswer}
          handleSetLearning={handleSetLearning}
          handleToggleSuspended={handleToggleSuspended}
          hasSupportCards={hasSupportCards}
          isAnswerRevealed={isAnswerRevealed}
          isFullReviewPageData={isFullReviewPageData}
          isGlobalReview={isGlobalReview}
          isHydratingFullData={isHydratingFullData}
          isPending={isPending}
          remainingCount={remainingCount}
          sessionHref={sessionHref}
          showCompletionState={showCompletionState}
          showFrontFurigana={showFrontFurigana}
          viewData={viewData}
        />
        <ReviewPageSidebar
          clientError={clientError}
          isGlobalReview={isGlobalReview}
          isPending={isPending}
          viewData={viewData}
        />
      </section>
    </div>
  );
}

function buildReviewSessionActionInput(
  viewData: ReviewPageData,
  selectedCard: NonNullable<ReviewPageClientData["selectedCard"]>,
  gradedCardIds: string[],
  redirectMode: ReviewSessionActionInput["redirectMode"]
): ReviewSessionActionInput {
  return {
    answeredCount: viewData.session.answeredCount,
    cardId: selectedCard.id,
    cardMediaSlug: selectedCard.mediaSlug,
    extraNewCount: viewData.session.extraNewCount,
    gradedCardIds,
    mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
    redirectMode,
    segmentId: viewData.session.segmentId,
    scope: viewData.scope
  };
}
