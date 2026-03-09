import Link from "next/link";

import { getMediaLibraryData } from "@/lib/app-shell";
import { mediaHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

export async function MediaLibraryPage() {
  const media = await getMediaLibraryData();

  if (media.length === 0) {
    return (
      <div className="media-library-page">
        <StickyPageHeader
          eyebrow="Libreria"
          summary="La raccolta dei pacchetti di studio resta leggibile e calma anche quando è vuota o incompleta."
          title="Media"
        />
        <EmptyState
          eyebrow="Nessun pacchetto ancora pronto"
          title="La media library comparirà qui dopo il primo import."
          description="Ogni media sincronizzato nel DB diventa un punto di ingresso per textbook, glossary, review e progress, senza dipendere dal parsing a runtime."
        />
      </div>
    );
  }

  return (
    <div className="media-library-page">
      <StickyPageHeader
        eyebrow="Libreria"
        summary="Una panoramica sobria dei media attivi, con metriche sintetiche e un entry point chiaro per ciascun percorso di studio."
        title="Media"
        meta={<span>{media.length} pacchetti attivi</span>}
      />

      <Section
        description="Ogni card privilegia titolo, stato e prossimo passo. Le metriche restano piccole e secondarie."
        eyebrow="Pacchetti di studio"
        title="Libreria attiva"
      >
        <div className="media-library-grid">
          {media.map((item) => (
            <Link key={item.id} className="library-card-link" href={mediaHref(item.slug)}>
              <SurfaceCard className="library-card">
                <div className="library-card__top">
                  <div className="library-card__labels">
                    <span className="chip">{item.mediaTypeLabel}</span>
                    <span className="meta-pill">{item.segmentKindLabel}</span>
                  </div>
                  <span className="status-pill">{item.statusLabel}</span>
                </div>

                <div className="library-card__copy">
                  <h2 className="library-card__title">{item.title}</h2>
                  <p className="library-card__description">{item.description}</p>
                </div>

                <div className="stats-grid stats-grid--compact">
                  <StatBlock
                    detail={
                      item.currentLesson
                        ? `Ora: ${item.currentLesson.title}`
                        : `${item.lessonsTotal} lesson disponibili`
                    }
                    label="Textbook"
                    value={
                      item.textbookProgressPercent !== null
                        ? `${item.textbookProgressPercent}%`
                        : `${item.lessonsTotal}`
                    }
                  />
                  <StatBlock
                    detail={`${item.entriesTotal} entry canoniche`}
                    label="Glossary"
                    value={
                      item.entriesTotal > 0
                        ? `${item.entriesKnown}/${item.entriesTotal}`
                        : "0"
                    }
                  />
                  <StatBlock
                    detail={item.reviewStatDetail}
                    label="Review"
                    tone={item.cardsDue > 0 ? "warning" : "default"}
                    value={item.reviewStatValue}
                  />
                </div>

                <div className="library-card__footer">
                  <p className="library-card__step">
                    {item.currentLesson
                      ? `${item.currentLesson.statusLabel} · ${item.currentLesson.title}`
                      : "Apri il media per scegliere il primo step"}
                  </p>
                  <span className="text-link">Apri media</span>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
