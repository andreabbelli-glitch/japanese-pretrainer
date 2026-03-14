import Link from "next/link";
import { notFound } from "next/navigation";

import { getMediaDetailData } from "@/lib/app-shell";
import { mediaHref, mediaStudyHref, type StudyAreaKey } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

const areaCopy: Record<
  StudyAreaKey,
  {
    eyebrow: string;
    title: string;
    body: string;
    note: string;
  }
> = {
  textbook: {
    eyebrow: "Textbook",
    title: "Percorso lesson pronto per il reader",
    body: "Questa pagina chiarisce da dove ripartire e tiene il percorso ben orientato.",
    note: "La lettura resta al centro, con un ingresso semplice e diretto."
  },
  glossary: {
    eyebrow: "Glossary",
    title: "Ingresso chiaro al lessico del media",
    body: "Il media contiene già termini e pattern; qui la pagina li rende leggibili senza trasformarsi in una ricerca avanzata.",
    note: "Pochi segnali chiari, con il lessico del media sempre in primo piano."
  },
  review: {
    eyebrow: "Review",
    title: "Coda di Review pronta da consultare",
    body: "Questa pagina rende visibile la coda e il suo peso, senza simulare sessioni o numeri cosmetici.",
    note: "La pagina mostra solo segnali che derivano dai dati reali."
  },
  progress: {
    eyebrow: "Progress",
    title: "Riepilogo compatto del media",
    body: "Questa tappa raccoglie i segnali principali già disponibili in un quadro compatto.",
    note: "Le metriche restano poche, leggibili e separate per Textbook, Glossary e Review."
  }
};

type StudyAreaPlaceholderPageProps = {
  area: StudyAreaKey;
  mediaSlug: string;
};

export async function StudyAreaPlaceholderPage({
  area,
  mediaSlug
}: StudyAreaPlaceholderPageProps) {
  const media = await getMediaDetailData(mediaSlug);

  if (!media) {
    notFound();
  }

  const copy = areaCopy[area];

  return (
    <div className="study-area-page">
      <StickyPageHeader
        backHref={mediaHref(media.slug)}
        backLabel={media.title}
        eyebrow={copy.eyebrow}
        summary={copy.body}
        title={copy.title}
        meta={
          <>
            <span>{media.title}</span>
            <span>{media.mediaTypeLabel}</span>
          </>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="study-area-page__hero" variant="hero">
          <p className="eyebrow">Panoramica</p>
          <h2 className="study-area-page__title">{media.title}</h2>
          <p className="study-area-page__body">{copy.note}</p>
          <div className="hero-actions">
            <Link className="button button--primary" href={mediaHref(media.slug)}>
              Torna al media
            </Link>
            <Link className="button button--ghost" href={mediaStudyHref(media.slug, "textbook")}>
              Apri il Textbook
            </Link>
          </div>
        </SurfaceCard>

        <SurfaceCard className="study-area-page__stats">
          <p className="eyebrow">Segnali utili</p>
          <div className="stats-grid stats-grid--stacked">
            <StatBlock
              detail={`${media.lessonsCompleted} di ${media.lessonsTotal} lezioni`}
              label="Textbook"
              value={
                media.textbookProgressPercent !== null
                  ? `${media.textbookProgressPercent}%`
                  : `${media.lessonsTotal}`
              }
            />
            <StatBlock
              detail={`${media.entriesTotal} voci disponibili`}
              label="Glossary"
              value={
                media.entriesTotal > 0
                  ? `${media.entriesKnown}/${media.entriesTotal}`
                  : "0"
              }
            />
            <StatBlock
              detail={media.reviewStatDetail}
              label="Review"
              tone={media.cardsDue > 0 ? "warning" : "default"}
              value={media.reviewStatValue}
            />
          </div>
        </SurfaceCard>
      </section>

      <Section
        description="Questa schermata è intenzionalmente leggera: ti orienta subito e lascia spazio al passo successivo."
        eyebrow="Stato attuale"
        title="Base già pronta"
      >
        <div className="stack-list">
          {area === "textbook" ? (
            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Lesson correnti</h3>
              <p className="cue-card__body">
                {media.resumeLesson
                  ? `${media.resumeLesson.title} · ${media.resumeLesson.statusLabel}`
                  : "Il media non ha ancora una lesson da riprendere."}
              </p>
            </SurfaceCard>
          ) : null}
          {area === "glossary" ? (
            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Prime voci</h3>
              <p className="cue-card__body">
                {media.previewEntries[0]
                  ? `${media.previewEntries[0].label} e altre ${Math.max(media.previewEntries.length - 1, 0)} voci già leggibili.`
                  : "Nessuna voce disponibile per questo media."}
              </p>
            </SurfaceCard>
          ) : null}
          {area === "review" ? (
            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Coda</h3>
              <p className="cue-card__body">{media.reviewQueueLabel}</p>
            </SurfaceCard>
          ) : null}
          {area === "progress" ? (
            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Ritmo</h3>
              <p className="cue-card__body">
                {media.textbookProgressPercent !== null
                  ? `${media.textbookProgressPercent}% nel Textbook, ${media.entriesTotal} voci e ${media.cardsDue} card dovute.`
                  : "Le metriche restano poche e leggibili, pronte a orientare il prossimo passo."}
              </p>
            </SurfaceCard>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
