import type { Route } from "next";
import Link from "next/link";

import type { GlobalGlossaryPageData } from "@/lib/glossary";
import { buildGlossaryHref } from "@/lib/site";

import { GlobalGlossaryResultCard } from "./global-glossary-result-card";
import { GlossaryPortalSearchForm } from "./glossary-portal-search-form";
import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type GlossaryPortalPageProps = {
  data: GlobalGlossaryPageData;
};

export function GlossaryPortalPage({ data }: GlossaryPortalPageProps) {
  const hasCorpus = data.stats.entryCount > 0;
  const searchFormKey = [
    data.filters.query,
    data.filters.entryType,
    data.filters.media,
    data.filters.study,
    data.filters.cards,
    data.filters.sort
  ].join("::");
  const currentSearchHref = buildGlossaryHref({
    baseHref: "/glossary" as Route,
    cards: data.filters.cards,
    entryType: data.filters.entryType,
    media: data.filters.media,
    query: data.filters.query,
    sort: data.filters.sort,
    study: data.filters.study
  });

  if (data.mediaOptions.length === 0) {
    return (
      <div className="glossary-portal-page">
        <StickyPageHeader
          eyebrow="Glossary"
          summary="Il portale globale si attiva appena esiste almeno un media importato."
          title="Glossary"
        />
        <EmptyState
          eyebrow="Nessun media attivo"
          title="Il portale comparirà qui dopo il primo import."
          description="Quando avrai almeno un media attivo, da qui potrai cercare termini e grammatica in tutto il corpus senza cambiare contesto."
          action={
            <Link className="button button--ghost" href="/media">
              Apri Media
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="glossary-portal-page">
      <StickyPageHeader
        eyebrow="Glossary"
        summary="Ricerca unica cross-media per capire subito che cos’è una voce, dove compare e se hai già una flashcard pronta."
        title="Glossary"
        meta={
          <>
            <span>{data.stats.mediaCount} media</span>
            <span>{data.stats.entryCount} entry</span>
            <span>{data.stats.withCardsCount} con flashcard</span>
          </>
        }
        actions={
          <Link className="button button--ghost" href="/media">
            Apri Media
          </Link>
        }
      />

      <section className="content-section">
        <SurfaceCard className="glossary-hero glossary-portal-search" variant="hero">
          <div className="glossary-portal-search__intro">
            <div className="glossary-portal-search__copy">
              <p className="eyebrow">Ricerca globale</p>
              <h2 className="glossary-hero__title">
                Cerca nel corpus completo e apri subito il punto di studio migliore.
              </h2>
              <p className="glossary-hero__summary">
                Il portale aggrega i match cross-media, rende esplicito il segnale
                flashcard e usa il dettaglio locale migliore come destinazione
                primaria.
              </p>
            </div>

            <div className="glossary-portal-search__signals">
              <span className="chip">Kanji, kana, romaji, italiano</span>
              <span className="chip">Cross-media</span>
              <span className="chip">Filtro flashcard e stato</span>
            </div>
          </div>

          <GlossaryPortalSearchForm
            key={searchFormKey}
            filters={data.filters}
            hasActiveFilters={data.hasActiveFilters}
            mediaOptions={data.mediaOptions}
          />
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Sintesi"
        title={
          data.resultSummary.queryLabel
            ? `Risultati per "${data.resultSummary.queryLabel}"`
            : "Portale di consultazione"
        }
        description={
          data.resultSummary.queryLabel
            ? `${data.resultSummary.filtered} risultati su ${data.resultSummary.total} voci aggregate.`
            : "Il Glossary globale resta sfogliabile anche senza query: filtra per media, stato di studio, tipo di voce e presenza di flashcard."
        }
      >
        <div className="stats-grid glossary-portal-summary">
          <StatBlock
            detail="Quante voci restano dopo i filtri correnti"
            label="Risultati"
            value={String(data.resultSummary.filtered)}
          />
          <StatBlock
            detail="Voci con almeno una flashcard nel corpus"
            label="Flashcard pronte"
            value={String(data.stats.withCardsCount)}
          />
          <StatBlock
            detail="Voci che compaiono in più media"
            label="Compare altrove"
            value={String(data.stats.crossMediaCount)}
          />
          <StatBlock
            detail="Media inclusi nel portale"
            label="Media attivi"
            value={String(data.mediaOptions.length)}
          />
        </div>
      </Section>

      <Section
        eyebrow="Risultati"
        title="Workspace di studio"
        description="Ogni card chiarisce forma, significato, stato di studio, copertura card e miglior destinazione locale."
      >
        {!hasCorpus ? (
          <EmptyState
            title="Il corpus non ha ancora entry nel Glossary."
            description="Importa termini o pattern grammaticali nei media attivi, poi torna qui per cercarli in modo trasversale."
            action={
              <Link className="button button--ghost" href="/media">
                Apri Media
              </Link>
            }
          />
        ) : data.results.length === 0 ? (
          <EmptyState
            title="Nessun risultato con questi filtri."
            description="Prova una forma più breve, passa da romaji a kana oppure rimuovi media, stato o filtro flashcard per allargare la ricerca."
            action={
              <Link className="button button--ghost" href={"/glossary" as Route}>
                Riparti dal portale
              </Link>
            }
          />
        ) : (
          <div className="glossary-results glossary-results--portal">
            {data.results.map((entry) => (
              <GlobalGlossaryResultCard
                key={entry.resultKey}
                entry={entry}
                query={data.filters.query}
                returnTo={currentSearchHref}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
