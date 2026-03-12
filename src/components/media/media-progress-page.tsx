import Link from "next/link";

import type { ProgressPageData } from "@/lib/progress";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type MediaProgressPageProps = {
  data: ProgressPageData;
};

export function MediaProgressPage({ data }: MediaProgressPageProps) {
  return (
    <div className="progress-page">
      <StickyPageHeader
        backHref={data.media.href}
        backLabel={`Torna a ${data.media.title}`}
        eyebrow="Progress"
        title={data.media.title}
        summary="Una vista essenziale per capire quanto hai letto, quante voci hai già incontrato e cosa conviene riprendere adesso."
        meta={
          <>
            <span>{data.media.mediaTypeLabel}</span>
            <span>{data.media.segmentKindLabel}</span>
            <span>{data.textbook.totalLessons} lesson</span>
          </>
        }
        actions={
          <Link className="button button--ghost" href={data.media.settingsHref}>
            Apri Settings
          </Link>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="progress-hero" variant="hero">
          <p className="eyebrow">Ripresa naturale</p>
          <h2 className="progress-hero__title">{data.resume.recommendedTitle}</h2>
          <p className="progress-hero__summary">{data.resume.recommendedBody}</p>
          <div className="hero-actions">
            <Link className="button button--primary" href={data.resume.recommendedHref}>
              {data.resume.recommendedLabel}
            </Link>
            {data.resume.currentLessonHref ? (
              <Link className="button button--ghost" href={data.resume.currentLessonHref}>
                Apri lesson corrente
              </Link>
            ) : (
              <Link className="button button--ghost" href={data.media.textbookHref}>
                Apri Textbook
              </Link>
            )}
          </div>
          <div className="stats-grid stats-grid--compact">
            <StatBlock
              detail={`${data.textbook.completedLessons} di ${data.textbook.totalLessons} lesson`}
              label="Textbook"
              value={
                data.textbook.progressPercent !== null
                  ? `${data.textbook.progressPercent}%`
                  : "0%"
              }
            />
            <StatBlock
              detail={`${data.glossary.entriesTotal} voci nel Glossary`}
              label="Glossary"
              value={`${data.glossary.entriesCovered}/${data.glossary.entriesTotal}`}
            />
            <StatBlock
              detail={data.review.queueLabel}
              label="Review"
              tone={data.review.dueCount > 0 ? "warning" : "default"}
              value={
                data.review.dueCount > 0
                  ? `${data.review.dueCount} da ripassare`
                  : data.review.queueCount > 0
                    ? `${data.review.queueCount} in coda`
                    : "In pari"
              }
            />
          </div>
        </SurfaceCard>

        <SurfaceCard className="progress-side">
          <p className="eyebrow">Controlli attivi</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Furigana</span>
              <strong>{data.settings.furiganaMode}</strong>
            </div>
            <div className="summary-row">
              <span>Nuove card</span>
              <strong>{data.settings.reviewDailyLimit}/giorno</strong>
            </div>
            <div className="summary-row">
              <span>Ordine del Glossary</span>
              <strong>
                {data.settings.glossaryDefaultSort === "lesson_order"
                  ? "percorso"
                  : "alfabetico"}
              </strong>
            </div>
          </div>
          <p className="panel-note">
            Le preferenze si applicano subito a reader, Glossary e Review.
          </p>
        </SurfaceCard>
      </section>

      <section className="content-section content-section--split">
        <Section
          eyebrow="Textbook"
          title="Avanzamento di lettura"
          description="Il reader resta il filo principale: qui vedi dove eri arrivato e quante lesson restano."
        >
          <div className="progress-panel-stack">
            <SurfaceCard className="progress-detail-card" variant="quiet">
              <div className="summary-row">
                <span>Ultima lesson aperta</span>
                <strong>{data.resume.lastOpenedLesson?.title ?? "Nessuna ancora"}</strong>
              </div>
              <div className="summary-row">
                <span>Lesson in corso</span>
                <strong>{data.textbook.inProgressLessons}</strong>
              </div>
              <div className="summary-row">
                <span>Prossima lesson utile</span>
                <strong>{data.textbook.nextLesson?.title ?? "Percorso completo"}</strong>
              </div>
            </SurfaceCard>

            <div className="segment-list">
              {data.textbook.segments.map((segment) => (
                <SurfaceCard key={segment.id} className="segment-card" variant="quiet">
                  <div className="segment-card__top">
                    <h3 className="segment-card__title">{segment.title}</h3>
                    <span className="meta-pill">
                      {segment.completedLessons}/{segment.lessonCount}
                    </span>
                  </div>
                  <p className="segment-card__note">
                    {segment.note ?? `${segment.lessonCount} lesson in questo blocco.`}
                  </p>
                  <p className="segment-card__current">
                    {segment.currentLessonTitle
                      ? `In corso: ${segment.currentLessonTitle}`
                      : "Nessuna lesson aperta in questo blocco."}
                  </p>
                </SurfaceCard>
              ))}
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Glossary"
          title="Voci già coperte"
          description="Conta le voci che hai già incontrato davvero: segnali manuali, Review attive e stati di studio."
        >
          <div className="stats-grid stats-grid--stacked">
            <StatBlock
              detail="Voci già incontrate in modo reale."
              label="Coperte"
              value={`${data.glossary.entriesCovered}/${data.glossary.entriesTotal}`}
            />
            <StatBlock
              detail="Segnate manualmente o con segnali equivalenti."
              label="Già note"
              value={String(data.glossary.breakdown.known)}
            />
            <StatBlock
              detail="Voci già entrate nella rotazione di Review."
              label="In Review"
              value={String(data.glossary.breakdown.review)}
            />
            <StatBlock
              detail="Voci in studio ma non ancora stabili."
              label="In studio"
              value={String(data.glossary.breakdown.learning)}
            />
          </div>
          {data.glossary.previewEntries.length > 0 ? (
            <div className="entry-preview-list">
              {data.glossary.previewEntries.map((entry) => (
                <Link key={entry.id} className="entry-point-link" href={entry.href}>
                  <SurfaceCard className="entry-preview-card" variant="quiet">
                    <div className="entry-preview-card__top">
                      <span className="chip">
                        {entry.kind === "term" ? "Termine" : "Grammatica"}
                      </span>
                      <span className="meta-pill">{entry.statusLabel}</span>
                    </div>
                    <h3 className="entry-preview-card__title jp-inline">{entry.label}</h3>
                    {entry.reading ? (
                      <p className="entry-preview-card__reading jp-inline">{entry.reading}</p>
                    ) : null}
                    <p className="entry-preview-card__meaning">{entry.meaning}</p>
                  </SurfaceCard>
                </Link>
              ))}
            </div>
          ) : null}
        </Section>
      </section>

      <section className="content-section content-section--split">
        <Section
          eyebrow="Review"
          title="Coda e carico quotidiano"
          description="Pochi segnali utili: cosa è dovuto ora, quante nuove entrano oggi e quante restano attive."
        >
          <div className="stats-grid stats-grid--stacked">
            <StatBlock
              detail="Card che puoi lavorare subito."
              label="In coda"
              value={String(data.review.queueCount)}
            />
            <StatBlock
              detail="Richiedono attenzione oggi."
              label="Dovute"
              tone={data.review.dueCount > 0 ? "warning" : "default"}
              value={String(data.review.dueCount)}
            />
            <StatBlock
              detail={`${data.review.newAvailableCount} nuove disponibili in totale per questo media.`}
              label="Nuove oggi"
              value={String(data.review.newQueuedCount)}
            />
            <StatBlock
              detail="Card già in rotazione attiva."
              label="Attive"
              value={String(data.review.activeCards)}
            />
          </div>
          <SurfaceCard className="progress-detail-card" variant="quiet">
            <div className="summary-row">
              <span>Limite nuove</span>
              <strong>{data.review.dailyLimit}/giorno</strong>
            </div>
            <div className="summary-row">
              <span>Sospese</span>
              <strong>{data.review.suspendedCount}</strong>
            </div>
            <div className="summary-row">
              <span>In arrivo</span>
              <strong>{data.review.upcomingCount}</strong>
            </div>
          </SurfaceCard>
        </Section>

        <Section
          eyebrow="Continua"
          title="Ingressi rapidi"
          description="Le azioni principali restano tre: leggere, consultare, ripassare."
        >
          <div className="entry-point-grid">
            <Link className="entry-point-link" href={data.resume.currentLessonHref ?? data.media.textbookHref}>
              <SurfaceCard className="entry-point-card">
                <div className="entry-point-card__top">
                  <h3 className="entry-point-card__title">Textbook</h3>
                  <span className="entry-point-card__arrow">Apri</span>
                </div>
                <p className="entry-point-card__body">
                  {data.resume.currentLesson?.title ?? "Apri il percorso lesson."}
                </p>
                <p className="entry-point-card__detail">
                  {data.resume.currentLesson?.statusLabel ?? "Pronto a iniziare"}
                </p>
              </SurfaceCard>
            </Link>

            <Link className="entry-point-link" href={data.media.glossaryHref}>
              <SurfaceCard className="entry-point-card">
                <div className="entry-point-card__top">
                  <h3 className="entry-point-card__title">Glossary</h3>
                  <span className="entry-point-card__arrow">Apri</span>
                </div>
                <p className="entry-point-card__body">
                  Consulta le voci già presenti nel media.
                </p>
                <p className="entry-point-card__detail">
                  {data.glossary.entriesCovered}/{data.glossary.entriesTotal} già viste
                </p>
              </SurfaceCard>
            </Link>

            <Link className="entry-point-link" href={data.media.reviewHref}>
              <SurfaceCard className="entry-point-card">
                <div className="entry-point-card__top">
                  <h3 className="entry-point-card__title">Review</h3>
                  <span className="entry-point-card__arrow">Apri</span>
                </div>
                <p className="entry-point-card__body">{data.review.queueLabel}</p>
                <p className="entry-point-card__detail">
                  {data.review.dueCount > 0
                    ? `${data.review.dueCount} da ripassare`
                    : "Nessuna urgenza adesso"}
                </p>
              </SurfaceCard>
            </Link>
          </div>
        </Section>
      </section>
    </div>
  );
}
