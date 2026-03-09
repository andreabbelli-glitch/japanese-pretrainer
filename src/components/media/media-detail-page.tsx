import Link from "next/link";
import { notFound } from "next/navigation";

import { getMediaDetailData } from "@/lib/app-shell";
import { mediaHref, mediaStudyHref, mediaTextbookLessonHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { StatBlock } from "../ui/stat-block";
import { SurfaceCard } from "../ui/surface-card";

const studyAreas = [
  {
    key: "textbook",
    title: "Textbook",
    body: "Riprendi le lesson e mantieni il filo del percorso senza perdere il contesto del media."
  },
  {
    key: "glossary",
    title: "Glossary",
    body: "Consulta le entry canoniche gia nel DB con un ingresso sobrio e leggibile."
  },
  {
    key: "review",
    title: "Review",
    body: "Apri la coda collegata alle card importate e capisci subito cosa richiede attenzione."
  },
  {
    key: "progress",
    title: "Progress",
    body: "Tieni insieme textbook, coverage e review con un riepilogo calmo e leggibile."
  }
] as const;

type MediaDetailPageProps = {
  mediaSlug: string;
};

export async function MediaDetailPage({ mediaSlug }: MediaDetailPageProps) {
  const media = await getMediaDetailData(mediaSlug);

  if (!media) {
    notFound();
  }

  const resumeHref = media.currentLesson
    ? mediaTextbookLessonHref(media.slug, media.currentLesson.slug)
    : mediaStudyHref(media.slug, "textbook");

  return (
    <div className="media-detail-page">
      <StickyPageHeader
        backHref="/media"
        backLabel="Torna alla libreria"
        eyebrow={media.mediaTypeLabel}
        summary={media.description}
        title={media.title}
        meta={
          <>
            <span>{media.segmentKindLabel}</span>
            <span>{media.lessonsTotal} lesson</span>
            <span>{media.statusLabel}</span>
          </>
        }
        actions={
          <>
            <Link className="button button--primary" href={resumeHref}>
              Riprendi studio
            </Link>
            <Link className="button button--ghost" href={mediaStudyHref(media.slug, "progress")}>
              Apri progress
            </Link>
          </>
        }
      />

      <section className="hero-grid hero-grid--detail">
        <SurfaceCard className="media-detail-hero" variant="hero">
          <p className="eyebrow">Continua da qui</p>
          <h2 className="media-detail-hero__title">
            {media.currentLesson
              ? media.currentLesson.title
              : "Il percorso è pronto per la prima lezione."}
          </h2>
          <p className="media-detail-hero__summary">
            {media.currentLesson?.summary ??
              media.currentLesson?.excerpt ??
              "Questa pagina diventa la base operativa del media: ingresso, contesto e collegamenti alle aree di studio."}
          </p>
          <div className="hero-actions">
            <Link className="button button--primary" href={resumeHref}>
              {media.currentLesson ? "Riprendi lesson" : "Apri textbook"}
            </Link>
            <Link className="button button--ghost" href={mediaStudyHref(media.slug, "review")}>
              {media.cardsDue > 0 ? "Avvia review" : "Controlla review"}
            </Link>
          </div>
          <div className="stats-grid stats-grid--compact">
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
              detail={`${media.entriesTotal} entry nel media`}
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

        <SurfaceCard className="media-detail-side">
          <p className="eyebrow">Snapshot</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Media</span>
              <strong>{media.mediaTypeLabel}</strong>
            </div>
            <div className="summary-row">
              <span>Segmenti</span>
              <strong>{media.segments.length}</strong>
            </div>
            <div className="summary-row">
              <span>Card review</span>
              <strong>{media.activeReviewCards}</strong>
            </div>
            <div className="summary-row">
              <span>Prossimo passo</span>
              <strong>
                {media.nextLesson ? media.nextLesson.title : "Apri il percorso"}
              </strong>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <Section
        description="Le aree principali restano grandi, immediate e coerenti con il percorso di studio."
        eyebrow="Aree di studio"
        title="Scegli il punto di ingresso"
      >
        <div className="entry-point-grid">
          {studyAreas.map((area) => (
            <Link key={area.key} className="entry-point-link" href={mediaStudyHref(media.slug, area.key)}>
              <SurfaceCard className="entry-point-card">
                <div className="entry-point-card__top">
                  <h3 className="entry-point-card__title">{area.title}</h3>
                  <span className="entry-point-card__arrow">Apri</span>
                </div>
                <p className="entry-point-card__body">{area.body}</p>
                <p className="entry-point-card__detail">
                  {area.key === "textbook" && media.currentLesson
                    ? `Ora: ${media.currentLesson.title}`
                    : null}
                  {area.key === "glossary"
                    ? `${media.entriesKnown}/${media.entriesTotal} già toccate`
                    : null}
                  {area.key === "review" ? media.reviewQueueLabel : null}
                  {area.key === "progress"
                    ? media.textbookProgressPercent !== null
                      ? `${media.textbookProgressPercent}% textbook`
                      : `${media.lessonsTotal} lesson tracciate`
                    : null}
                </p>
              </SurfaceCard>
            </Link>
          ))}
        </div>
      </Section>

      <section className="content-section content-section--split">
        <Section
          description="Una struttura sobria che prepara bene l’arrivo del reader e della rail lesson."
          eyebrow="Percorso"
          title="Segmenti e lesson"
        >
          {media.segments.length > 0 ? (
            <div className="segment-list">
              {media.segments.map((segment) => (
                <SurfaceCard key={segment.id} className="segment-card" variant="quiet">
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
                      : "Pronto a ospitare la rail lesson del reader."}
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
          description="Il giapponese resta in primo piano, con stato e significato subito leggibili."
          eyebrow="Prime entry"
          title="Lessico e pattern già emersi"
        >
          {media.previewEntries.length > 0 ? (
            <div className="entry-preview-list">
              {media.previewEntries.map((entry) => (
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
                    {entry.segmentTitle ? (
                      <p className="entry-preview-card__segment">{entry.segmentTitle}</p>
                    ) : null}
                  </SurfaceCard>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Ancora nessuna entry collegata."
              description="Termini e pattern appariranno qui quando il media avrà contenuto glossario già importato nel DB."
            />
          )}
        </Section>
      </section>

      <div className="media-detail-page__footer">
        <Link className="text-link" href={mediaHref(media.slug)}>
          Resta sul media
        </Link>
      </div>
    </div>
  );
}
