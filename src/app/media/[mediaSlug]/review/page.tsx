import { notFound } from "next/navigation";

import { ReviewPage } from "@/components/review/review-page";
import {
  createRequestReviewProfiler,
  scheduleReviewProfilerFlush
} from "@/lib/review-profiler";
import { getReviewPageData } from "@/lib/review";

type StudyAreaRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MediaReviewRoute({
  params,
  searchParams
}: StudyAreaRouteProps) {
  const [{ mediaSlug }, profiler, resolvedSearchParams] = await Promise.all([
    params,
    createRequestReviewProfiler({
      label: "route:media-review",
      meta: {
        scope: "media"
      }
    }),
    searchParams
  ]);
  profiler.addMeta({ mediaSlug });
  scheduleReviewProfilerFlush(profiler);
  const reviewData = await profiler.measure("getReviewPageData", () =>
    getReviewPageData(mediaSlug, resolvedSearchParams, undefined, {
      profiler
    })
  );
  profiler.addMeta({
    found: reviewData !== null
  });

  if (!reviewData) {
    notFound();
  }

  return <ReviewPage data={reviewData} />;
}
