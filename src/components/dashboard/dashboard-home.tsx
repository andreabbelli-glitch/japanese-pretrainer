import Link from "next/link";

import type { DashboardData } from "@/features/dashboard/server";
import { renderFurigana } from "@/features/study/ui/furigana";
import {
  mediaHref,
  reviewHref,
  mediaStudyHref,
  mediaTextbookLessonHref
} from "@/features/navigation";

import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type DashboardHomeProps = {
  data: DashboardData;
};

export function DashboardHome({ data }: DashboardHomeProps) {
  const { focusMedia, media, recentLessons, review } = data;

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
  const focusResumeLabel = focusMedia.resumeLesson
    ? "Continua il percorso"
    : "Apri Textbook";
  return (
    <div className="dashboard-page">
      <section className="hero-grid">
        <SurfaceCard className="dashboard-hero" variant="hero">
          <p className="eyebrow">Da riprendere</p>
          <p className="dashboard-hero__jp jp-inline" lang="ja">
            読む・拾う・定着させる
          </p>
          <h1 className="dashboard-hero__title">{focusMedia.title}</h1>
          <p className="dashboard-hero__summary">
            {renderFurigana(focusMedia.description, {
              linkBehavior: "flatten"
            })}
          </p>
          <p className="dashboard-hero__resume">
            {focusMedia.resumeLesson
              ? `Prossimo passo: ${focusMedia.resumeLesson.title}`
              : focusMedia.lessonsTotal > 0 &&
                  focusMedia.lessonsCompleted >= focusMedia.lessonsTotal
                ? "Percorso completato. Apri il Textbook per rileggere dall'inizio."
                : "Apri il media e scegli il primo passo di studio."}
          </p>

          <div className="hero-actions">
            <Link className="button button--primary" href={focusResumeHref}>
              {focusResumeLabel}
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
              detail={buildAggregateQueueDetail(
                review.cardsDue,
                review.newQueuedCount
              )}
              label="In coda oggi"
              tone={review.queueCount > 0 ? "warning" : "default"}
              value={review.queueCount > 0 ? `${review.queueCount}` : "0"}
            />
            <StatBlock
              detail={buildAggregateActiveDetail(review.activeReviewCards)}
              label="Card attive"
              value={`${review.activeReviewCards}`}
            />
          </div>
          <p className="dashboard-focus__note">{review.queueLabel}</p>
          <Link className="button button--ghost" href={reviewHref()}>
            Apri review globale
          </Link>
        </SurfaceCard>
      </section>

      {recentLessons.length > 0 ? (
        <Section
          description="Le ultime tre lesson importate cronologicamente che non hai ancora completato."
          eyebrow="Nuove lesson"
          title="Ultime lezioni aggiunte"
        >
          <div className="recent-lesson-grid">
            {recentLessons.map((lesson) => (
              <Link
                key={lesson.id}
                className="recent-lesson-card"
                href={lesson.href}
              >
                <SurfaceCard
                  className="recent-lesson-card__surface"
                  variant="quiet"
                >
                  <div className="recent-lesson-card__top">
                    <span className="chip">{lesson.mediaTitle}</span>
                    <span className="meta-pill">
                      {lesson.segmentTitle ?? "Textbook"}
                    </span>
                  </div>
                  <div className="recent-lesson-card__copy">
                    <h3 className="recent-lesson-card__title">
                      {lesson.title}
                    </h3>
                    {lesson.summary ? (
                      <p className="recent-lesson-card__summary">
                        {renderFurigana(lesson.summary, {
                          linkBehavior: "flatten"
                        })}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-link recent-lesson-card__action">
                    Studia lesson
                  </span>
                </SurfaceCard>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

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
    </div>
  );
}

function buildAggregateQueueDetail(cardsDue: number, newQueuedCount: number) {
  if (cardsDue > 0) {
    return cardsDue === 1
      ? "Hai 1 card da ripassare"
      : `Hai ${cardsDue} card da ripassare`;
  }

  if (newQueuedCount > 0) {
    return newQueuedCount === 1
      ? "Hai 1 nuova card pronta"
      : `Hai ${newQueuedCount} nuove card pronte`;
  }

  return "Nessuna card in coda";
}

function buildAggregateActiveDetail(activeReviewCards: number) {
  if (activeReviewCards === 0) {
    return "Nessuna card attiva";
  }

  return activeReviewCards === 1
    ? "1 card attiva"
    : `${activeReviewCards} card attive`;
}
