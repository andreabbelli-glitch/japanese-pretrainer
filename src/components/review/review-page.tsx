import type { ReviewPageData } from "@/features/review/client";

import { ReviewPageClient } from "./review-page-client";

type ReviewPageProps = {
  data: ReviewPageData;
  searchParams?: Record<string, string | string[] | undefined>;
};

export function ReviewPage({ data, searchParams }: ReviewPageProps) {
  return (
    <ReviewPageClient
      key={buildReviewPageClientKey(data)}
      data={data}
      searchParams={searchParams}
    />
  );
}

function buildReviewPageClientKey(data: ReviewPageData) {
  return [data.scope, data.media.slug, data.mode ?? "review"].join(":");
}
