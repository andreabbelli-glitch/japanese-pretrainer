import type { ReviewPageData } from "@/lib/review";

import { ReviewPageClient } from "./review-page-client";

type ReviewPageProps = {
  data: ReviewPageData;
};

export function ReviewPage({ data }: ReviewPageProps) {
  return <ReviewPageClient key={buildReviewPageClientKey(data)} data={data} />;
}

function buildReviewPageClientKey(data: ReviewPageData) {
  return [
    data.media.slug,
    data.selectedCard?.id ?? "no-card",
    data.selectedCardContext.showAnswer ? "answer" : "front",
    data.session.answeredCount,
    data.session.extraNewCount,
    data.session.notice ?? "no-notice",
    data.queue.queueCount
  ].join(":");
}
