"use client";

import Link from "next/link";
import { useState } from "react";

import type { TextbookIndexData } from "@/lib/textbook-types";
import {
  buildReviewSessionHref,
  mediaHref,
  mediaTextbookLessonHref
} from "@/lib/site";

import { StickyPageHeader } from "../layout/sticky-page-header";
import { EmptyState } from "../ui/empty-state";
import { SurfaceCard } from "../ui/surface-card";

type TextbookIndexPageProps = {
  data: TextbookIndexData;
};

export function TextbookIndexPage({ data }: TextbookIndexPageProps) {
  // Collapse completed groups by default
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of data.groups) {
      if (
        group.totalLessons > 0 &&
        group.completedLessons === group.totalLessons
      ) {
        initial[group.id] = true;
      }
    }
    return initial;
  });

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const resumeHref = data.resumeLesson
    ? mediaTextbookLessonHref(data.media.slug, data.resumeLesson.slug)
    : null;
  const resumeLabel =
    data.resumeLesson?.status === "completed"
      ? "Rileggi dall'inizio"
      : "Continua il percorso";

  const progressLabel =
    data.textbookProgressPercent !== null
      ? `${data.textbookProgressPercent}% letto`
      : "Pronto a iniziare";

  return (
    <div className="textbook-index-page">
      <StickyPageHeader
        backHref={mediaHref(data.media.slug)}
        backLabel={data.media.title}
        title="Textbook"
        meta={
          <>
            <span>{data.media.mediaTypeLabel}</span>
            <span>{data.totalLessons} lesson</span>
            <span>{progressLabel}</span>
          </>
        }
        actions={
          <div className="hero-actions">
            {resumeHref ? (
              <Link className="button button--primary" href={resumeHref}>
                {resumeLabel}
              </Link>
            ) : null}
            <Link className="button button--ghost" href={data.glossaryHref}>
              Glossary
            </Link>
          </div>
        }
      />

      {data.groups.length > 0 ? (
        <div className="textbook-group-list">
          {data.groups.map((group) => {
            const isCollapsed = !!collapsed[group.id];

            return (
              <section
                key={group.id}
                className={`textbook-group${isCollapsed ? "" : " textbook-group--open"}`}
              >
                <button
                  type="button"
                  className={`textbook-group__toggle${isCollapsed ? " textbook-group__toggle--collapsed" : ""}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!isCollapsed}
                >
                  <div className="textbook-group__toggle-row">
                    <div className="textbook-group__toggle-text">
                      <p className="eyebrow">{group.title}</p>
                      <h3 className="textbook-group__title">
                        {group.completedLessons}/{group.totalLessons} lette
                      </h3>
                    </div>
                    <svg
                      className="textbook-group__chevron"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 8l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {group.totalLessons > 0 && (
                    <div className="textbook-group__progress-track">
                      <div
                        className="textbook-group__progress-fill"
                        style={{
                          width: `${(group.completedLessons / group.totalLessons) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                  {group.note && !isCollapsed ? (
                    <p className="textbook-group__note">{group.note}</p>
                  ) : null}
                </button>

                {!isCollapsed && (
                  <div className="textbook-lesson-grid">
                    {group.lessons.map((lesson) => (
                      <div key={lesson.id}>
                        <SurfaceCard
                          className="textbook-lesson-card"
                          variant="quiet"
                        >
                          <div className="textbook-lesson-card__top">
                            <span
                              className={`meta-pill meta-pill--${lesson.status}`}
                            >
                              {lesson.statusLabel}
                            </span>
                            {lesson.difficulty ? (
                              <span className="chip">{lesson.difficulty}</span>
                            ) : null}
                          </div>
                          <h4 className="textbook-lesson-card__title">
                            {lesson.title}
                          </h4>
                          <p className="textbook-lesson-card__body">
                            {lesson.summary ??
                              lesson.excerpt ??
                              "Apri la lesson nel reader con tooltip e controllo furigana."}
                          </p>
                          <div className="textbook-lesson-card__footer">
                            <span>{lesson.segmentTitle}</span>
                            <div className="hero-actions">
                              <Link
                                className="button button--ghost button--small"
                                href={buildReviewSessionHref({
                                  mediaSlug: data.media.slug,
                                  segmentId: lesson.segmentId
                                })}
                              >
                                Ripassa vocaboli
                              </Link>
                              <Link
                                className="button button--primary button--small textbook-lesson-link"
                                href={mediaTextbookLessonHref(
                                  data.media.slug,
                                  lesson.slug
                                )}
                              >
                                Apri
                              </Link>
                            </div>
                          </div>
                        </SurfaceCard>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nessuna lesson disponibile."
          description="Importa il textbook nel DB per vedere qui il percorso ordinato del media."
        />
      )}
    </div>
  );
}
