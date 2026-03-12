import Link from "next/link";

import { getDashboardData } from "@/lib/app-shell";
import { mediaHref, mediaStudyHref, mediaTextbookLessonHref } from "@/lib/site";

import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

export async function DashboardHome() {
  const { focusMedia, media, reviewMedia, totals } = await getDashboardData();

  if (!focusMedia) {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Primo avvio"
          title="La scrivania è pronta, ma non ci sono ancora media importati."
          description="Quando sincronizzi il primo pacchetto di studio, qui troverai il punto da cui riprendere, le card di oggi e i collegamenti principali."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  const focusResumeHref = focusMedia.currentLesson
    ? mediaTextbookLessonHref(focusMedia.slug, focusMedia.currentLesson.slug)
    : mediaStudyHref(focusMedia.slug, "textbook");
  const effectiveReviewMedia = reviewMedia ?? focusMedia;

  return (
    <div className="dashboard-page">
      <section className="hero-grid">
        <SurfaceCard className="dashboard-hero" variant="hero">
          <p className="eyebrow">Da riprendere</p>
          <p className="dashboard-hero__jp jp-inline">読む・拾う・定着させる</p>
          <h1 className="dashboard-hero__title">{focusMedia.title}</h1>
          <p className="dashboard-hero__summary">{focusMedia.description}</p>
          <p className="dashboard-hero__resume">
            {focusMedia.currentLesson
              ? `Riprendi da ${focusMedia.currentLesson.title}`
              : "Apri il media e scegli il primo passo di studio."}
          </p>

          <div className="hero-actions">
            <Link
              className="button button--primary"
              href={focusResumeHref}
            >
              Riprendi
            </Link>
            <Link className="button button--ghost" href={mediaHref(focusMedia.slug)}>
              Vai al media
            </Link>
          </div>

          <div className="dashboard-hero__metrics">
            <StatBlock
              detail={focusMedia.currentLesson?.statusLabel ?? "Percorso pronto"}
              label="Textbook"
              value={
                focusMedia.textbookProgressPercent !== null
                  ? `${focusMedia.textbookProgressPercent}%`
                  : `${focusMedia.lessonsTotal} lesson`
              }
            />
            <StatBlock
              detail={`${focusMedia.entriesTotal} voci disponibili`}
              label="Glossary"
              value={
                focusMedia.entriesTotal > 0
                  ? `${focusMedia.entriesKnown}/${focusMedia.entriesTotal}`
                  : "0"
              }
            />
            <StatBlock
              detail={focusMedia.reviewStatDetail}
              label="Review"
              tone={focusMedia.cardsDue > 0 ? "warning" : "default"}
              value={focusMedia.reviewStatValue}
            />
          </div>
        </SurfaceCard>

        <SurfaceCard className="dashboard-focus" variant="accent">
          <p className="eyebrow">Review di oggi</p>
          <h2 className="dashboard-focus__title">La tua Review di oggi</h2>
          <div className="dashboard-focus__stats">
            <StatBlock
              detail={buildAggregateDueDetail(totals.cardsDue)}
              label="Da ripassare oggi"
              tone={totals.cardsDue > 0 ? "warning" : "default"}
              value={totals.cardsDue > 0 ? `${totals.cardsDue}` : "0"}
            />
            <StatBlock
              detail={buildAggregateActiveDetail(totals.activeReviewCards)}
              label="Card attive"
              value={`${totals.activeReviewCards}`}
            />
          </div>
          <p className="dashboard-focus__note">
            {buildAggregateQueueNote(totals.cardsDue, totals.activeReviewCards)}
          </p>
          <Link className="button button--ghost" href="/review">
            Apri review
          </Link>
        </SurfaceCard>
      </section>

      <Section
        description="Scegli rapidamente da dove riprendere, senza perdere il contesto."
        eyebrow="Media attivi"
        title="Continua da qui"
      >
        <div className="media-grid media-grid--dashboard">
          {media.map((item) => (
            <Link
              key={item.id}
              className="media-summary-card"
              href={mediaHref(item.slug)}
            >
              <SurfaceCard className="media-summary-card__surface">
                <div className="media-summary-card__top">
                  <span className="chip">{item.mediaTypeLabel}</span>
                  <span className="status-pill">{item.statusLabel}</span>
                </div>
                <h3 className="media-summary-card__title">{item.title}</h3>
                <p className="media-summary-card__description">{item.description}</p>
                <div className="media-summary-card__metrics">
                  <span>
                    {item.currentLesson
                      ? `Ora: ${item.currentLesson.title}`
                      : `${item.lessonsTotal} lesson`}
                  </span>
                  <span>{item.cardsDue} da ripassare</span>
                  <span>{item.entriesTotal} voci</span>
                </div>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      </Section>

      <section className="content-section content-section--split">
        <Section
          className="dashboard-progress-section"
          description="Qui vedi solo i progressi utili per riprendere."
          eyebrow="Avanzamento"
          title="Avanzamento"
        >
          <div className="stats-grid">
            <StatBlock
              detail={`${totals.lessonsCompleted} di ${totals.lessonsTotal} lezioni`}
              label="Textbook"
              value={
                totals.lessonsTotal > 0
                  ? `${Math.round((totals.lessonsCompleted / totals.lessonsTotal) * 100)}%`
                  : "0%"
              }
            />
            <StatBlock
              detail={`${totals.entriesTotal} voci nel Glossary`}
              label="Glossary"
              value={
                totals.entriesTotal > 0
                  ? `${totals.entriesKnown}/${totals.entriesTotal}`
                  : "0"
              }
            />
            <StatBlock
              detail={`${totals.activeReviewCards} card attive`}
              label="Review"
              tone={totals.cardsDue > 0 ? "warning" : "default"}
              value={totals.cardsDue > 0 ? `${totals.cardsDue} oggi` : "Nessuna urgenza"}
            />
          </div>
        </Section>

        <Section
          className="dashboard-cues-section"
          description="Trova subito il prossimo passo utile."
          eyebrow="Continua da qui"
          title="Prossimi passi"
        >
          <div className="stack-list">
            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Textbook</h3>
              <p className="cue-card__body">
                {focusMedia.currentLesson
                  ? `${focusMedia.currentLesson.title} · ${focusMedia.currentLesson.statusLabel}`
                  : "Apri il media e scegli la prima lesson disponibile."}
              </p>
              <Link
                className="text-link"
                href={mediaStudyHref(focusMedia.slug, "textbook")}
              >
                Vai al percorso textbook
              </Link>
            </SurfaceCard>

            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Glossary</h3>
              <p className="cue-card__body">
                {focusMedia.previewEntries[0]
                  ? `${focusMedia.previewEntries[0].label} e altre ${focusMedia.entriesTotal - 1} voci già disponibili.`
                  : "Qui troverai il Glossary appena importerai termini e pattern."}
              </p>
              <Link
                className="text-link"
                href={mediaStudyHref(focusMedia.slug, "glossary")}
              >
                Apri Glossary
              </Link>
            </SurfaceCard>

            <SurfaceCard className="cue-card" variant="quiet">
              <h3 className="cue-card__title">Review</h3>
              <p className="cue-card__body">{effectiveReviewMedia.reviewQueueLabel}</p>
              <Link
                className="text-link"
                href={mediaStudyHref(effectiveReviewMedia.slug, "review")}
              >
                Apri review
              </Link>
            </SurfaceCard>
          </div>
        </Section>
      </section>
    </div>
  );
}

function buildAggregateDueDetail(cardsDue: number) {
  if (cardsDue === 0) {
    return "Nessuna card da ripassare";
  }

  return cardsDue === 1
    ? "Hai 1 card da ripassare"
    : `Hai ${cardsDue} card da ripassare`;
}

function buildAggregateActiveDetail(activeReviewCards: number) {
  if (activeReviewCards === 0) {
    return "Nessuna card attiva";
  }

  return activeReviewCards === 1
    ? "1 card attiva"
    : `${activeReviewCards} card attive`;
}

function buildAggregateQueueNote(cardsDue: number, activeReviewCards: number) {
  if (cardsDue > 0) {
    return activeReviewCards > 0
      ? `Hai ${cardsDue} card da ripassare; ${activeReviewCards} card sono attive.`
      : `Hai ${cardsDue} card da ripassare.`;
  }

  if (activeReviewCards > 0) {
    return activeReviewCards === 1
      ? "Oggi non hai card da ripassare; 1 card è ancora attiva."
      : `Oggi non hai card da ripassare; ${activeReviewCards} card sono ancora attive.`;
  }

  return "La coda Review si popolerà quando le prime card entreranno in studio.";
}
