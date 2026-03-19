"use client";

import { useEffect, useState, useTransition } from "react";

import Link from "next/link";

import {
  gradeReviewCardSessionAction,
  markLinkedEntryKnownSessionAction,
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
  buildCanonicalReviewSessionHrefForBase,
  reviewHref
} from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
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

export function ReviewPageClient({ data }: { data: ReviewPageData }) {
  const [viewData, setViewData] = useState(data);
  const [queueCardIds, setQueueCardIds] = useState(data.queueCardIds);
  const [clientError, setClientError] = useState<string | null>(null);
  const [prefetchedNextCard, setPrefetchedNextCard] =
    useState<ReviewQueueCard | null>(null);
  const [prefetchedNextCardId, setPrefetchedNextCardId] = useState<
    string | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const isGlobalReview = viewData.scope === "global";
  const hasAnyReviewCards =
    viewData.queue.dueCount +
      viewData.queue.newAvailableCount +
      viewData.queue.manualCount +
      viewData.queue.suspendedCount +
      viewData.queue.upcomingCount >
    0;

  const selectedCard = viewData.selectedCard;
  const queueIndex = selectedCard ? queueCardIds.indexOf(selectedCard.id) : -1;
  const isQueueCard = queueIndex >= 0;
  const nextQueueCardId = isQueueCard
    ? (queueCardIds[queueIndex + 1] ?? null)
    : null;
  const position = isQueueCard ? queueIndex + 1 : null;
  const remainingCount = isQueueCard ? queueCardIds.length - queueIndex - 1 : 0;
  const showCompactPronunciation =
    (selectedCard?.pronunciations.length ?? 0) <= 1;
  const hasQueue = viewData.queue.queueCount > 0;
  const hasSupportCards =
    viewData.queue.manualCount +
      viewData.queue.suspendedCount +
      viewData.queue.upcomingCount >
    0;
  const showFrontFurigana =
    viewData.settings.reviewFrontFurigana ||
    viewData.selectedCardContext.showAnswer;
  const additionalNewCount = showCompletionTopUp(viewData);
  const sessionHref = buildCanonicalReviewSessionHrefForBase({
    answeredCount: viewData.session.answeredCount,
    baseHref: viewData.media.reviewHref,
    cardId: selectedCard?.id ?? null,
    extraNewCount: viewData.session.extraNewCount,
    isQueueCard,
    position,
    showAnswer: viewData.selectedCardContext.showAnswer
  });
  const contextualGlossaryHref = appendReturnToParam(
    viewData.media.glossaryHref,
    sessionHref
  );
  const contextualSettingsHref = appendReturnToParam("/settings", sessionHref);
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = isQueueCard ? "advance_queue" : "preserve_card";
  const gradePreviewLookup = new Map(
    viewData.selectedCardContext.gradePreviews.map((preview) => [
      preview.rating,
      preview.nextReviewLabel
    ])
  );
  const reviewSummary = buildReviewSummary(
    viewData,
    isGlobalReview,
    hasAnyReviewCards
  );

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (currentHref !== sessionHref) {
      window.history.replaceState(window.history.state, "", sessionHref);
    }
  }, [sessionHref]);

  useEffect(() => {
    if (!selectedCard || !isQueueCard || !nextQueueCardId) {
      setPrefetchedNextCard(null);
      setPrefetchedNextCardId(null);
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
          setViewData(nextData);
          if (options?.shouldSyncQueueCardIds?.(nextData) ?? true) {
            setQueueCardIds(nextData.queueCardIds);
          }
          options?.onSuccess?.(nextData);
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

    setViewData((prev) => ({
      ...prev,
      selectedCardContext: {
        ...prev.selectedCardContext,
        gradePreviews: buildReviewGradePreviews(
          selectedCard.reviewSeedState,
          new Date()
        ),
        showAnswer: true
      }
    }));
  }

  function handleGradeCard(rating: (typeof ratingCopy)[number]["value"]) {
    if (!selectedCard) {
      return;
    }

    if (!isQueueCard) {
      runSessionUpdate(() =>
        gradeReviewCardSessionAction({
          answeredCount: viewData.session.answeredCount,
          cardId: selectedCard.id,
          cardMediaSlug: selectedCard.mediaSlug,
          extraNewCount: viewData.session.extraNewCount,
          mediaSlug:
            viewData.scope === "media" ? viewData.media.slug : undefined,
          rating,
          scope: viewData.scope
        })
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
          answeredCount: viewData.session.answeredCount,
          cardId: selectedCard.id,
          cardMediaSlug: selectedCard.mediaSlug,
          extraNewCount: viewData.session.extraNewCount,
          gradedCardBucket: selectedCard.bucket,
          mediaSlug:
            viewData.scope === "media" ? viewData.media.slug : undefined,
          nextCardId,
          rating,
          scope: viewData.scope,
          sessionMedia: viewData.media,
          sessionQueue: viewData.queue,
          sessionSettings: viewData.settings
        }),
      {
        optimisticUpdate: canOptimisticallyAdvance
          ? () => {
              const previousViewData = viewData;
              const previousQueueCardIds = queueCardIds;
              const previousPrefetchedNextCard = prefetchedNextCard;
              const previousPrefetchedNextCardId = prefetchedNextCardId;

              setViewData(
                buildOptimisticGradeResult({
                  currentData: viewData,
                  gradedCardBucket: selectedCard.bucket,
                  nextCard: optimisticNextCard ?? null,
                  nextQueueCardIds
                })
              );
              setQueueCardIds(nextQueueCardIds);
              setPrefetchedNextCard(null);
              setPrefetchedNextCardId(null);

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

    runSessionUpdate(() =>
      markLinkedEntryKnownSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: viewData.scope
      })
    );
  }

  function handleSetLearning() {
    if (!selectedCard) {
      return;
    }

    runSessionUpdate(() =>
      setLinkedEntryLearningSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: viewData.scope
      })
    );
  }

  function handleResetCard() {
    if (!selectedCard) {
      return;
    }

    runSessionUpdate(() =>
      resetReviewCardSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: viewData.scope
      })
    );
  }

  function handleToggleSuspended() {
    if (!selectedCard) {
      return;
    }

    runSessionUpdate(() =>
      setReviewCardSuspendedSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        cardMediaSlug: selectedCard.mediaSlug,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.scope === "media" ? viewData.media.slug : undefined,
        redirectMode: actionRedirectMode,
        scope: viewData.scope,
        suspended: selectedCard.bucket !== "suspended"
      })
    );
  }

  return (
    <div className="review-page">
      <StickyPageHeader
        backHref={viewData.media.href}
        backLabel={
          isGlobalReview ? "Torna alla Home" : `Torna a ${viewData.media.title}`
        }
        eyebrow="Review"
        summary={reviewSummary}
        title={viewData.media.title}
        meta={
          <>
            <span>{viewData.queue.queueCount} in coda</span>
            <span>{viewData.queue.dueCount} due</span>
            <span>Nuove oggi {viewData.queue.effectiveDailyLimit}</span>
          </>
        }
        actions={
          <>
            <Link
              className="button button--ghost"
              href={contextualGlossaryHref}
            >
              Apri Glossary
            </Link>
            <Link
              className="button button--ghost"
              href={contextualSettingsHref}
            >
              Settings
            </Link>
            {!isGlobalReview ? (
              <Link className="button button--ghost" href={reviewHref()}>
                Apri review globale
              </Link>
            ) : null}
          </>
        }
      />

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
                {!viewData.selectedCardContext.showAnswer ? (
                  <div className="review-stage__veil">
                    <button
                      className="button button--primary review-stage__reveal"
                      disabled={isPending}
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
                    {selectedCard.pronunciations.length > 0 ? (
                      <div className="stack-list stack-list--tight">
                        {showCompactPronunciation ? (
                          <p className="eyebrow">Pronuncia</p>
                        ) : null}
                        {selectedCard.pronunciations.map((item) => (
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
                    {selectedCard.contexts.length > 1 ? (
                      <div className="stack-list stack-list--tight">
                        <p className="eyebrow">Compare anche in</p>
                        {selectedCard.contexts.slice(0, 4).map((context) => (
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

              {isQueueCard && viewData.selectedCardContext.showAnswer ? (
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
              ) : null}

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

                {selectedCard.entries.map((entry) => (
                  <Link
                    key={entry.id}
                    className="button button--ghost button--small"
                    href={appendReturnToParam(entry.href, sessionHref)}
                  >
                    Apri la voce nel Glossary
                  </Link>
                ))}
              </div>

              {selectedCard.bucket === "manual" ? (
                <p className="review-stage__hint">
                  Lo stato manuale si applica alle voci collegate: la card resta
                  intatta e riprende il suo scheduling appena la rimetti in
                  studio.
                </p>
              ) : selectedCard.bucket === "suspended" ? (
                <p className="review-stage__hint">
                  La sospensione usa lo stato della card, non cancella
                  intervalli o log già presenti.
                </p>
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

function showCompletionTopUp(data: ReviewPageData) {
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

function buildReviewSummary(
  data: ReviewPageData,
  isGlobalReview: boolean,
  hasAnyReviewCards: boolean
) {
  if (!isGlobalReview || hasAnyReviewCards) {
    return data.queue.introLabel;
  }

  return "La review globale non ha ancora card attive da mettere in coda.";
}
