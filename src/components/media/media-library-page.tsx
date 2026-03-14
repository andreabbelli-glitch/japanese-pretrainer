import Link from "next/link";

import { getMediaLibraryData } from "@/lib/app-shell";
import { mediaHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

export async function MediaLibraryPage() {
  const media = await getMediaLibraryData();

  if (media.length === 0) {
    return (
      <div className="media-library-page">
        <StickyPageHeader
          eyebrow="Libreria"
          summary="La raccolta dei pacchetti di studio resta chiara anche quando è vuota o incompleta."
          title="Media"
        />
        <EmptyState
          eyebrow="Nessun pacchetto ancora pronto"
          title="La libreria comparirà qui dopo il primo import."
          description="Ogni media importato diventa un punto di accesso a Textbook, Glossary, Review e Progress."
        />
      </div>
    );
  }

  return (
    <div className="media-library-page">
      <header className="app-section__header">
        <div className="app-section__copy">
          <p className="eyebrow">Libreria</p>
          <h1 className="app-section__title">Media</h1>
        </div>
        <span className="meta-pill">{media.length} pacchetti attivi</span>
      </header>

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
                    item.resumeLesson
                      ? `Prossimo: ${item.resumeLesson.title}`
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
                  detail={`${item.entriesTotal} voci nel Glossary`}
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
                  {item.resumeLesson
                    ? `${item.resumeLesson.statusLabel} · ${item.resumeLesson.title}`
                    : "Apri il media per scegliere il primo step"}
                </p>
                <span className="text-link">Apri media</span>
              </div>
            </SurfaceCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
