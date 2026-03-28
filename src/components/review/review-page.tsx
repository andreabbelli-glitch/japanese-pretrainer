import type { ReviewPageData } from "@/lib/review";

import { ReviewPageClient } from "./review-page-client";

type ReviewPageProps = {
  data: ReviewPageData;
};

export function ReviewPage({ data }: ReviewPageProps) {
  return <ReviewPageClient key={buildReviewPageClientKey(data)} data={data} />;
}

function buildReviewPageClientKey(data: ReviewPageData) {
  return [data.scope, data.media.slug].join(":");
}
