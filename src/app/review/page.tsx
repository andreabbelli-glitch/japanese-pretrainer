import Link from "next/link";
import { connection } from "next/server";

import { ReviewPage } from "@/components/review/review-page";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createRequestReviewProfiler,
  scheduleReviewProfilerFlush
} from "@/lib/review-profiler";
import { getGlobalReviewPageLoadResult } from "@/lib/review";

type ReviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewRoute({ searchParams }: ReviewRouteProps) {
  await connection();
  const profiler = await createRequestReviewProfiler({
    label: "route:global-review",
    meta: {
      scope: "global"
    }
  });
  scheduleReviewProfilerFlush(profiler);
  const resolvedSearchParams = await searchParams;

  const reviewResult = await profiler.measure(
    "getGlobalReviewPageLoadResult",
    () =>
      getGlobalReviewPageLoadResult(resolvedSearchParams, undefined, {
        profiler
      })
  );
  profiler.addMeta({
    resultKind: reviewResult.kind
  });

  if (reviewResult.kind === "empty-media") {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Review globale"
          title="Non ci sono ancora media importati."
          description="Importa un bundle per far nascere la review globale e iniziare a mettere in coda le prime card."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  if (reviewResult.kind === "empty-cards") {
    return (
      <div className="dashboard-page">
        <EmptyState
          eyebrow="Review globale"
          title="La review globale è pronta, ma non ci sono ancora card attive."
          description="Aggiungi card nuove o riattiva una voce dal Glossary: qui comparirà la queue globale appena ci saranno contenuti da lavorare."
          action={
            <Link className="button button--primary" href="/media">
              Apri libreria
            </Link>
          }
        />
      </div>
    );
  }

  return <ReviewPage data={reviewResult.data} />;
}
