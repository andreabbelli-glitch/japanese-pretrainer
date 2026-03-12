import type { Route } from "next";
import Link from "next/link";

import {
  gradeReviewCardAction,
  markLinkedEntryKnownAction,
  resetReviewCardAction,
  setLinkedEntryLearningAction,
  setReviewCardSuspendedAction
} from "@/actions/review";
import { renderFurigana } from "@/lib/render-furigana";
import type { ReviewPageData } from "@/lib/review";
import { appendReturnToParam, buildReviewSessionHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { PronunciationAudio } from "../ui/pronunciation-audio";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type ReviewPageProps = {
  data: ReviewPageData;
};

const ratingCopy = [
  {
    action: gradeReviewCardAction,
    detail: "Allunga l’intervallo con prudenza.",
    label: "Easy",
    tone: "easy" as const,
    value: "easy"
  },
  {
    action: gradeReviewCardAction,
    detail: "Passa al prossimo intervallo utile.",
    label: "Good",
    tone: "good" as const,
    value: "good"
  },
  {
    action: gradeReviewCardAction,
    detail: "Resta fragile, ma va avanti.",
    label: "Hard",
    tone: "hard" as const,
    value: "hard"
  },
  {
    action: gradeReviewCardAction,
    detail: "Torna subito o quasi subito.",
    label: "Again",
    tone: "again" as const,
    value: "again"
  }
] as const;

export function ReviewPage({ data }: ReviewPageProps) {
  const selectedCard = data.selectedCard;
  const showCompactPronunciation =
    (selectedCard?.pronunciations.length ?? 0) <= 1;
  const hasQueue = data.queue.cards.length > 0;
  const hasSupportCards =
    data.queue.manualCount +
      data.queue.suspendedCount +
      data.queue.upcomingCount >
    0;
  const additionalNewCount = showCompletionTopUp(data);
  const sessionHref = buildReviewSessionHref({
    answeredCount: data.session.answeredCount,
    cardId: selectedCard?.id ?? null,
    extraNewCount: data.session.extraNewCount,
    mediaSlug: data.media.slug,
    showAnswer: data.selectedCardContext.showAnswer
  });
  const contextualGlossaryHref = appendReturnToParam(
    data.media.glossaryHref,
    sessionHref
  );
  const contextualSettingsHref = appendReturnToParam("/settings", sessionHref);
  const showCompletionState = !hasQueue && selectedCard === null;
  const actionRedirectMode = data.selectedCardContext.isQueueCard
    ? "advance_queue"
    : "preserve_card";
  const gradePreviewLookup = new Map(
    data.selectedCardContext.gradePreviews.map((preview) => [
      preview.rating,
      preview.nextReviewLabel
    ])
  );

  return (
    <div className="review-page">
      <StickyPageHeader
        backHref={data.media.href}
        backLabel={`Torna a ${data.media.title}`}
        eyebrow="Review"
        summary={data.queue.introLabel}
        title={data.media.title}
        meta={
          <>
            <span>{data.queue.queueCount} in coda</span>
            <span>{data.queue.dueCount} da ripassare</span>
            <span>Nuove oggi {data.queue.effectiveDailyLimit}</span>
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
                {data.selectedCardContext.position ? (
                  <p className="review-stage__position">
                    {data.selectedCardContext.position} /{" "}
                    {data.queue.queueCount}
                  </p>
                ) : null}
              </div>

              <div className="review-stage__card">
                <p className="eyebrow">Fronte</p>
                <h2 className="review-stage__front jp-inline">
                  {selectedCard.front}
                </h2>
                {!data.selectedCardContext.showAnswer ? (
                  <div className="review-stage__veil">
                    <Link
                      className="button button--primary review-stage__reveal"
                      href={buildRevealHref(data, selectedCard.id)}
                    >
                      Mostra risposta
                    </Link>
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

              {data.selectedCardContext.isQueueCard &&
              data.selectedCardContext.showAnswer ? (
                <div className="review-grade-grid">
                  {ratingCopy.map((rating) => (
                    <form key={rating.value} action={rating.action}>
                      <ReviewActionFields
                        answeredCount={data.session.answeredCount}
                        cardId={selectedCard.id}
                        extraNewCount={data.session.extraNewCount}
                        mediaSlug={data.media.slug}
                      />
                      <input name="rating" type="hidden" value={rating.value} />
                      <button
                        className={`review-grade-button review-grade-button--${rating.tone}`}
                        type="submit"
                      >
                        <span>{rating.label}</span>
                        <small>{rating.detail}</small>
                        <small className="review-grade-button__next">
                          Prossima review:{" "}
                          {gradePreviewLookup.get(rating.value) ?? "n/d"}
                        </small>
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}

              <div className="review-stage__actions">
                {selectedCard.bucket === "manual" ? (
                  <form action={setLinkedEntryLearningAction}>
                    <ReviewActionFields
                      answeredCount={data.session.answeredCount}
                      cardId={selectedCard.id}
                      extraNewCount={data.session.extraNewCount}
                      mediaSlug={data.media.slug}
                      redirectMode={actionRedirectMode}
                    />
                    <button className="button button--primary" type="submit">
                      Rimetti in studio
                    </button>
                  </form>
                ) : (
                  <form action={markLinkedEntryKnownAction}>
                    <ReviewActionFields
                      answeredCount={data.session.answeredCount}
                      cardId={selectedCard.id}
                      extraNewCount={data.session.extraNewCount}
                      mediaSlug={data.media.slug}
                      redirectMode={actionRedirectMode}
                    />
                    <button className="button button--ghost" type="submit">
                      Segna già nota
                    </button>
                  </form>
                )}

                <form action={resetReviewCardAction}>
                  <ReviewActionFields
                    answeredCount={data.session.answeredCount}
                    cardId={selectedCard.id}
                    extraNewCount={data.session.extraNewCount}
                    mediaSlug={data.media.slug}
                    redirectMode={actionRedirectMode}
                  />
                  <button className="button button--ghost" type="submit">
                    Reset card
                  </button>
                </form>

                <form action={setReviewCardSuspendedAction}>
                  <ReviewActionFields
                    answeredCount={data.session.answeredCount}
                    cardId={selectedCard.id}
                    extraNewCount={data.session.extraNewCount}
                    mediaSlug={data.media.slug}
                    redirectMode={actionRedirectMode}
                  />
                  <input
                    name="suspended"
                    type="hidden"
                    value={
                      selectedCard.bucket === "suspended" ? "false" : "true"
                    }
                  />
                  <button className="button button--ghost" type="submit">
                    {selectedCard.bucket === "suspended"
                      ? "Riprendi"
                      : "Sospendi"}
                  </button>
                </form>

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
                data.session.answeredCount > 0
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
                        answeredCount: data.session.answeredCount,
                        extraNewCount:
                          data.session.extraNewCount + additionalNewCount,
                        mediaSlug: data.media.slug
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
              value={String(data.queue.queueCount)}
            />
            <StatBlock
              detail="Card già in Review previste per oggi."
              label="Da ripassare"
              tone={data.queue.dueCount > 0 ? "warning" : "default"}
              value={String(data.queue.dueCount)}
            />
            <StatBlock
              detail={`${data.queue.newAvailableCount} nuove disponibili in totale per questo media.`}
              label="Nuove"
              value={String(data.queue.newQueuedCount)}
            />
          </div>

          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Escluse manualmente</span>
              <strong>{data.queue.manualCount}</strong>
            </div>
            <div className="summary-row">
              <span>Sospese</span>
              <strong>{data.queue.suspendedCount}</strong>
            </div>
            <div className="summary-row">
              <span>Da ripassare nei prossimi giorni</span>
              <strong>{data.queue.upcomingCount}</strong>
            </div>
          </div>

          {data.session.notice ? (
            <div className="review-sidebar__notice">
              <p>{data.session.notice}</p>
            </div>
          ) : null}
        </SurfaceCard>
      </section>
    </div>
  );
}

function ReviewActionFields({
  answeredCount,
  cardId,
  extraNewCount,
  mediaSlug,
  redirectMode
}: {
  answeredCount: number;
  cardId: string;
  extraNewCount?: number;
  mediaSlug: string;
  redirectMode?: "advance_queue" | "preserve_card";
}) {
  return (
    <>
      <input name="mediaSlug" type="hidden" value={mediaSlug} />
      <input name="cardId" type="hidden" value={cardId} />
      <input name="answered" type="hidden" value={String(answeredCount)} />
      {extraNewCount && extraNewCount > 0 ? (
        <input name="extraNew" type="hidden" value={String(extraNewCount)} />
      ) : null}
      {redirectMode ? (
        <input name="redirectMode" type="hidden" value={redirectMode} />
      ) : null}
    </>
  );
}

function buildRevealHref(data: ReviewPageData, cardId: string): Route {
  const params = new URLSearchParams();

  params.set("card", cardId);
  params.set("show", "answer");

  if (data.session.answeredCount > 0) {
    params.set("answered", String(data.session.answeredCount));
  }

  if (data.session.extraNewCount > 0) {
    params.set("extraNew", String(data.session.extraNewCount));
  }

  return `${data.media.reviewHref}?${params.toString()}` as Route;
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
