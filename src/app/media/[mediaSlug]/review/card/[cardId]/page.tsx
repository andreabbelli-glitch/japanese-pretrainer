import { notFound } from "next/navigation";

import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import { getReviewCardDetailData } from "@/lib/review";

type ReviewCardRouteProps = {
  params: Promise<{
    cardId: string;
    mediaSlug: string;
  }>;
};

export default async function ReviewCardRoute({
  params
}: ReviewCardRouteProps) {
  const { cardId, mediaSlug } = await params;
  const detailData = await getReviewCardDetailData(mediaSlug, cardId);

  if (!detailData) {
    notFound();
  }

  return <ReviewCardDetailPage data={detailData} />;
}
