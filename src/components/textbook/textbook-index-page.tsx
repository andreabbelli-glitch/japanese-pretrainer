import Link from "next/link";

import { renderFurigana } from "@/lib/render-furigana";
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
  const lessonSectionDescription = data.resumeLesson
    ? `Riprendi da ${data.resumeLesson.title} oppure scegli una lesson dal percorso.`
    : "Scegli una lesson dal percorso.";
  const resumeLabel =
    data.resumeLesson?.status === "completed"
      ? "Rileggi dall'inizio"
      : "Continua il percorso";

  return (
    <div className="textbook-index-page">
      <StickyPageHeader
        backHref={mediaHref(data.media.slug)}
        backLabel={data.media.title}
        eyebrow="Textbook"
        title="Percorso delle lesson"
        summary={renderFurigana(data.media.description, {
          linkBehavior: "flatten"
        })}
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

      <Section
        eyebrow="Lesson"
        title="Scegli da dove riprendere"
        description={lessonSectionDescription}
        actions={
          <div className="hero-actions">
            {resumeHref ? (
              <Link className="button button--primary" href={resumeHref}>
                {resumeLabel}
              </Link>
            ) : null}
            <Link className="button button--ghost" href={data.glossaryHref}>
              Apri Glossary
            </Link>
            <Link className="button button--ghost" href="/settings">
              Settings
            </Link>
          </div>
        }
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
                            "Apri la lesson nel reader con tooltip e controllo furigana."}
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
