import type { Route } from "next";
import Link from "next/link";

import type { ProgressPageData } from "@/lib/progress";
import { renderFurigana } from "@/lib/render-furigana";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

type MediaDetailPageProps = {
  data: ProgressPageData;
};

type StudyAreaCard = {
  key: "textbook" | "glossary" | "review";
  title: string;
  body: string;
  detail: string;
  href: Route;
  actionLabel: string;
};

export function MediaDetailPage({ data }: MediaDetailPageProps) {
  const previewEntries = data.glossary.previewEntries.slice(0, 4);
  const activeGlossaryPreview = previewEntries[0];
  const textbookContinueHref =
    data.resume.resumeLessonHref ??
    data.resume.activeLessonHref ??
    data.resume.nextLessonHref ??
    data.media.textbookHref;
  const textbookContinueLabel =
    textbookContinueHref === data.media.textbookHref
      ? "Apri il Textbook"
      : "Continua il percorso";
  const furiganaLabel =
    data.settings.furiganaMode === "on"
      ? "sempre visibili"
      : data.settings.furiganaMode === "off"
        ? "nascoste"
        : "su richiesta";
  const glossarySortLabel =
    data.settings.glossaryDefaultSort === "lesson_order"
      ? "ordine percorso"
      : "alfabetico";
  const overviewEyebrow =
    data.resume.recommendedArea === "review"
      ? "Priorità di oggi"
      : "Riprendi da qui";
  const overviewNote =
    data.resume.recommendedArea === "review"
      ? data.resume.resumeLesson
        ? `Dopo la review globale puoi tornare a ${data.resume.resumeLesson.title}.`
        : "Dopo la review globale puoi tornare subito al Textbook."
      : data.globalReview.dueCount > 0
        ? `${data.globalReview.dueCount} card aspettano ancora nella review globale.`
        : null;

  const studyAreas: StudyAreaCard[] = [
    {
      key: "textbook",
      title: "Textbook",
      body: "Rientra nel reader e continua il percorso del media.",
      detail:
        data.textbook.inProgressLessons > 0
          ? `${data.textbook.inProgressLessons} lesson in corso`
          : data.resume.resumeLesson
            ? "Pronto a ripartire dal prossimo blocco"
            : `${data.textbook.totalLessons} lesson disponibili`,
      href: data.media.textbookHref,
      actionLabel: "Apri"
    },
    {
      key: "glossary",
      title: "Glossary",
      body: "Consulta le voci del media e torna rapidamente al contesto.",
      detail: activeGlossaryPreview
        ? `Tra le voci: ${activeGlossaryPreview.label}`
        : data.glossary.entriesTotal > 0
          ? `${data.glossary.entriesTotal} voci nel media`
          : "Le prime voci appariranno qui appena importate",
      href: data.media.glossaryHref,
      actionLabel: "Apri"
    },
    {
      key: "review",
      title: "Review del media",
      body: "Gestisci la coda collegata alle card importate in questo media.",
      detail: data.review.nextCardFront
        ? `Prossima card: ${data.review.nextCardFront}`
        : data.review.dueCount > 0
          ? `${data.review.dueCount} da ripassare adesso`
          : data.review.queueCount > 0
            ? `${data.review.queueCount} in coda oggi`
            : "Nessuna urgenza adesso",
      href: data.media.reviewHref,
      actionLabel: "Apri"
    }
  ];

  return (
    <div className="media-detail-page">
      <StickyPageHeader
        backHref="/media"
        backLabel="Torna alla libreria"
        eyebrow={data.media.mediaTypeLabel}
        summary={renderFurigana(data.media.description, {
          linkBehavior: "flatten"
        })}
        title={data.media.title}
        meta={
          <>
            <span>{data.media.segmentKindLabel}</span>
            <span>{data.textbook.totalLessons} lesson</span>
            <span>{data.media.statusLabel}</span>
          </>
        }
        actions={
          <Link
            className="button button--primary"
            href={data.resume.recommendedHref}
          >
            {data.resume.recommendedLabel}
          </Link>
        }
      />

      <Section
        id="study-areas"
        description="Scegli subito l'area da cui continuare."
        eyebrow="Aree di studio"
        title="Scegli dove continuare"
      >
        <div className="entry-point-grid">
          {studyAreas.map((area) => {
            if (area.key === "textbook") {
              return (
                <SurfaceCard key={area.key} className="entry-point-card">
                  <div className="entry-point-card__top">
                    <h3 className="entry-point-card__title">{area.title}</h3>
                    <Link className="entry-point-card__arrow" href={area.href}>
                      {area.actionLabel}
                    </Link>
                  </div>
                  <p className="entry-point-card__body">{area.body}</p>
                  <p className="entry-point-card__detail">{area.detail}</p>
                  <div className="hero-actions">
                    <Link
                      className="button button--primary"
                      href={textbookContinueHref}
                    >
                      {textbookContinueLabel}
                    </Link>
                  </div>
                </SurfaceCard>
              );
            }

            return (
              <Link
                key={area.key}
                className="entry-point-link"
                href={area.href}
              >
                <SurfaceCard className="entry-point-card">
                  <div className="entry-point-card__top">
                    <h3 className="entry-point-card__title">{area.title}</h3>
                    <span className="entry-point-card__arrow">
                      {area.actionLabel}
                    </span>
                  </div>
                  <p className="entry-point-card__body">{area.body}</p>
                  <p className="entry-point-card__detail">{area.detail}</p>
                </SurfaceCard>
              </Link>
            );
          })}
        </div>
      </Section>

      <section className="hero-grid hero-grid--detail" id="overview">
        <SurfaceCard className="media-detail-hero" variant="hero">
          <p className="eyebrow">{overviewEyebrow}</p>
          <h2 className="media-detail-hero__title">
            {data.resume.recommendedTitle}
          </h2>
          <p className="media-detail-hero__summary">
            {data.resume.recommendedBody}
          </p>
          {overviewNote ? <p className="hero-resume">{overviewNote}</p> : null}
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
              detail={
                data.globalReview.dueCount > 0
                  ? `${data.globalReview.dueCount} richiedono attenzione adesso`
                  : data.globalReview.activeCards > 0
                    ? `${data.globalReview.activeCards} card già in rotazione`
                    : "La coda globale si popolerà con le prime card"
              }
              label="Review globale"
              tone={data.globalReview.dueCount > 0 ? "warning" : "default"}
              value={
                data.globalReview.dueCount > 0
                  ? `${data.globalReview.dueCount} da ripassare`
                  : data.globalReview.queueCount > 0
                    ? `${data.globalReview.queueCount} in coda`
                    : "In pari"
              }
            />
          </div>
        </SurfaceCard>

        <SurfaceCard className="media-detail-side">
          <p className="eyebrow">Preferenze attive</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Furigana</span>
              <strong>{furiganaLabel}</strong>
            </div>
            <div className="summary-row">
              <span>Review nuove</span>
              <strong>{data.settings.reviewDailyLimit}/giorno</strong>
            </div>
            <div className="summary-row">
              <span>Glossary</span>
              <strong>{glossarySortLabel}</strong>
            </div>
          </div>
          <p className="panel-note">
            Valgono subito per reader, glossary e review.
          </p>
          <Link className="text-link" href={data.media.settingsHref}>
            Apri settings
          </Link>
        </SurfaceCard>
      </section>

      <section className="content-section content-section--split">
        <Section
          id="textbook-overview"
          actions={
            <Link className="text-link" href={data.media.textbookHref}>
              Apri il Textbook
            </Link>
          }
          description="Il percorso resta il filo principale: qui vedi i blocchi e dove conviene rientrare."
          eyebrow="Textbook"
          title="Percorso delle lesson"
        >
          {data.textbook.segments.length > 0 ? (
            <div className="segment-list">
              {data.textbook.segments.map((segment) => (
                <SurfaceCard
                  key={segment.id}
                  className="segment-card"
                  variant="quiet"
                >
                  <div className="segment-card__top">
                    <h3 className="segment-card__title">{segment.title}</h3>
                    <span className="meta-pill">
                      {segment.completedLessons}/{segment.lessonCount}
                    </span>
                  </div>
                  <p className="segment-card__note">
                    {segment.note ??
                      `${segment.lessonCount} lesson organizzate in questo blocco.`}
                  </p>
                  <p className="segment-card__current">
                    {segment.currentLessonTitle
                      ? `In corso: ${segment.currentLessonTitle}`
                      : "Nessuna lesson aperta in questo blocco."}
                  </p>
                </SurfaceCard>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Il media non ha ancora segmenti visibili."
              description="Appena importerai lesson o segmenti aggiuntivi, qui apparirà il percorso editoriale da seguire."
            />
          )}
        </Section>

        <Section
          id="review-overview"
          actions={
            <Link className="text-link" href={data.media.reviewHref}>
              Apri la review del media
            </Link>
          }
          description="Numeri locali del media, separati dalla queue globale reale."
          eyebrow="Review del media"
          title="Coda locale e carico quotidiano"
        >
          <div className="stats-grid">
            <StatBlock
              detail={
                data.review.nextCardFront
                  ? `Prossima: ${data.review.nextCardFront}`
                  : "Sessione pronta da aprire"
              }
              label="In coda"
              value={String(data.review.queueCount)}
            />
            <StatBlock
              detail={
                data.review.dueCount > 0
                  ? "Richiedono attenzione adesso."
                  : "Nessuna urgenza nel media."
              }
              label="Da ripassare"
              tone={data.review.dueCount > 0 ? "warning" : "default"}
              value={String(data.review.dueCount)}
            />
            <StatBlock
              detail={`${data.review.newAvailableCount} disponibili in totale`}
              label="Nuove oggi"
              value={String(data.review.newQueuedCount)}
            />
            <StatBlock
              detail={`${data.review.suspendedCount} escluse dalla coda del media`}
              label="Sospese"
              value={String(data.review.suspendedCount)}
            />
          </div>
        </Section>
      </section>

      <Section
        id="glossary-overview"
        actions={
          <Link className="text-link" href={data.media.glossaryHref}>
            Apri il Glossary
          </Link>
        }
        description="Una vista rapida su quante voci hai già incontrato e quali stanno emergendo nel media."
        eyebrow="Glossary"
        title="Voci già coperte"
      >
        <div className="stats-grid">
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
            detail="Entrate nella rotazione di Review."
            label="In Review"
            value={String(data.glossary.breakdown.review)}
          />
          <StatBlock
            detail="In studio ma non ancora stabili."
            label="In studio"
            value={String(data.glossary.breakdown.learning)}
          />
        </div>

        {previewEntries.length > 0 ? (
          <div className="entry-preview-list">
            {previewEntries.map((entry) => (
              <Link
                key={entry.id}
                className="entry-point-link"
                href={entry.href}
              >
                <SurfaceCard className="entry-preview-card" variant="quiet">
                  <div className="entry-preview-card__top">
                    <span className="chip">
                      {entry.kind === "term" ? "Termine" : "Grammatica"}
                    </span>
                    <span className="meta-pill">{entry.statusLabel}</span>
                  </div>
                  <h3 className="entry-preview-card__title jp-inline">
                    {entry.label}
                  </h3>
                  {entry.reading ? (
                    <p className="entry-preview-card__reading jp-inline">
                      {entry.reading}
                    </p>
                  ) : null}
                  <p className="entry-preview-card__meaning">{entry.meaning}</p>
                  {entry.segmentTitle ? (
                    <p className="entry-preview-card__segment">
                      {entry.segmentTitle}
                    </p>
                  ) : null}
                </SurfaceCard>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ancora nessuna voce collegata."
            description="Termini e pattern appariranno qui quando il media avrà contenuti nel Glossary."
          />
        )}
      </Section>
    </div>
  );
}
