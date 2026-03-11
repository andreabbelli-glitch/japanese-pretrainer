import Link from "next/link";

import { renderFurigana } from "@/lib/render-furigana";
import { buildReviewSessionHref } from "@/lib/site";
import {
  markLinkedEntryKnownAction,
  resetReviewCardAction,
  setLinkedEntryLearningAction,
  setReviewCardSuspendedAction
} from "@/actions/review";
import type { ReviewCardDetailData } from "@/lib/review";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";

type ReviewCardDetailPageProps = {
  data: ReviewCardDetailData;
};

export function ReviewCardDetailPage({ data }: ReviewCardDetailPageProps) {
  const sessionHref = buildReviewSessionHref({
    cardId: data.card.id,
    mediaSlug: data.media.slug
  });

  return (
    <div className="glossary-page">
      <StickyPageHeader
        backHref={data.media.reviewHref}
        backLabel="Torna alla review"
        eyebrow="Review card"
        title={data.card.front}
        summary={data.card.back}
        meta={
          <>
            <span>{data.card.reviewLabel}</span>
            <span>{data.card.typeLabel}</span>
            {data.card.segmentTitle ? (
              <span>{data.card.segmentTitle}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link className="button button--primary" href={sessionHref}>
              Apri nella sessione
            </Link>
            <Link
              className="button button--ghost"
              href={data.media.glossaryHref}
            >
              Apri glossary
            </Link>
          </>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="glossary-entry-hero" variant="hero">
          <p className="eyebrow">Carta</p>
          <h2 className="glossary-entry-hero__title jp-inline">
            {data.card.front}
          </h2>
          {data.card.reading ? (
            <p className="glossary-entry-hero__reading jp-inline">
              {data.card.reading}
            </p>
          ) : null}
          <p className="glossary-entry-hero__meaning">{data.card.back}</p>
          <p className="glossary-entry-hero__detail">
            Tipo: {data.card.typeLabel}
          </p>
          <p className="glossary-entry-hero__detail">
            Stato review: {data.card.reviewLabel}
          </p>
          {data.card.dueLabel ? (
            <p className="glossary-entry-hero__detail">{data.card.dueLabel}</p>
          ) : null}
          {data.card.notes ? (
            <p className="glossary-entry-hero__notes">
              {renderFurigana(data.card.notes)}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="glossary-side">
          <p className="eyebrow">Contesto</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Media</span>
              <strong>{data.media.title}</strong>
            </div>
            <div className="summary-row">
              <span>Card ID</span>
              <strong>{data.card.id}</strong>
            </div>
            <div className="summary-row">
              <span>Entry collegate</span>
              <strong>{data.entries.length}</strong>
            </div>
            {data.card.bucketLabel ? (
              <div className="summary-row">
                <span>Bucket</span>
                <strong>{data.card.bucketLabel}</strong>
              </div>
            ) : null}
          </div>
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Azioni"
        title="Gestisci la card"
        description="Le azioni restano locali e non cancellano mai lo storico review già presente nel DB."
      >
        <div className="hero-actions">
          {data.card.reviewLabel === "Già nota" ? (
            <form action={setLinkedEntryLearningAction}>
              <ReviewDetailActionFields
                cardId={data.card.id}
                mediaSlug={data.media.slug}
              />
              <button className="button button--primary" type="submit">
                Rimetti in studio
              </button>
            </form>
          ) : (
            <form action={markLinkedEntryKnownAction}>
              <ReviewDetailActionFields
                cardId={data.card.id}
                mediaSlug={data.media.slug}
              />
              <button className="button button--ghost" type="submit">
                Segna già nota
              </button>
            </form>
          )}

          <form action={resetReviewCardAction}>
            <ReviewDetailActionFields
              cardId={data.card.id}
              mediaSlug={data.media.slug}
            />
            <button className="button button--ghost" type="submit">
              Reset card
            </button>
          </form>

          <form action={setReviewCardSuspendedAction}>
            <ReviewDetailActionFields
              cardId={data.card.id}
              mediaSlug={data.media.slug}
            />
            <input
              name="suspended"
              type="hidden"
              value={data.card.bucketLabel === "Sospesa" ? "false" : "true"}
            />
            <button className="button button--ghost" type="submit">
              {data.card.bucketLabel === "Sospesa" ? "Riprendi" : "Sospendi"}
            </button>
          </form>
        </div>
      </Section>

      <Section
        eyebrow="Collegamenti"
        title="Entry collegate"
        description="La card resta ancorata alle entry canoniche del glossary, cosi puoi passare dal ripasso al contesto senza perdere il punto."
      >
        {data.entries.length > 0 ? (
          <div className="glossary-detail-list">
            {data.entries.map((entry) => (
              <Link
                key={entry.id}
                className="glossary-detail-link"
                href={entry.href}
              >
                <SurfaceCard className="glossary-detail-card" variant="quiet">
                  <div className="glossary-detail-card__top">
                    <div className="glossary-detail-card__chips">
                      <span className="chip">{entry.relationshipLabel}</span>
                      <span className="meta-pill">
                        {entry.kind === "term" ? "Term" : "Grammar"}
                      </span>
                    </div>
                    <span className="glossary-result-card__arrow">
                      Apri entry
                    </span>
                  </div>
                  <h3 className="glossary-detail-card__title jp-inline">
                    {entry.label}
                  </h3>
                  {entry.subtitle ? (
                    <p className="glossary-entry-hero__subtitle jp-inline">
                      {entry.subtitle}
                    </p>
                  ) : null}
                  <p className="glossary-detail-card__body">{entry.meaning}</p>
                </SurfaceCard>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna entry collegata."
            description="La card esiste nel DB, ma non ha ancora entry canoniche leggibili dal glossary."
          />
        )}
      </Section>
    </div>
  );
}

function ReviewDetailActionFields({
  cardId,
  mediaSlug
}: {
  cardId: string;
  mediaSlug: string;
}) {
  return (
    <>
      <input name="mediaSlug" type="hidden" value={mediaSlug} />
      <input name="cardId" type="hidden" value={cardId} />
      <input name="answered" type="hidden" value="0" />
      <input name="redirectMode" type="hidden" value="stay_detail" />
    </>
  );
}
