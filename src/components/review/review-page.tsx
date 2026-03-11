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
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review";
import { appendReturnToParam, buildReviewSessionHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type ReviewPageProps = {
  data: ReviewPageData;
};

const ratingCopy = [
  {
    action: gradeReviewCardAction,
    detail: "Torna subito o quasi subito.",
    label: "Again",
    tone: "again" as const,
    value: "again"
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
    detail: "Passa al prossimo intervallo utile.",
    label: "Good",
    tone: "good" as const,
    value: "good"
  },
  {
    action: gradeReviewCardAction,
    detail: "Allunga l’intervallo con prudenza.",
    label: "Easy",
    tone: "easy" as const,
    value: "easy"
  }
] as const;

export function ReviewPage({ data }: ReviewPageProps) {
  const selectedCard = data.selectedCard;
  const hasQueue = data.queue.cards.length > 0;
  const hasSupportCards =
    data.queue.manualCount +
      data.queue.suspendedCount +
      data.queue.upcomingCount >
    0;
  const sessionHref = buildReviewSessionHref({
    answeredCount: data.session.answeredCount,
    cardId: selectedCard?.id ?? null,
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
            <span>Limite nuove {data.queue.dailyLimit}</span>
          </>
        }
        actions={
          <>
            <Link
              className="button button--ghost"
              href={contextualGlossaryHref}
            >
              Apri glossary
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

      <section className="hero-grid hero-grid--detail">
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
                    <p className="panel-note">
                      Mantieni il ritmo: guarda il fronte, poi apri la risposta
                      solo quando sei pronto a dare un voto.
                    </p>
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
                        mediaSlug={data.media.slug}
                      />
                      <input name="rating" type="hidden" value={rating.value} />
                      <button
                        className={`review-grade-button review-grade-button--${rating.tone}`}
                        type="submit"
                      >
                        <span>{rating.label}</span>
                        <small>{rating.detail}</small>
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
                    Controlla nel glossario
                  </Link>
                ))}
              </div>

              {selectedCard.bucket === "manual" ? (
                <p className="review-stage__hint">
                  Lo stato manuale vive sulle entry canoniche: la card resta
                  intatta e riacquista il suo scheduling appena la rimetti in
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
                hasSupportCards
                  ? "La coda di oggi non richiede altre risposte. Se vuoi, qui sotto puoi consultare carte già in rotazione, sospese o già note senza rientrare nella sessione."
                  : "Per questo media non ci sono altre card da lavorare o mantenere adesso."
              }
              action={
                <Link
                  className="button button--ghost"
                  href={contextualGlossaryHref}
                >
                  Apri glossary
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Nessuna card da gestire."
              description="Quando importerai le prime card o riattiverai una voce dal glossary, qui apparirà il flusso review del media."
              action={
                <Link
                  className="button button--ghost"
                  href={contextualGlossaryHref}
                >
                  Apri glossary
                </Link>
              }
            />
          )}
        </SurfaceCard>

        <SurfaceCard className="review-sidebar">
          <p className="eyebrow">Sessione</p>
          <div className="stats-grid stats-grid--stacked">
            <StatBlock
              detail="Card pronte nella sessione di adesso."
              label="In coda"
              value={String(data.queue.queueCount)}
            />
            <StatBlock
              detail="Card già in review previste per oggi."
              label="Da ripassare"
              tone={data.queue.dueCount > 0 ? "warning" : "default"}
              value={String(data.queue.dueCount)}
            />
            <StatBlock
              detail={`${data.queue.newAvailableCount} nuove disponibili in totale per questo media.`}
              label="Nuove"
              value={String(data.queue.newQueuedCount)}
            />
            <StatBlock
              detail="Conta solo le risposte date in questa sessione."
              label="Risposte date"
              value={String(data.session.answeredCount)}
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

      <section className="content-section content-section--split review-sections">
        <Section
          eyebrow="Coda"
          title={hasQueue ? "Pronte oggi" : "Oggi sei in pari"}
          description={
            hasQueue
              ? "Due prima, nuove poi: la coda resta breve e leggibile, senza perdere il legame con le entry canoniche."
              : "Non ci sono carte da lavorare adesso. Se vuoi, puoi comunque controllare quelle già in rotazione o rimettere in studio una voce nota manualmente."
          }
        >
          {hasQueue ? (
            <div className="review-card-list">
              {data.queue.cards.map((card) => (
                <ReviewQueueLinkCard
                  active={card.id === selectedCard?.id}
                  answeredCount={data.session.answeredCount}
                  card={card}
                  key={card.id}
                  reviewHref={data.media.reviewHref}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="La coda di oggi è vuota."
              description="Per oggi non ci sono card da ripassare o nuove entro il limite giornaliero. Puoi restare in pari oppure gestire manualmente le card qui sotto."
            />
          )}
        </Section>

        <Section
          eyebrow="Fuori coda"
          title="Contesto utile"
          description="Le card qui sotto non entrano nella sessione di oggi, ma restano esplicitamente gestibili senza falsare il loro storico."
        >
          <div className="review-support-grid">
            <ReviewSupportPanel
              cards={data.queue.manualCards}
              emptyLabel="Nessuna card esclusa manualmente."
              title="Escluse manualmente"
              answeredCount={data.session.answeredCount}
              activeCardId={selectedCard?.id ?? null}
              reviewHref={data.media.reviewHref}
            />
            <ReviewSupportPanel
              cards={data.queue.suspendedCards}
              emptyLabel="Nessuna card sospesa."
              title="Sospese"
              answeredCount={data.session.answeredCount}
              activeCardId={selectedCard?.id ?? null}
              reviewHref={data.media.reviewHref}
            />
            <ReviewSupportPanel
              cards={data.queue.upcomingCards.slice(0, 6)}
              emptyLabel="Nessuna card da ripassare nei prossimi giorni."
              title="Da ripassare nei prossimi giorni"
              answeredCount={data.session.answeredCount}
              activeCardId={selectedCard?.id ?? null}
              reviewHref={data.media.reviewHref}
            />
          </div>
        </Section>
      </section>
    </div>
  );
}

function ReviewSupportPanel({
  activeCardId,
  answeredCount,
  cards,
  emptyLabel,
  reviewHref,
  title
}: {
  activeCardId: string | null;
  answeredCount: number;
  cards: ReviewQueueCard[];
  emptyLabel: string;
  title: string;
  reviewHref: ReviewPageData["media"]["reviewHref"];
}) {
  return (
    <SurfaceCard className="review-support-card" variant="quiet">
      <div className="review-support-card__top">
        <h3 className="review-support-card__title">{title}</h3>
        <span className="meta-pill">{cards.length}</span>
      </div>

      {cards.length > 0 ? (
        <div className="review-card-list review-card-list--compact">
          {cards.map((card) => (
            <ReviewQueueLinkCard
              active={card.id === activeCardId}
              answeredCount={answeredCount}
              card={card}
              key={card.id}
              reviewHref={reviewHref}
            />
          ))}
        </div>
      ) : (
        <p className="panel-note">{emptyLabel}</p>
      )}
    </SurfaceCard>
  );
}

function ReviewQueueLinkCard({
  active,
  answeredCount,
  card,
  reviewHref
}: {
  active: boolean;
  answeredCount: number;
  card: ReviewQueueCard;
  reviewHref: ReviewPageData["media"]["reviewHref"];
}) {
  return (
    <Link
      href={buildSelectionHref(reviewHref, card.id, answeredCount)}
      className="review-card-link"
    >
      <SurfaceCard
        className={`review-queue-card${active ? " review-queue-card--active" : ""}`}
      >
        <div className="review-queue-card__top">
          <div className="review-queue-card__chips">
            <span className="chip">{card.bucketLabel}</span>
            <span className="meta-pill">{card.effectiveStateLabel}</span>
          </div>
          <span className="glossary-result-card__arrow">Apri</span>
        </div>
        <h3 className="review-queue-card__title jp-inline">{card.front}</h3>
        <p className="review-queue-card__body">{card.back}</p>
        <p className="review-queue-card__meta">
          {[card.segmentTitle, card.dueLabel].filter(Boolean).join(" · ")}
        </p>
      </SurfaceCard>
    </Link>
  );
}

function ReviewActionFields({
  answeredCount,
  cardId,
  mediaSlug,
  redirectMode
}: {
  answeredCount: number;
  cardId: string;
  mediaSlug: string;
  redirectMode?: "advance_queue" | "preserve_card";
}) {
  return (
    <>
      <input name="mediaSlug" type="hidden" value={mediaSlug} />
      <input name="cardId" type="hidden" value={cardId} />
      <input name="answered" type="hidden" value={String(answeredCount)} />
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

  return `${data.media.reviewHref}?${params.toString()}` as Route;
}

function buildSelectionHref(
  reviewHref: ReviewPageData["media"]["reviewHref"],
  cardId: string,
  answeredCount: number
): Route {
  const params = new URLSearchParams();

  params.set("card", cardId);

  if (answeredCount > 0) {
    params.set("answered", String(answeredCount));
  }

  return `${reviewHref}?${params.toString()}` as Route;
}
