import Link from "next/link";

import { getDashboardData } from "@/lib/dashboard";
import { renderFurigana } from "@/lib/render-furigana";
import {
  mediaGlossaryHref,
  mediaHref,
  reviewHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/lib/site";

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

  const focusResumeHref = focusMedia.resumeLesson
    ? mediaTextbookLessonHref(focusMedia.slug, focusMedia.resumeLesson.slug)
    : mediaStudyHref(focusMedia.slug, "textbook");
  const reviewPriorityNote = reviewMedia
    ? `Piu urgente: ${reviewMedia.title}.`
    : "La queue globale si popolera con le prime card.";

  return (
    <div className="dashboard-page">
      <section className="hero-grid">
        <SurfaceCard className="dashboard-hero" variant="hero">
          <p className="eyebrow">Da riprendere</p>
          <p className="dashboard-hero__jp jp-inline">読む・拾う・定着させる</p>
          <h1 className="dashboard-hero__title">{focusMedia.title}</h1>
          <p className="dashboard-hero__summary">
            {renderFurigana(focusMedia.description, {
              linkBehavior: "flatten"
            })}
          </p>
          <p className="dashboard-hero__resume">
            {focusMedia.resumeLesson
              ? `Prossimo passo: ${focusMedia.resumeLesson.title}`
              : "Apri il media e scegli il primo passo di studio."}
          </p>

          <div className="hero-actions">
            <Link className="button button--primary" href={focusResumeHref}>
              Continua il percorso
            </Link>
            <Link
              className="button button--ghost"
              href={mediaHref(focusMedia.slug)}
            >
              Vai al media
            </Link>
          </div>

          <div className="dashboard-hero__metrics">
            <StatBlock
              detail={
                focusMedia.resumeLesson?.statusLabel ??
                focusMedia.activeLesson?.statusLabel ??
                "Percorso pronto"
              }
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
          <Link className="button button--ghost" href={reviewHref()}>
            Apri review globale
          </Link>
        </SurfaceCard>
      </section>

      <Section
        description="Scegli rapidamente da dove riprendere, senza perdere il contesto."
        eyebrow="Media attivi"
        title="Libreria attiva"
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
                <p className="media-summary-card__description">
                  {renderFurigana(item.description, {
                    linkBehavior: "flatten"
                  })}
                </p>
                <div className="media-summary-card__metrics">
                  <span>
                    {item.resumeLesson
                      ? `Prossimo: ${item.resumeLesson.title}`
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

      <Section
        className="dashboard-cues-section"
        description="Ogni card mostra il prossimo passo utile e solo il progresso che serve per decidere subito."
        eyebrow="Continua da qui"
        title="Prossimi passi"
      >
        <div className="entry-point-grid dashboard-next-steps">
          <SurfaceCard className="cue-card cue-card--next-step" variant="quiet">
            <div className="cue-card__content">
              <h3 className="cue-card__title">Textbook</h3>
              <p className="cue-card__meta">
                {buildTextbookProgressLabel(focusMedia)}
              </p>
              <p className="cue-card__body">
                {focusMedia.resumeLesson
                  ? `${focusMedia.resumeLesson.title} · ${focusMedia.resumeLesson.statusLabel}`
                  : "Apri il media e scegli la prima lesson disponibile."}
              </p>
            </div>
            <Link className="text-link" href={focusResumeHref}>
              {focusMedia.resumeLesson
                ? "Continua il percorso"
                : "Apri Textbook"}
            </Link>
          </SurfaceCard>

          <SurfaceCard className="cue-card cue-card--next-step" variant="quiet">
            <div className="cue-card__content">
              <h3 className="cue-card__title">Review globale</h3>
              <p className="cue-card__meta">
                {buildAggregateDueDetail(totals.cardsDue)}
              </p>
              <p className="cue-card__body">{reviewPriorityNote}</p>
            </div>
            <Link className="text-link" href={reviewHref()}>
              Apri review globale
            </Link>
          </SurfaceCard>

          <SurfaceCard className="cue-card cue-card--next-step" variant="quiet">
            <div className="cue-card__content">
              <h3 className="cue-card__title">Glossary</h3>
              <p className="cue-card__meta">
                {buildGlossaryProgressLabel(focusMedia)}
              </p>
              <p className="cue-card__body">
                {focusMedia.previewEntries[0]
                  ? `${focusMedia.previewEntries[0].label} e altre ${Math.max(
                      focusMedia.entriesTotal - 1,
                      0
                    )} voci già disponibili.`
                  : "Qui troverai il Glossary appena importerai termini e pattern."}
              </p>
            </div>
            <Link
              className="text-link"
              href={mediaGlossaryHref(focusMedia.slug)}
            >
              Apri Glossary
            </Link>
          </SurfaceCard>
        </div>
      </Section>
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

  return "La coda Review globale si popolerà quando le prime card entreranno in studio.";
}

function buildTextbookProgressLabel(media: {
  lessonsCompleted: number;
  lessonsTotal: number;
  textbookProgressPercent: number | null;
}) {
  if (media.lessonsTotal === 0) {
    return "Percorso pronto";
  }

  const progress =
    media.textbookProgressPercent !== null
      ? ` · ${media.textbookProgressPercent}%`
      : "";

  return `${media.lessonsCompleted} di ${media.lessonsTotal} lezioni${progress}`;
}

function buildGlossaryProgressLabel(media: {
  entriesKnown: number;
  entriesTotal: number;
}) {
  if (media.entriesTotal === 0) {
    return "Glossary in arrivo";
  }

  return `${media.entriesKnown}/${media.entriesTotal} voci`;
}
