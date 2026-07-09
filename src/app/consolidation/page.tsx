import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { getConsolidationHubData } from "@/features/consolidation/server";

export const dynamic = "force-dynamic";

export default async function ConsolidationHubRoute() {
  const data = await getConsolidationHubData();

  return (
    <section
      aria-labelledby="consolidation-title"
      className="dashboard-page consolidation-page"
    >
      <header className="page-heading consolidation-hero">
        <p className="eyebrow">Consolidamento</p>
        <h1 id="consolidation-title">Rinforza le card prima della Review</h1>
        <p className="consolidation-hero__description">
          Qui prepari le nuove card e riprendi quelle che hanno bisogno di un
          passaggio in più, senza perdere il contesto in cui le hai incontrate.
        </p>
        <StudyPath />
      </header>

      {data.totalPending === 0 ? (
        <div className="consolidation-empty">
          <EmptyState
            eyebrow="Percorso aggiornato"
            title="Non ci sono card da rinforzare."
            description="Completa una lesson nuova: le sue flashcard compariranno qui prima di entrare nella Review."
            action={
              <Link className="button button--primary" href="/media">
                Apri libreria
              </Link>
            }
          />
        </div>
      ) : (
        <div className="consolidation-sections">
          {data.mediaGroups.length > 0 ? (
            <section
              aria-labelledby="consolidation-new-title"
              className="consolidation-section"
            >
              <div className="consolidation-section__heading">
                <p className="eyebrow">Dopo una lesson completata</p>
                <h2 id="consolidation-new-title">Nuove dalla lesson</h2>
                <p>
                  Richiama lettura e significato delle nuove card prima di
                  aggiungerle alla Review.
                </p>
              </div>
              <div className="consolidation-grid">
                {data.mediaGroups.map((group) => (
                  <article className="consolidation-card" key={group.mediaId}>
                    <div className="consolidation-card__heading">
                      <p className="eyebrow">
                        {formatCardCount(group.pendingCount)} da rinforzare
                      </p>
                      <h3>{group.mediaTitle}</h3>
                    </div>
                    <div className="consolidation-card__actions">
                      {group.lessons.map((lesson) => (
                        <Link
                          className="button button--secondary consolidation-lesson-link"
                          href={lesson.href}
                          key={lesson.lessonId}
                        >
                          <span>{lesson.lessonTitle}</span>
                          <strong>
                            Rinforza {formatCardCount(lesson.pendingCount)}
                          </strong>
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {data.retrainingQueue ? (
            <section
              aria-labelledby="consolidation-retraining-title"
              className="consolidation-section"
            >
              <div className="consolidation-section__heading">
                <p className="eyebrow">Quando una risposta non è stabile</p>
                <h2 id="consolidation-retraining-title">
                  Da rinforzare dalla Review
                </h2>
                <p>
                  Ripassa le card che hanno bisogno di più sicurezza, poi
                  riportale nella Review quotidiana.
                </p>
              </div>
              <article className="consolidation-card consolidation-card--retraining">
                <div className="consolidation-card__heading">
                  <p className="eyebrow">
                    {formatCardCount(data.retrainingQueue.pendingCount)} da
                    rinforzare
                  </p>
                  <h3>{data.retrainingQueue.title}</h3>
                </div>
                <Link
                  className="button button--primary"
                  href={data.retrainingQueue.href}
                >
                  Rinforza {formatCardCount(data.retrainingQueue.pendingCount)}
                </Link>
              </article>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StudyPath() {
  return (
    <div
      aria-label="Percorso: Lesson completata, Rinforzo, Review"
      className="consolidation-path"
      role="list"
    >
      <span role="listitem">Lesson completata</span>
      <span aria-hidden="true" className="consolidation-path__arrow">
        →
      </span>
      <span role="listitem">Rinforzo</span>
      <span aria-hidden="true" className="consolidation-path__arrow">
        →
      </span>
      <span role="listitem">Review</span>
    </div>
  );
}

function formatCardCount(count: number) {
  return `${count} card`;
}
