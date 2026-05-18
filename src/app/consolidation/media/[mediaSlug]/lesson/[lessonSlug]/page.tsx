import Link from "next/link";
import { notFound } from "next/navigation";

import { getConsolidationSessionData } from "@/lib/consolidation";
import { renderFurigana } from "@/lib/render-furigana";

export const dynamic = "force-dynamic";

type ConsolidationLessonRouteProps = {
  params: Promise<{
    lessonSlug: string;
    mediaSlug: string;
  }>;
};

export default async function ConsolidationLessonRoute({
  params
}: ConsolidationLessonRouteProps) {
  const { lessonSlug, mediaSlug } = await params;
  const data = await getConsolidationSessionData({ lessonSlug, mediaSlug });

  if (!data) {
    notFound();
  }

  if (data.subjects.length === 0) {
    return (
      <div className="dashboard-page">
        <div className="page-heading">
          <p className="eyebrow">{data.media.title}</p>
          <h1>{data.lesson.title}</h1>
          <p>Questa lesson non ha più card pending in consolidamento.</p>
        </div>
        <Link className="button button--primary" href={data.reviewHref}>
          Vai alla review
        </Link>
      </div>
    );
  }

  return (
    <section className="dashboard-page" aria-labelledby="consolidation-session-title">
      <div className="page-heading">
        <p className="eyebrow">{data.media.title}</p>
        <h1 id="consolidation-session-title">{data.lesson.title}</h1>
      </div>

      <div className="stack-md">
        {data.subjects.map((subject) => (
          <article className="panel" key={subject.subjectKey}>
            <p className="jp-inline">{renderFurigana(subject.front)}</p>
            <p>{subject.steps.map((step) => step.step).join(" + ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
