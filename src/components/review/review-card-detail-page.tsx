import Link from "next/link";

import type { ReviewCardDetailData } from "@/lib/review";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";

type ReviewCardDetailPageProps = {
  data: ReviewCardDetailData;
};

export function ReviewCardDetailPage({ data }: ReviewCardDetailPageProps) {
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
            {data.card.segmentTitle ? <span>{data.card.segmentTitle}</span> : null}
          </>
        }
        actions={
          <Link className="button button--ghost" href={data.media.glossaryHref}>
            Apri glossary
          </Link>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="glossary-entry-hero" variant="hero">
          <p className="eyebrow">Carta</p>
          <h2 className="glossary-entry-hero__title jp-inline">{data.card.front}</h2>
          <p className="glossary-entry-hero__meaning">{data.card.back}</p>
          <p className="glossary-entry-hero__detail">Tipo: {data.card.typeLabel}</p>
          <p className="glossary-entry-hero__detail">Stato review: {data.card.reviewLabel}</p>
          {data.card.dueLabel ? (
            <p className="glossary-entry-hero__detail">{data.card.dueLabel}</p>
          ) : null}
          {data.card.notes ? (
            <p className="glossary-entry-hero__notes">{data.card.notes}</p>
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
          </div>
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Collegamenti"
        title="Entry collegate"
        description="La card resta ancorata alle entry canoniche del glossary, cosi puoi passare dal ripasso al contesto senza perdere il punto."
      >
        {data.entries.length > 0 ? (
          <div className="glossary-detail-list">
            {data.entries.map((entry) => (
              <Link key={entry.id} className="glossary-detail-link" href={entry.href}>
                <SurfaceCard className="glossary-detail-card" variant="quiet">
                  <div className="glossary-detail-card__top">
                    <div className="glossary-detail-card__chips">
                      <span className="chip">{entry.relationshipLabel}</span>
                      <span className="meta-pill">{entry.kind === "term" ? "Term" : "Grammar"}</span>
                    </div>
                    <span className="glossary-result-card__arrow">Apri entry</span>
                  </div>
                  <h3 className="glossary-detail-card__title jp-inline">{entry.label}</h3>
                  {entry.subtitle ? (
                    <p className="glossary-entry-hero__subtitle jp-inline">{entry.subtitle}</p>
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
