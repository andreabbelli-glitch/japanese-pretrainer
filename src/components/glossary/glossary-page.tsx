import type { Route } from "next";
import Link from "next/link";

import type { GlossaryPageData } from "@/lib/glossary";
import {
  appendReturnToParam,
  buildGlossaryHref,
  mediaHref,
  resolveGlossaryBackNavigation
} from "@/lib/site";

import { GlossaryDetailPanels } from "./glossary-detail-page";
import { HighlightText } from "./glossary-highlight-text";
import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type GlossaryPageProps = {
  data: GlossaryPageData;
  returnTo?: Route | null;
};

export function GlossaryPage({ data, returnTo }: GlossaryPageProps) {
  const hasEntries = data.resultSummary.total > 0;
  const backNavigation = resolveGlossaryBackNavigation({
    localGlossaryHref: data.media.glossaryHref,
    mediaHref: mediaHref(data.media.slug),
    mediaTitle: data.media.title,
    page: "index",
    returnTo
  });
  const glossaryHref = appendReturnToParam(data.media.glossaryHref, returnTo);
  const detailReturnTo =
    data.hasActiveFilters || returnTo
      ? buildGlossaryHref({
          baseHref: data.media.glossaryHref,
          entryType: data.filters.entryType,
          query: data.filters.query,
          returnTo,
          segmentId: data.filters.segmentId,
          sort: data.filters.sort,
          study: data.filters.study
        })
      : null;

  return (
    <div className="glossary-page">
      <StickyPageHeader
        backHref={backNavigation.backHref}
        backLabel={backNavigation.backLabel}
        eyebrow="Glossary"
        title={data.media.title}
        summary="Ricerca rapida per kanji, kana, romaji e significato, con segnali di studio e collegamenti al percorso."
        meta={
          <>
            <span>{data.media.mediaTypeLabel}</span>
            <span>{data.media.segmentKindLabel}</span>
            <span>{data.resultSummary.total} entry</span>
          </>
        }
        actions={
          <Link className="button button--ghost" href={data.media.textbookHref}>
            Apri Textbook
          </Link>
        }
      />

      <section className="hero-grid hero-grid--detail glossary-page__hero-grid">
        <SurfaceCard className="glossary-hero" variant="hero">
          <p className="eyebrow">Ricerca</p>
          <h2 className="glossary-hero__title">
            Cerca una forma e ricostruisci subito il contesto di studio.
          </h2>
          <p className="glossary-hero__summary">
            La ricerca privilegia la forma esatta e i prefissi, poi amplia il
            risultato con alias e significato.
          </p>

          <form className="glossary-search-form" method="get">
            {returnTo ? (
              <input name="returnTo" type="hidden" value={returnTo} />
            ) : null}
            <label className="glossary-search-form__field">
              <span className="glossary-search-form__label">Cerca</span>
              <input
                className="glossary-search-form__input"
                defaultValue={data.filters.query}
                name="q"
                placeholder="食べる, たべる, taberu, mangiare"
                type="search"
              />
            </label>

            <div className="glossary-search-form__filters">
              <label className="glossary-search-form__field">
                <span className="glossary-search-form__label">Tipo</span>
                <select
                  className="glossary-search-form__select"
                  defaultValue={data.filters.entryType}
                  name="type"
                >
                  <option value="all">Tutto</option>
                  <option value="term">Termine</option>
                  <option value="grammar">Grammatica</option>
                </select>
              </label>

              <label className="glossary-search-form__field">
                <span className="glossary-search-form__label">Segmento</span>
                <select
                  className="glossary-search-form__select"
                  defaultValue={data.filters.segmentId}
                  name="segment"
                >
                  {data.segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="glossary-search-form__field">
                <span className="glossary-search-form__label">Stato</span>
                <select
                  className="glossary-search-form__select"
                  defaultValue={data.filters.study}
                  name="study"
                >
                  <option value="all">Tutti</option>
                  <option value="known">Già note</option>
                  <option value="review">In Review</option>
                  <option value="learning">In studio</option>
                  <option value="new">Nuove</option>
                  <option value="available">Disponibili</option>
                </select>
              </label>

              <label className="glossary-search-form__field">
                <span className="glossary-search-form__label">Ordine</span>
                <select
                  className="glossary-search-form__select"
                  defaultValue={data.filters.sort}
                  name="sort"
                >
                  <option value="lesson_order">Percorso</option>
                  <option value="alphabetical">Alfabetico</option>
                </select>
              </label>
            </div>

            <div className="glossary-search-form__actions">
              <button className="button button--primary" type="submit">
                Cerca
              </button>
              {data.hasActiveFilters ? (
                <Link className="button button--ghost" href={glossaryHref}>
                  Azzera i filtri
                </Link>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="glossary-side glossary-side--summary">
          <p className="eyebrow">Panoramica</p>
          <div className="stats-grid stats-grid--stacked">
            <StatBlock
              detail={`${data.stats.termCount} termini nel media`}
              label="Termini"
              value={String(data.stats.termCount)}
            />
            <StatBlock
              detail={`${data.stats.grammarCount} pattern grammaticali`}
              label="Grammatica"
              value={String(data.stats.grammarCount)}
            />
            <StatBlock
              detail="Voci segnate manualmente o già consolidate"
              label="Già note"
              value={String(data.stats.knownCount)}
            />
            <StatBlock
              detail="Voci già entrate nella coda di Review"
              label="In Review"
              value={String(data.stats.reviewCount)}
            />
          </div>
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Risultati"
        title={
          data.resultSummary.queryLabel
            ? `"${data.resultSummary.queryLabel}"`
            : "Indice consultabile"
        }
        description={
          data.resultSummary.queryLabel
            ? `${data.resultSummary.filtered} risultati su ${data.resultSummary.total} voci.`
            : "Il Glossary resta leggibile anche senza query: puoi sfogliare per segmento, tipo e stato."
        }
      >
        {!hasEntries ? (
          <EmptyState
            title="Questo media non ha ancora voci nel Glossary."
            description="Importa o sincronizza termini e pattern, poi torna qui per cercarli e aprire il dettaglio."
            action={
              <Link
                className="button button--ghost"
                href={data.media.textbookHref}
              >
                Apri Textbook
              </Link>
            }
          />
        ) : data.results.length === 0 ? (
          <EmptyState
            title="Nessun risultato con questi filtri."
            description="Prova una forma più breve, passa da romaji a kana oppure rimuovi segmento e stato per allargare la ricerca."
            action={
              <Link className="button button--ghost" href={glossaryHref}>
                Riparti dall&apos;indice
              </Link>
            }
          />
        ) : (
          <div className="glossary-workspace">
            <div className="glossary-workspace__results">
              <div className="glossary-results">
                {data.results.map((entry) => {
                  const previewHref = buildPreviewHref({
                    entryId: entry.id,
                    entryKind: entry.kind,
                    filters: data.filters,
                    returnTo
                  });
                  const detailHref = appendReturnToParam(
                    entry.href,
                    detailReturnTo
                  );
                  const isPreviewActive =
                    data.preview?.entry.id === entry.id &&
                    data.preview.entry.kind === entry.kind;
                  const visibleAliasMatches =
                    entry.matchedFields.aliases.filter(
                      (alias) =>
                        ![entry.label, entry.title, entry.reading, entry.romaji]
                          .filter(Boolean)
                          .includes(alias.text)
                    );

                  return (
                    <SurfaceCard
                      key={`${entry.kind}:${entry.id}`}
                      className={`glossary-result-card${isPreviewActive ? " glossary-result-card--active" : ""}`}
                    >
                      <Link
                        aria-label={`Anteprima: ${entry.label}`}
                        className="glossary-result-card__overlay-link"
                        href={previewHref}
                      >
                        <span className="sr-only">
                          Apri anteprima di {entry.label}
                        </span>
                      </Link>
                      <div className="glossary-result-card__top">
                        <div className="glossary-result-card__chips">
                          <span className="chip">
                            {entry.kind === "term" ? "Termine" : "Grammatica"}
                          </span>
                          <span className="meta-pill">
                            {entry.studyState.label}
                          </span>
                          {entry.segmentTitle ? (
                            <span className="meta-pill">
                              {entry.segmentTitle}
                            </span>
                          ) : null}
                        </div>
                        <div className="glossary-result-card__actions">
                          <Link
                            className="glossary-result-card__mobile-action"
                            href={detailHref}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            Apri
                          </Link>
                        </div>
                      </div>

                      <h3 className="glossary-result-card__title jp-inline">
                        <HighlightText
                          mode={entry.matchedFields.label}
                          query={data.filters.query}
                          text={entry.label}
                        />
                      </h3>
                      {entry.title && entry.title !== entry.label ? (
                        <p className="glossary-result-card__subtitle">
                          <HighlightText
                            mode={entry.matchedFields.title}
                            query={data.filters.query}
                            text={entry.title}
                          />
                        </p>
                      ) : null}
                      {entry.reading || entry.romaji ? (
                        <p className="glossary-result-card__reading jp-inline">
                          {entry.reading ? (
                            <HighlightText
                              mode={entry.matchedFields.reading}
                              query={data.filters.query}
                              text={entry.reading}
                            />
                          ) : null}
                          {entry.reading && entry.romaji ? " / " : null}
                          {entry.romaji ? (
                            <HighlightText
                              mode={entry.matchedFields.romaji}
                              query={data.filters.query}
                              text={entry.romaji}
                            />
                          ) : null}
                        </p>
                      ) : null}
                      <p className="glossary-result-card__meaning">
                        <HighlightText
                          mode={entry.matchedFields.meaning}
                          query={data.filters.query}
                          text={entry.meaning}
                        />
                      </p>

                      {entry.matchBadges.length > 0 ||
                      visibleAliasMatches.length > 0 ? (
                        <div className="glossary-result-card__match">
                          {entry.matchBadges.map((badge) => (
                            <span key={badge} className="chip">
                              Match: {badge}
                            </span>
                          ))}
                          {visibleAliasMatches.length > 0 ? (
                            <p className="glossary-result-card__match-preview">
                              Alias:{" "}
                              {visibleAliasMatches.map((alias, index) => (
                                <span key={`${alias.text}-${alias.mode}`}>
                                  {index > 0 ? ", " : null}
                                  <HighlightText
                                    mode={alias.mode}
                                    query={data.filters.query}
                                    text={alias.text}
                                  />
                                </span>
                              ))}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="glossary-result-card__footer">
                        <div className="glossary-result-card__meta">
                          <span>
                            {entry.lessonCount === 1
                              ? "1 lesson collegata"
                              : `${entry.lessonCount} lesson collegate`}
                          </span>
                          <span>
                            {entry.cardCount === 1
                              ? "1 card collegata"
                              : `${entry.cardCount} card collegate`}
                          </span>
                        </div>
                        {entry.primaryLesson ? (
                          <p className="glossary-result-card__lesson">
                            {entry.primaryLesson.roleLabel}:{" "}
                            {entry.primaryLesson.title}
                          </p>
                        ) : null}
                        <Link
                          className="text-link glossary-result-card__detail-link"
                          href={detailHref}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          Apri dettaglio
                        </Link>
                      </div>
                    </SurfaceCard>
                  );
                })}
              </div>
            </div>

            {data.preview ? (
              <aside className="glossary-workspace__preview">
                <div className="glossary-preview-panel">
                  <div className="glossary-preview-panel__header">
                    <p className="eyebrow glossary-preview-panel__eyebrow">
                      Anteprima della voce
                    </p>
                    <Link
                      className="button button--ghost"
                      href={appendReturnToParam(
                        data.preview.entry.href,
                        detailReturnTo
                      )}
                    >
                      Apri voce
                    </Link>
                  </div>
                  <GlossaryDetailPanels
                    compact
                    data={data.preview}
                    returnTo={returnTo}
                  />
                </div>
              </aside>
            ) : null}
          </div>
        )}
      </Section>
    </div>
  );
}

function buildPreviewHref({
  entryId,
  entryKind,
  filters,
  returnTo
}: {
  entryId: string;
  entryKind: "term" | "grammar";
  filters: GlossaryPageData["filters"];
  returnTo?: Route | null;
}) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.entryType !== "all") {
    params.set("type", filters.entryType);
  }

  if (filters.segmentId !== "all") {
    params.set("segment", filters.segmentId);
  }

  if (filters.sort !== "lesson_order") {
    params.set("sort", filters.sort);
  }

  if (filters.study !== "all") {
    params.set("study", filters.study);
  }

  params.set("preview", entryId);
  params.set("previewKind", entryKind);

  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  return `?${params.toString()}` as Route;
}
