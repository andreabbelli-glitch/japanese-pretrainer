"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import Link from "next/link";

import {
  gradeReviewCardSessionAction,
  markLinkedEntryKnownSessionAction,
  loadReviewPageDataSessionAction,
  prefetchReviewCardSessionAction,
  resetReviewCardSessionAction,
  setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction
} from "@/actions/review";
import { renderFurigana, stripInlineMarkdown } from "@/lib/render-furigana";
import { buildReviewGradePreviews } from "@/lib/review-grade-previews";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review";
import {
  appendReturnToParam,
  buildCanonicalReviewSessionHrefForBase
} from "@/lib/site";

import {
  getInitiallyRevealedCardId,
  mergeReviewPageData,
  type ReviewPageClientData
} from "./review-page-state";
import { EmptyState } from "../ui/empty-state";
import { PronunciationAudio } from "../ui/pronunciation-audio";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

const ratingCopy = [
  {
    detail: "Allunga l’intervallo con prudenza.",
    label: "Easy",
    tone: "easy" as const,
    value: "easy"
  },
  {
    detail: "Passa al prossimo intervallo utile.",
    label: "Good",
    tone: "good" as const,
    value: "good"
  },
  {
    detail: "Resta fragile, ma va avanti.",
    label: "Hard",
    tone: "hard" as const,
    value: "hard"
  },
  {
    detail: "Torna subito o quasi subito.",
    label: "Again",
    tone: "again" as const,
    value: "again"
  }
] as const;

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
  const [prefetchedNextCard, setPrefetchedNextCard] =
    useState<ReviewQueueCard | null>(null);
  const [prefetchedNextCardId, setPrefetchedNextCardId] = useState<
    string | null
  >(null);
  const latestViewDataRef = useRef<ReviewPageClientData>(data);
  const lastGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const inFlightGlobalHydrationRequestKeyRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isFullReviewPageData = isReviewPageData(viewData);
  const isHydratingFullData =
    !isFullReviewPageData &&
    searchParams !== undefined &&
    viewData.scope === "global" &&
    clientError === null;
  const isGlobalReview = viewData.scope === "global";

  const selectedCard = viewData.selectedCard;
  const queueIndex =
    isFullReviewPageData && selectedCard
      ? queueCardIds.indexOf(selectedCard.id)
      : -1;
  const isQueueCard = selectedCard
    ? viewData.selectedCardContext.isQueueCard
    : false;
  const isAnswerRevealed = selectedCard
    ? viewData.selectedCardContext.showAnswer ||
      revealedCardId === selectedCard.id
    : false;
  const nextQueueCardId = isQueueCard
    ? isFullReviewPageData
      ? (queueCardIds[queueIndex + 1] ?? null)
      : null
    : null;
  const position = selectedCard ? viewData.selectedCardContext.position : null;
  const remainingCount = selectedCard
    ? viewData.selectedCardContext.remainingCount
    : 0;
  const fullSelectedCard = isFullReviewPageData
    ? (selectedCard as ReviewQueueCard | null)
    : null;
  const showCompactPronunciation = fullSelectedCard
    ? fullSelectedCard.pronunciations.length <= 1
    : false;
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
    showAnswer: isAnswerRevealed
  });
  const contextualGlossaryHref = appendReturnToParam(
    viewData.media.glossaryHref,
    sessionHref
  );
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = isQueueCard ? "advance_queue" : "preserve_card";

  const gradePreviewLookup = isFullReviewPageData
    ? new Map(
        viewData.selectedCardContext.gradePreviews.map((preview) => [
          preview.rating,
          preview.nextReviewLabel
        ])
      )
    : new Map();
  const globalHydrationRequestKey =
    searchParams && viewData.scope === "global"
      ? buildReviewHydrationRequestKey(searchParams)
      : null;

  useEffect(() => {
    latestViewDataRef.current = viewData;
  }, [viewData]);

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
    if (!selectedCard || !isQueueCard || !nextQueueCardId) {
      return;
    }

    if (
      prefetchedNextCardId === nextQueueCardId &&
      prefetchedNextCard?.id === nextQueueCardId
    ) {
      return;
    }

    let cancelled = false;

    void prefetchReviewCardSessionAction({
      cardId: nextQueueCardId
    })
      .then((card) => {
        if (cancelled) {
          return;
        }

        setPrefetchedNextCard(card?.id === nextQueueCardId ? card : null);
        setPrefetchedNextCardId(nextQueueCardId);
      })
      .catch((error) => {
        console.error(error);

        if (cancelled) {
          return;
        }

        setPrefetchedNextCard(null);
        setPrefetchedNextCardId(nextQueueCardId);
      });

    return () => {
      cancelled = true;
    };
  }, [
    isQueueCard,
    nextQueueCardId,
    prefetchedNextCard?.id,
    prefetchedNextCardId,
    selectedCard
  ]);

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

  function handleGradeCard(rating: (typeof ratingCopy)[number]["value"]) {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;

    setPendingAnsweredCountScroll(fullViewData.session.answeredCount);

    if (!isQueueCard) {
      runSessionUpdate(
        () =>
          gradeReviewCardSessionAction({
            answeredCount: fullViewData.session.answeredCount,
            cardId: selectedCard.id,
            cardMediaSlug: selectedCard.mediaSlug,
            extraNewCount: fullViewData.session.extraNewCount,
            mediaSlug:
              fullViewData.scope === "media"
                ? fullViewData.media.slug
                : undefined,
            rating,
            scope: fullViewData.scope
          }),
        {
          onError: () => {
            setPendingAnsweredCountScroll(null);
          }
        }
      );
      return;
    }

    const nextCardId = nextQueueCardId ?? undefined;
    const nextQueueCardIds = queueCardIds.filter(
      (id) => id !== selectedCard.id
    );
    const optimisticNextCard =
      nextCardId && prefetchedNextCardId === nextCardId
        ? prefetchedNextCard
        : null;
    const canOptimisticallyAdvance = !nextCardId || optimisticNextCard !== null;

    runSessionUpdate(
      () =>
        gradeReviewCardSessionAction({
          answeredCount: fullViewData.session.answeredCount,
          cardId: selectedCard.id,
          cardMediaSlug: selectedCard.mediaSlug,
          extraNewCount: fullViewData.session.extraNewCount,
          gradedCardBucket: selectedCard.bucket,
          mediaSlug:
            fullViewData.scope === "media"
              ? fullViewData.media.slug
              : undefined,
          nextCardId,
          rating,
          scope: fullViewData.scope,
          sessionMedia: fullViewData.media,
          sessionQueue: fullViewData.queue,
          sessionSettings: fullViewData.settings
        }),
      {
        onError: () => {
          setPendingAnsweredCountScroll(null);
        },
        optimisticUpdate: canOptimisticallyAdvance
          ? () => {
              const previousViewData = fullViewData;
              const previousQueueCardIds = queueCardIds;
              const previousPrefetchedNextCard = prefetchedNextCard;
              const previousPrefetchedNextCardId = prefetchedNextCardId;

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
                setPrefetchedNextCard(previousPrefetchedNextCard);
                setPrefetchedNextCardId(previousPrefetchedNextCardId);
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

    runSessionUpdate(() =>
      markLinkedEntryKnownSessionAction({
        answeredCount: fullViewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: fullViewData.session.extraNewCount,
        mediaSlug:
          fullViewData.scope === "media" ? fullViewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: fullViewData.scope
      })
    );
  }

  function handleSetLearning() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;

    runSessionUpdate(() =>
      setLinkedEntryLearningSessionAction({
        answeredCount: fullViewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: fullViewData.session.extraNewCount,
        mediaSlug:
          fullViewData.scope === "media" ? fullViewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: fullViewData.scope
      })
    );
  }

  function handleResetCard() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;

    runSessionUpdate(() =>
      resetReviewCardSessionAction({
        answeredCount: fullViewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: fullViewData.session.extraNewCount,
        mediaSlug:
          fullViewData.scope === "media" ? fullViewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: fullViewData.scope
      })
    );
  }

  function handleToggleSuspended() {
    if (!selectedCard) {
      return;
    }

    const fullViewData = viewData as ReviewPageData;

    runSessionUpdate(() =>
      setReviewCardSuspendedSessionAction({
        answeredCount: fullViewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: fullViewData.session.extraNewCount,
        mediaSlug:
          fullViewData.scope === "media" ? fullViewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: fullViewData.scope,
        suspended: selectedCard.bucket !== "suspended"
      })
    );
  }

  return (
    <div className="review-page">
      <section className="hero-grid hero-grid--detail review-workspace">
        <SurfaceCard className="review-stage" variant="hero">
          {selectedCard ? (
            <>
              <div className="review-stage__top">
                <div className="review-stage__chips">
                  <span className="chip">{selectedCard.bucketLabel}</span>
                  <span className="meta-pill">{selectedCard.typeLabel}</span>
                  <span className="meta-pill">
                    {selectedCard.effectiveStateLabel}
                  </span>
                  {viewData.scope === "global" ? (
                    <span className="meta-pill">{selectedCard.mediaTitle}</span>
                  ) : null}
                  {selectedCard.segmentTitle ? (
                    <span className="meta-pill">
                      {selectedCard.segmentTitle}
                    </span>
                  ) : null}
                </div>
                {remainingCount > 0 ? (
                  <p className="review-stage__position">
                    {formatRemainingCardsLabel(remainingCount)}
                  </p>
                ) : null}
              </div>

              <div className="review-stage__card">
                <p className="eyebrow">Fronte</p>
                <h2 className="review-stage__front jp-inline">
                  {showFrontFurigana
                    ? renderFurigana(selectedCard.front)
                    : stripInlineMarkdown(selectedCard.front)}
                </h2>
                {!isAnswerRevealed ? (
                  <div className="review-stage__veil">
                    <button
                      className="button button--primary review-stage__reveal"

                      type="button"
                      onClick={handleRevealAnswer}
                    >
                      Mostra risposta
                    </button>
                  </div>
                ) : (
                  <div className="review-stage__answer">
                    <p className="eyebrow">Retro</p>
                    {selectedCard.reading ? (
                      <p className="review-stage__reading jp-inline">
                        {selectedCard.reading}
                      </p>
                    ) : null}
                    <p className="review-stage__back">{selectedCard.back}</p>
                    {fullSelectedCard &&
                    fullSelectedCard.pronunciations.length > 0 ? (
                      <div className="stack-list stack-list--tight">
                        {showCompactPronunciation ? (
                          <p className="eyebrow">Pronuncia</p>
                        ) : null}
                        {fullSelectedCard.pronunciations.map((item) => (
                          <PronunciationAudio
                            key={`${item.kind}:${item.label}:${item.audio.src ?? item.audio.pitchAccent?.downstep ?? "no-audio"}`}
                            audio={item.audio}
                            compact={showCompactPronunciation}
                            preload="auto"
                            title={`${item.relationshipLabel} · ${item.label}`}
                          />
                        ))}
                      </div>
                    ) : null}
                    {selectedCard.exampleJp && selectedCard.exampleIt ? (
                      <section className="reader-example-sentence">
                        <p className="reader-example-sentence__jp jp-inline">
                          {renderFurigana(selectedCard.exampleJp)}
                        </p>
                        <details className="reader-example-sentence__translation">
                          <summary>Mostra traduzione italiana</summary>
                          <div className="reader-example-sentence__translation-body">
                            <p>{renderFurigana(selectedCard.exampleIt)}</p>
                          </div>
                        </details>
                      </section>
                    ) : null}
                    {selectedCard.notes ? (
                      <p className="review-stage__notes">
                        {renderFurigana(selectedCard.notes)}
                      </p>
                    ) : null}
                    {fullSelectedCard &&
                    fullSelectedCard.contexts.length > 1 ? (
                      <div className="stack-list stack-list--tight">
                        <p className="eyebrow">Compare anche in</p>
                        {fullSelectedCard.contexts
                          .slice(0, 4)
                          .map((context) => (
                            <p
                              key={context.cardId}
                              className="review-stage__meta"
                            >
                              <strong>{context.mediaTitle}</strong>
                              {context.segmentTitle
                                ? ` · ${context.segmentTitle}`
                                : ""}
                              {`: ${context.front}`}
                            </p>
                          ))}
                      </div>
                    ) : null}
                    {selectedCard.dueLabel ? (
                      <p className="review-stage__meta">
                        {selectedCard.dueLabel}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {isFullReviewPageData &&
              isQueueCard &&
              isAnswerRevealed ? (
                <div className="review-grade-grid">
                  {ratingCopy.map((rating) => (
                    <button
                      key={rating.value}
                      className={`review-grade-button review-grade-button--${rating.tone}`}
                      disabled={isPending}
                      type="button"
                      onClick={() => handleGradeCard(rating.value)}
                    >
                      <span>{rating.label}</span>
                      <small>{rating.detail}</small>
                      <small className="review-grade-button__next">
                        Prossima review:{" "}
                        {gradePreviewLookup.get(rating.value) ?? "n/d"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : isHydratingFullData ? (
                <div className="review-sidebar__notice">
                  <p>Sto completando i dettagli della review in background.</p>
                </div>
              ) : null}

              {isFullReviewPageData ? (
                <>
                  <div className="review-stage__actions">
                    {selectedCard.bucket === "manual" ? (
                      <button
                        className="button button--primary"
                        disabled={isPending}
                        type="button"
                        onClick={handleSetLearning}
                      >
                        Rimetti in studio
                      </button>
                    ) : (
                      <button
                        className="button button--ghost"
                        disabled={isPending}
                        type="button"
                        onClick={handleMarkKnown}
                      >
                        Segna già nota
                      </button>
                    )}

                    <button
                      className="button button--ghost"
                      disabled={isPending}
                      type="button"
                      onClick={handleResetCard}
                    >
                      Reset card
                    </button>

                    <button
                      className="button button--ghost"
                      disabled={isPending}
                      type="button"
                      onClick={handleToggleSuspended}
                    >
                      {selectedCard.bucket === "suspended"
                        ? "Riprendi"
                        : "Sospendi"}
                    </button>

                    {fullSelectedCard
                      ? fullSelectedCard.entries.map((entry) => (
                          <Link
                            key={entry.id}
                            className="button button--ghost button--small"
                            href={appendReturnToParam(entry.href, sessionHref)}
                          >
                            Apri la voce nel Glossary
                          </Link>
                        ))
                      : null}
                  </div>

                  {selectedCard.bucket === "manual" ? (
                    <p className="review-stage__hint">
                      Lo stato manuale si applica alle voci collegate: la card
                      resta intatta e riprende il suo scheduling appena la
                      rimetti in studio.
                    </p>
                  ) : selectedCard.bucket === "suspended" ? (
                    <p className="review-stage__hint">
                      La sospensione usa lo stato della card, non cancella
                      intervalli o log già presenti.
                    </p>
                  ) : null}
                </>
              ) : null}
            </>
          ) : showCompletionState ? (
            <EmptyState
              title={
                isGlobalReview
                  ? viewData.session.answeredCount > 0
                    ? "Sessione chiusa, ora sei in pari su tutta la Review."
                    : "Oggi sei in pari su tutta la Review."
                  : viewData.session.answeredCount > 0
                    ? "Sessione chiusa, ora sei in pari."
                    : "Oggi sei in pari."
              }
              description={
                additionalNewCount > 0
                  ? isGlobalReview
                    ? `La coda di oggi è finita. Puoi chiudere qui oppure aprire subito altre ${additionalNewCount} nuove${additionalNewCount === 1 ? "" : " card"} disponibili nella review globale.`
                    : `La coda di oggi è finita. Puoi chiudere qui oppure aprire subito altre ${additionalNewCount} nuove${additionalNewCount === 1 ? "" : " card"} disponibili per questo media.`
                  : hasSupportCards
                    ? "La coda di oggi non richiede altre risposte. Se ti serve intervenire su card già note, sospese o fuori finestra, puoi farlo dal Glossary o dalle impostazioni di studio."
                    : isGlobalReview
                      ? "La review globale non ha ancora card da lavorare o mantenere adesso."
                      : "Per questo media non ci sono altre card da lavorare o mantenere adesso."
              }
              action={
                <>
                  {additionalNewCount > 0 ? (
                    <Link
                      className="button button--primary"
                      href={buildCanonicalReviewSessionHrefForBase({
                        answeredCount: viewData.session.answeredCount,
                        baseHref: viewData.media.reviewHref,
                        extraNewCount:
                          viewData.session.extraNewCount + additionalNewCount,
                        isQueueCard: true,
                        position: 1
                      })}
                    >
                      {formatTopUpLabel(additionalNewCount)}
                    </Link>
                  ) : null}
                  <Link
                    className="button button--ghost"
                    href={contextualGlossaryHref}
                  >
                    Apri Glossary
                  </Link>
                </>
              }
            />
          ) : (
            <EmptyState
              title={
                isGlobalReview
                  ? "Nessuna card pronta nella review globale."
                  : "Nessuna card da gestire."
              }
              description={
                isGlobalReview
                  ? "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso della review globale."
                  : "Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso di Review del media."
              }
              action={
                <Link
                  className="button button--ghost"
                  href={contextualGlossaryHref}
                >
                  Apri Glossary
                </Link>
              }
            />
          )}
        </SurfaceCard>

        <SurfaceCard className="review-sidebar">
          <p className="eyebrow">Sessione</p>
          <div className="stats-grid review-session-stats">
            <StatBlock
              detail="Card pronte nella sessione di adesso."
              label="In coda"
              value={String(viewData.queue.queueCount)}
            />
            <StatBlock
              detail="Card già in Review previste per oggi."
              label="Da ripassare"
              tone={viewData.queue.dueCount > 0 ? "warning" : "default"}
              value={String(viewData.queue.dueCount)}
            />
            <StatBlock
              detail={
                isGlobalReview
                  ? `${viewData.queue.newAvailableCount} nuove disponibili nella review globale.`
                  : `${viewData.queue.newAvailableCount} nuove disponibili in totale per questo media.`
              }
              label="Nuove"
              value={String(viewData.queue.newQueuedCount)}
            />
          </div>

          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Escluse manualmente</span>
              <strong>{viewData.queue.manualCount}</strong>
            </div>
            <div className="summary-row">
              <span>Sospese</span>
              <strong>{viewData.queue.suspendedCount}</strong>
            </div>
            <div className="summary-row">
              <span>Da ripassare nei prossimi giorni</span>
              <strong>{viewData.queue.upcomingCount}</strong>
            </div>
          </div>

          {isPending ? (
            <div className="review-sidebar__notice">
              <p>Aggiornamento della review in corso...</p>
            </div>
          ) : null}

          {clientError ? (
            <div className="review-sidebar__notice">
              <p>{clientError}</p>
            </div>
          ) : null}

          {viewData.session.notice ? (
            <div className="review-sidebar__notice">
              <p>{viewData.session.notice}</p>
            </div>
          ) : null}
        </SurfaceCard>
      </section>
    </div>
  );
}

function formatRemainingCardsLabel(count: number) {
  return count === 1 ? "1 flashcard rimanente" : `${count} flashcard rimanenti`;
}

function buildOptimisticGradeResult(input: {
  currentData: ReviewPageData;
  gradedCardBucket: ReviewQueueCard["bucket"];
  nextCard: ReviewQueueCard | null;
  nextQueueCardIds: string[];
}): ReviewPageData {
  return {
    ...input.currentData,
    queue: buildOptimisticQueueUpdate(
      input.currentData.queue,
      input.gradedCardBucket
    ),
    selectedCard: input.nextCard,
    selectedCardContext: input.nextCard
      ? {
          bucket: input.nextCard.bucket,
          gradePreviews: input.nextCard.gradePreviews,
          isQueueCard: true,
          position: 1,
          remainingCount: Math.max(0, input.nextQueueCardIds.length - 1),
          showAnswer: false
        }
      : {
          bucket: null,
          gradePreviews: [],
          isQueueCard: false,
          position: null,
          remainingCount: 0,
          showAnswer: false
        },
    session: {
      answeredCount: input.currentData.session.answeredCount + 1,
      extraNewCount: input.currentData.session.extraNewCount
    }
  };
}

function buildOptimisticQueueUpdate(
  currentQueue: ReviewPageData["queue"],
  gradedCardBucket: ReviewQueueCard["bucket"]
): ReviewPageData["queue"] {
  const isQueuedBucket =
    gradedCardBucket === "due" || gradedCardBucket === "new";

  return {
    ...currentQueue,
    dueCount:
      gradedCardBucket === "due"
        ? Math.max(0, currentQueue.dueCount - 1)
        : currentQueue.dueCount,
    newQueuedCount:
      gradedCardBucket === "new"
        ? Math.max(0, currentQueue.newQueuedCount - 1)
        : currentQueue.newQueuedCount,
    queueCount: Math.max(0, currentQueue.queueCount - (isQueuedBucket ? 1 : 0))
  };
}

function showCompletionTopUp(data: ReviewPageClientData) {
  if (data.queue.queueCount > 0 || data.selectedCard !== null) {
    return 0;
  }

  return Math.min(10, data.queue.newAvailableCount);
}

function formatTopUpLabel(count: number) {
  return count === 1
    ? "Aggiungi ancora 1 nuova"
    : `Aggiungi altre ${count} nuove`;
}

function isReviewPageData(data: ReviewPageClientData): data is ReviewPageData {
  return "queueCardIds" in data;
}

function buildReviewHydrationRequestKey(
  searchParams: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    if (key === "show" || rawValue === undefined) {
      continue;
    }

    if (typeof rawValue === "string") {
      params.append(key, rawValue);
      continue;
    }

    for (const value of [...rawValue].sort()) {
      params.append(key, value);
    }
  }

  return params.toString();
}
