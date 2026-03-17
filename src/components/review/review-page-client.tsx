"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import {
  gradeReviewCardSessionAction,
  markLinkedEntryKnownSessionAction,
  resetReviewCardSessionAction,
  revealReviewAnswerSessionAction,
  setLinkedEntryLearningSessionAction,
  setReviewCardSuspendedSessionAction
} from "@/actions/review";
import { renderFurigana } from "@/lib/render-furigana";
import type { ReviewPageData } from "@/lib/review";
import { appendReturnToParam, buildReviewSessionHref } from "@/lib/site";

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
  const [clientError, setClientError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCard = viewData.selectedCard;
  const showCompactPronunciation =
    (selectedCard?.pronunciations.length ?? 0) <= 1;
  const hasQueue = viewData.queue.cards.length > 0;
  const hasSupportCards =
    viewData.queue.manualCount +
      viewData.queue.suspendedCount +
      viewData.queue.upcomingCount >
    0;
  const additionalNewCount = showCompletionTopUp(viewData);
  const sessionHref = buildReviewSessionHref({
    answeredCount: viewData.session.answeredCount,
    cardId: selectedCard?.id ?? null,
    extraNewCount: viewData.session.extraNewCount,
    mediaSlug: viewData.media.slug,
    showAnswer: viewData.selectedCardContext.showAnswer
  });
  const contextualGlossaryHref = appendReturnToParam(
    viewData.media.glossaryHref,
    sessionHref
  );
  const contextualSettingsHref = appendReturnToParam("/settings", sessionHref);
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = viewData.selectedCardContext.isQueueCard
    ? "advance_queue"
    : "preserve_card";
  const gradePreviewLookup = new Map(
    viewData.selectedCardContext.gradePreviews.map((preview) => [
      preview.rating,
      preview.nextReviewLabel
    ])
  );

  function runSessionUpdate(loadNextData: () => Promise<ReviewPageData>) {
    setClientError(null);
    startTransition(() => {
      void loadNextData()
        .then((nextData) => {
          setViewData(nextData);
        })
        .catch((error) => {
          console.error(error);
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

    runSessionUpdate(() =>
      revealReviewAnswerSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug
      })
    );
  }

  function handleGradeCard(rating: (typeof ratingCopy)[number]["value"]) {
    if (!selectedCard) {
      return;
    }

    runSessionUpdate(() =>
      gradeReviewCardSessionAction({
        answeredCount: viewData.session.answeredCount,
        cardId: selectedCard.id,
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug,
        rating
      })
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
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug,
        redirectMode: actionRedirectMode
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
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug,
        redirectMode: actionRedirectMode
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
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug,
        redirectMode: actionRedirectMode
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
        extraNewCount: viewData.session.extraNewCount,
        mediaSlug: viewData.media.slug,
        redirectMode: actionRedirectMode,
        suspended: selectedCard.bucket !== "suspended"
      })
    );
  }

  return (
    <div className="review-page">
      <StickyPageHeader
        backHref={viewData.media.href}
        backLabel={`Torna a ${viewData.media.title}`}
        eyebrow="Review"
        summary={viewData.queue.introLabel}
        title={viewData.media.title}
        meta={
          <>
            <span>{viewData.queue.queueCount} in coda</span>
            <span>{viewData.queue.dueCount} da ripassare</span>
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
                  {selectedCard.segmentTitle ? (
                    <span className="meta-pill">
                      {selectedCard.segmentTitle}
                    </span>
                  ) : null}
                </div>
                {viewData.selectedCardContext.remainingCount > 0 ? (
                  <p className="review-stage__position">
                    {formatRemainingCardsLabel(
                      viewData.selectedCardContext.remainingCount
                    )}
                  </p>
                ) : null}
              </div>

              <div className="review-stage__card">
                <p className="eyebrow">Fronte</p>
                <h2 className="review-stage__front jp-inline">
                  {renderFurigana(selectedCard.front)}
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
                    {selectedCard.dueLabel ? (
                      <p className="review-stage__meta">
                        {selectedCard.dueLabel}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {viewData.selectedCardContext.isQueueCard &&
              viewData.selectedCardContext.showAnswer ? (
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
                viewData.session.answeredCount > 0
                  ? "Sessione chiusa, ora sei in pari."
                  : "Oggi sei in pari."
              }
              description={
                additionalNewCount > 0
                  ? `La coda di oggi è finita. Puoi chiudere qui oppure aprire subito altre ${additionalNewCount} nuove${additionalNewCount === 1 ? "" : " card"} disponibili per questo media.`
                  : hasSupportCards
                    ? "La coda di oggi non richiede altre risposte. Se ti serve intervenire su card già note, sospese o fuori finestra, puoi farlo dal Glossary o dalle impostazioni di studio."
                    : "Per questo media non ci sono altre card da lavorare o mantenere adesso."
              }
              action={
                <>
                  {additionalNewCount > 0 ? (
                    <Link
                      className="button button--primary"
                      href={buildReviewSessionHref({
                        answeredCount: viewData.session.answeredCount,
                        extraNewCount:
                          viewData.session.extraNewCount + additionalNewCount,
                        mediaSlug: viewData.media.slug
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
              title="Nessuna card da gestire."
              description="Quando importerai le prime card o riattiverai una voce dal Glossary, qui riapparirà il flusso di Review del media."
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
              detail={`${viewData.queue.newAvailableCount} nuove disponibili in totale per questo media.`}
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
