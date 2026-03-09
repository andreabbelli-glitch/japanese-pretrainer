import type { Route } from "next";
import Link from "next/link";

import {
  gradeReviewCardAction,
  markLinkedEntryKnownAction,
  resetReviewCardAction,
  setLinkedEntryLearningAction,
  setReviewCardSuspendedAction
} from "@/actions/review";
import type { ReviewPageData, ReviewQueueCard } from "@/lib/review";

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
            <span>{data.queue.dueCount} dovute</span>
            <span>Limite nuove {data.queue.dailyLimit}</span>
          </>
        }
        actions={
          <Link className="button button--ghost" href={data.media.glossaryHref}>
            Apri glossary
          </Link>
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
                  <span className="meta-pill">{selectedCard.effectiveStateLabel}</span>
                  {selectedCard.segmentTitle ? (
                    <span className="meta-pill">{selectedCard.segmentTitle}</span>
                  ) : null}
                </div>
                {data.selectedCardContext.position ? (
                  <p className="review-stage__position">
                    {data.selectedCardContext.position} / {data.queue.queueCount}
                  </p>
                ) : null}
              </div>

              <div className="review-stage__card">
                <p className="eyebrow">Fronte</p>
                <h2 className="review-stage__front jp-inline">{selectedCard.front}</h2>
                {!data.selectedCardContext.showAnswer ? (
                  <div className="review-stage__veil">
                    <p className="panel-note">
                      Mantieni il ritmo: guarda il fronte, poi apri la risposta solo quando
                      sei pronto a dare un voto.
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
                    <p className="review-stage__back">{selectedCard.back}</p>
                    {selectedCard.notes ? (
                      <p className="review-stage__notes">{selectedCard.notes}</p>
                    ) : null}
                    {selectedCard.dueLabel ? (
                      <p className="review-stage__meta">{selectedCard.dueLabel}</p>
                    ) : null}
                  </div>
                )}
              </div>

              {selectedCard.entries.length > 0 ? (
                <div className="review-entry-list">
                  {selectedCard.entries.map((entry) => (
                    <Link key={entry.id} className="review-entry-link" href={entry.href}>
                      <SurfaceCard className="review-entry-card" variant="quiet">
                        <div className="review-entry-card__top">
                          <div className="review-entry-card__chips">
                            <span className="chip">{entry.relationshipLabel}</span>
                            <span className="meta-pill">{entry.statusLabel}</span>
                          </div>
                          <span className="glossary-result-card__arrow">Apri entry</span>
                        </div>
                        <h3 className="review-entry-card__title jp-inline">{entry.label}</h3>
                        {entry.subtitle ? (
                          <p className="review-entry-card__subtitle jp-inline">
                            {entry.subtitle}
                          </p>
                        ) : null}
                        <p className="review-entry-card__body">{entry.meaning}</p>
                      </SurfaceCard>
                    </Link>
                  ))}
                </div>
              ) : null}

              {data.selectedCardContext.isQueueCard && data.selectedCardContext.showAnswer ? (
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
                  />
                  <input
                    name="suspended"
                    type="hidden"
                    value={selectedCard.bucket === "suspended" ? "false" : "true"}
                  />
                  <button className="button button--ghost" type="submit">
                    {selectedCard.bucket === "suspended" ? "Riprendi" : "Sospendi"}
                  </button>
                </form>
              </div>

              <p className="review-stage__hint">
                {selectedCard.bucket === "manual"
                  ? "Lo stato manuale vive sulle entry canoniche: la card resta intatta e riacquista il suo scheduling appena la rimetti in studio."
                  : selectedCard.bucket === "suspended"
                    ? "La sospensione usa lo stato della card, non cancella intervalli o log già presenti."
                    : "Il grading aggiorna `review_state` e aggiunge sempre un nuovo evento in `review_log`."}
              </p>
            </>
          ) : (
            <EmptyState
              title="Nessuna card da gestire."
              description="Quando importerai le prime card o riattiverai una voce dal glossary, qui apparirà il flusso review del media."
              action={
                <Link className="button button--ghost" href={data.media.glossaryHref}>
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
              detail="Card che puoi lavorare adesso."
              label="In coda"
              value={String(data.queue.queueCount)}
            />
            <StatBlock
              detail="Già entrate nel loop quotidiano."
              label="Dovute"
              tone={data.queue.dueCount > 0 ? "warning" : "default"}
              value={String(data.queue.dueCount)}
            />
            <StatBlock
              detail={`${data.queue.newAvailableCount} nuove disponibili nel media`}
              label="Nuove"
              value={String(data.queue.newQueuedCount)}
            />
            <StatBlock
              detail="Aggiornato solo in questa sessione aperta."
              label="Risposte"
              value={String(data.session.answeredCount)}
            />
          </div>

          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Manual mastery</span>
              <strong>{data.queue.manualCount}</strong>
            </div>
            <div className="summary-row">
              <span>Sospese</span>
              <strong>{data.queue.suspendedCount}</strong>
            </div>
            <div className="summary-row">
              <span>In rotazione</span>
              <strong>{data.queue.upcomingCount}</strong>
            </div>
            <div className="summary-row">
              <span>Restanti ora</span>
              <strong>{data.selectedCardContext.remainingCount}</strong>
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
              description="Il media non ha card dovute o nuove entro il limite giornaliero. Puoi restare in pari oppure gestire manualmente le card qui sotto."
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
              emptyLabel="Nessuna card coperta da manual mastery."
              title="Gia note"
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
              emptyLabel="Nessuna card già in rotazione."
              title="In rotazione"
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
      <SurfaceCard className={`review-queue-card${active ? " review-queue-card--active" : ""}`}>
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
  mediaSlug
}: {
  answeredCount: number;
  cardId: string;
  mediaSlug: string;
}) {
  return (
    <>
      <input name="mediaSlug" type="hidden" value={mediaSlug} />
      <input name="cardId" type="hidden" value={cardId} />
      <input name="answered" type="hidden" value={String(answeredCount)} />
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
