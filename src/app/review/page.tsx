import Link from "next/link";

import { ReviewPageClient } from "@/components/review/review-page-client";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createRequestReviewProfiler,
  scheduleReviewProfilerFlush
} from "@/lib/review-profiler";
import { getGlobalReviewFirstCandidateLoadResult } from "@/lib/review";

type ReviewRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewRoute({ searchParams }: ReviewRouteProps) {
  const [profiler, resolvedSearchParams] = await Promise.all([
    createRequestReviewProfiler({
      label: "route:global-review",
      meta: {
        scope: "global"
      }
    }),
    searchParams
  ]);
  scheduleReviewProfilerFlush(profiler);

  const reviewResult = await profiler.measure(
    "getGlobalReviewFirstCandidateLoadResult",
    () =>
      getGlobalReviewFirstCandidateLoadResult(resolvedSearchParams, undefined, {
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

  return (
    <ReviewPageClient
      data={reviewResult.data}
      searchParams={resolvedSearchParams}
    />
  );
}
