import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { getConsolidationHubData } from "@/lib/consolidation";

export const dynamic = "force-dynamic";

export default async function ConsolidationHubRoute() {
  const data = await getConsolidationHubData();

  if (data.totalPending === 0) {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Consolidamento"
          title="Non ci sono card da consolidare."
          description="Completa una lesson nuova: le sue flashcard passeranno qui prima della review FSRS."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <section className="dashboard-page" aria-labelledby="consolidation-title">
      <div className="page-heading">
        <p className="eyebrow">Consolidamento</p>
        <h1 id="consolidation-title">
          Card pronte per il passaggio pre-review
        </h1>
      </div>

      <div className="media-grid">
        {data.retrainingQueue ? (
          <article className="media-card">
            <div className="media-card__body">
              <p className="eyebrow">
                {data.retrainingQueue.pendingCount} da rinforzare
              </p>
              <h2>{data.retrainingQueue.title}</h2>
              <div className="stack-sm">
                <Link
                  className="button button--secondary"
                  href={data.retrainingQueue.href}
                >
                  Avvia queue unica · {data.retrainingQueue.pendingCount}
                </Link>
              </div>
            </div>
          </article>
        ) : null}
        {data.mediaGroups.map((group) => (
          <article className="media-card" key={group.mediaId}>
            <div className="media-card__body">
              <p className="eyebrow">{group.pendingCount} pending</p>
              <h2>{group.mediaTitle}</h2>
              <div className="stack-sm">
                {group.lessons.map((lesson) => (
                  <Link
                    className="button button--secondary"
                    href={lesson.href}
                    key={lesson.lessonId}
                  >
                    {lesson.lessonTitle} · {lesson.pendingCount}
                  </Link>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
