import Link from "next/link";
import type { Route } from "next";

import type { GlossaryDetailData } from "@/lib/glossary";
import { replaceReviewCardInHref } from "@/lib/site";
import { renderFurigana } from "@/lib/render-furigana";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";

type GlossaryDetailPageProps = {
  data: GlossaryDetailData;
  returnTo?: Route | null;
};

export function GlossaryDetailPage({
  data,
  returnTo
}: GlossaryDetailPageProps) {
  return (
    <div className="glossary-page">
      <StickyPageHeader
        backHref={returnTo ?? data.media.glossaryHref}
        backLabel={returnTo ? "Torna alla review" : "Torna al glossary"}
        eyebrow={data.entry.kind === "term" ? "Term" : "Grammar"}
        title={data.entry.label}
        summary={data.entry.meaning}
        meta={
          <>
            <span>{data.entry.studyState.label}</span>
            {data.entry.segmentTitle ? (
              <span>{data.entry.segmentTitle}</span>
            ) : null}
            {data.entry.levelHint ? <span>{data.entry.levelHint}</span> : null}
          </>
        }
        actions={
          <Link className="button button--ghost" href={data.media.textbookHref}>
            Apri textbook
          </Link>
        }
      />

      <GlossaryDetailPanels data={data} returnTo={returnTo} />
    </div>
  );
}

export function GlossaryDetailPanels({
  compact = false,
  data,
  returnTo
}: GlossaryDetailPageProps & {
  compact?: boolean;
}) {
  return (
    <>
      <section
        className={`hero-grid hero-grid--detail${compact ? " hero-grid--stacked" : ""}`}
      >
        <SurfaceCard className="glossary-entry-hero" variant="hero">
          <p className="eyebrow">Forma</p>
          <h2 className="glossary-entry-hero__title jp-inline">
            {data.entry.label}
          </h2>
          {data.entry.title && data.entry.title !== data.entry.label ? (
            <p className="glossary-entry-hero__subtitle">{data.entry.title}</p>
          ) : null}
          {data.entry.reading || data.entry.romaji ? (
            <p className="glossary-entry-hero__reading jp-inline">
              {[data.entry.reading, data.entry.romaji]
                .filter(Boolean)
                .join(" / ")}
            </p>
          ) : null}
          <p className="glossary-entry-hero__meaning">{data.entry.meaning}</p>
          {data.entry.literalMeaning ? (
            <p className="glossary-entry-hero__detail">
              Letterale: {data.entry.literalMeaning}
            </p>
          ) : null}
          {data.entry.pos ? (
            <p className="glossary-entry-hero__detail">
              Categoria: {data.entry.pos}
            </p>
          ) : null}
          {data.entry.notes ? (
            <p className="glossary-entry-hero__notes">
              {renderFurigana(data.entry.notes)}
            </p>
          ) : null}

          {data.entry.aliasGroups.length > 0 ? (
            <div className="glossary-entry-hero__aliases">
              {data.entry.aliasGroups.map((group) => (
                <div
                  key={group.label}
                  className="glossary-entry-hero__alias-group"
                >
                  <span className="glossary-entry-hero__alias-label">
                    {group.label}
                  </span>
                  <div className="glossary-entry-hero__alias-values">
                    {group.values.map((value) => (
                      <span key={value} className="chip">
                        {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="glossary-side">
          <p className="eyebrow">Studio</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Stato</span>
              <strong>{data.entry.studyState.label}</strong>
            </div>
            <div className="summary-row">
              <span>Lesson</span>
              <strong>{data.related.primaryLessonLabel}</strong>
            </div>
            <div className="summary-row">
              <span>Card</span>
              <strong>{data.related.cardsLabel}</strong>
            </div>
            <div className="summary-row">
              <span>Media</span>
              <strong>{data.media.title}</strong>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <section
        className={`content-section${compact ? "" : " content-section--split"} glossary-detail-sections`}
      >
        <Section
          eyebrow="Percorso"
          title="Lesson dove incontrarla"
          description="Il dettaglio non si ferma alla scheda: ti riporta al punto del percorso dove la voce entra davvero in gioco."
        >
          {data.lessons.length > 0 ? (
            <div className="glossary-detail-list">
              {data.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  className="glossary-detail-link"
                  href={lesson.href}
                >
                  <SurfaceCard className="glossary-detail-card" variant="quiet">
                    <div className="glossary-detail-card__top">
                      <div className="glossary-detail-card__chips">
                        {lesson.roleLabels.map((roleLabel) => (
                          <span
                            key={`${lesson.id}-${roleLabel}`}
                            className="chip"
                          >
                            {roleLabel}
                          </span>
                        ))}
                        {lesson.segmentTitle ? (
                          <span className="meta-pill">
                            {lesson.segmentTitle}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <h3 className="glossary-detail-card__title">
                      {lesson.title}
                    </h3>
                    {lesson.summary ? (
                      <p className="glossary-detail-card__body">
                        {lesson.summary}
                      </p>
                    ) : null}
                  </SurfaceCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nessuna lesson collegata."
              description="L'entry esiste nel DB, ma non ha ancora un collegamento diretto verso una lesson attiva."
            />
          )}
        </Section>

        <Section
          eyebrow="Review"
          title="Card collegate"
          description="Qui trovi le card che rappresentano o richiamano questa entry, con stato review e ruolo."
        >
          {data.cards.length > 0 ? (
            <div className="glossary-detail-list">
              {data.cards.map((card) => (
                <Link
                  key={card.id}
                  className="glossary-detail-link"
                  href={
                    returnTo
                      ? replaceReviewCardInHref(returnTo, card.id)
                      : card.href
                  }
                >
                  <SurfaceCard className="glossary-detail-card" variant="quiet">
                    <div className="glossary-detail-card__top">
                      <div className="glossary-detail-card__chips">
                        <span className="chip">{card.relationshipLabel}</span>
                        <span className="meta-pill">{card.reviewLabel}</span>
                      </div>
                      <span className="glossary-result-card__arrow">
                        {returnTo ? "Apri nella review" : "Apri card"}
                      </span>
                    </div>
                    <h3 className="glossary-detail-card__title jp-inline">
                      {card.front}
                    </h3>
                    <p className="glossary-detail-card__body">{card.back}</p>
                    <div className="glossary-detail-card__meta">
                      <span>{card.typeLabel}</span>
                      {card.segmentTitle ? (
                        <span>{card.segmentTitle}</span>
                      ) : null}
                      {card.dueLabel ? <span>{card.dueLabel}</span> : null}
                    </div>
                    {card.notes ? (
                      <p className="glossary-detail-card__note">
                        {renderFurigana(card.notes)}
                      </p>
                    ) : null}
                  </SurfaceCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Ancora nessuna card collegata."
              description="La voce è consultabile nel glossary, ma non ha ancora card review associate."
            />
          )}
        </Section>
      </section>
    </>
  );
}
