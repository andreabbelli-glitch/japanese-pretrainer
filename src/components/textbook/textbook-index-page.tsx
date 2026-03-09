import Link from "next/link";

import type { TextbookIndexData } from "@/lib/textbook";
import { mediaHref, mediaTextbookLessonHref } from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { Section } from "../ui/section";
import { SurfaceCard } from "../ui/surface-card";

type TextbookIndexPageProps = {
  data: TextbookIndexData;
};

export function TextbookIndexPage({ data }: TextbookIndexPageProps) {
  const resumeHref = data.resumeLesson
    ? mediaTextbookLessonHref(data.media.slug, data.resumeLesson.slug)
    : null;

  return (
    <div className="textbook-index-page">
      <StickyPageHeader
        backHref={mediaHref(data.media.slug)}
        backLabel={data.media.title}
        eyebrow="Textbook"
        title="Percorso lesson"
        summary={data.media.description}
        meta={
          <>
            <span>{data.media.mediaTypeLabel}</span>
            <span>{data.totalLessons} lesson</span>
            <span>
              {data.textbookProgressPercent !== null
                ? `${data.textbookProgressPercent}% letto`
                : "Pronto a iniziare"}
            </span>
          </>
        }
      />

      <section className="textbook-hero-grid">
        <SurfaceCard className="textbook-hero" variant="hero">
          <p className="eyebrow">Da dove riprendere</p>
          <h2 className="textbook-hero__title">
            {data.resumeLesson?.title ?? "Il textbook è pronto per la prima lezione."}
          </h2>
          <p className="textbook-hero__summary">
            {data.resumeLesson?.summary ??
              data.resumeLesson?.excerpt ??
              "Le lesson restano ordinate per segmento, con progressi calmi e un ingresso leggibile."}
          </p>
          <div className="textbook-hero__meta">
            <span>{data.completedLessons} completate</span>
            <span>{data.totalLessons - data.completedLessons} da leggere</span>
            <span>Furigana: {data.furiganaMode}</span>
          </div>
          <div className="hero-actions">
            {resumeHref ? (
              <Link className="button button--primary" href={resumeHref}>
                {data.resumeLesson?.status === "completed" ? "Rileggi lesson" : "Apri lesson"}
              </Link>
            ) : null}
            <Link className="button button--ghost" href={data.glossaryHref}>
              Apri glossary
            </Link>
          </div>
        </SurfaceCard>

        <SurfaceCard className="textbook-hero-side">
          <p className="eyebrow">Segnali utili</p>
          <div className="stack-list stack-list--tight">
            <div className="summary-row">
              <span>Segmentazione</span>
              <strong>{data.media.segmentKindLabel}</strong>
            </div>
            <div className="summary-row">
              <span>Lesson in corso</span>
              <strong>
                {data.lessons.filter((lesson) => lesson.status === "in_progress").length}
              </strong>
            </div>
            <div className="summary-row">
              <span>Completamento</span>
              <strong>
                {data.textbookProgressPercent !== null
                  ? `${data.textbookProgressPercent}%`
                  : "0%"}
              </strong>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <Section
        eyebrow="Lesson"
        title="Scegli il punto di ingresso"
        description="La landing del textbook aiuta a capire dove iniziare, cosa è in corso e quale blocco del media stai attraversando."
      >
        {data.groups.length > 0 ? (
          <div className="textbook-group-list">
            {data.groups.map((group) => (
              <section key={group.id} className="textbook-group">
                <div className="textbook-group__heading">
                  <div>
                    <p className="eyebrow">{group.title}</p>
                    <h3 className="textbook-group__title">
                      {group.completedLessons}/{group.totalLessons} lette
                    </h3>
                  </div>
                  {group.note ? (
                    <p className="textbook-group__note">{group.note}</p>
                  ) : null}
                </div>

                <div className="textbook-lesson-grid">
                  {group.lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      className="textbook-lesson-link"
                      href={mediaTextbookLessonHref(data.media.slug, lesson.slug)}
                    >
                      <SurfaceCard className="textbook-lesson-card" variant="quiet">
                        <div className="textbook-lesson-card__top">
                          <span className={`meta-pill meta-pill--${lesson.status}`}>
                            {lesson.statusLabel}
                          </span>
                          {lesson.difficulty ? (
                            <span className="chip">{lesson.difficulty}</span>
                          ) : null}
                        </div>
                        <h4 className="textbook-lesson-card__title">{lesson.title}</h4>
                        <p className="textbook-lesson-card__body">
                          {lesson.summary ??
                            lesson.excerpt ??
                            "Lesson pronta nel reader con tooltip e controllo furigana."}
                        </p>
                        <div className="textbook-lesson-card__footer">
                          <span>{lesson.segmentTitle}</span>
                          <span>Apri</span>
                        </div>
                      </SurfaceCard>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nessuna lesson disponibile."
            description="Importa il textbook nel DB per vedere qui il percorso ordinato del media."
          />
        )}
      </Section>
    </div>
  );
}
