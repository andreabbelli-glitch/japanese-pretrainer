import { notFound } from "next/navigation";

import { ReviewCardDetailPage } from "@/components/review/review-card-detail-page";
import { getReviewCardDetailData } from "@/lib/review";
import { readInternalHref } from "@/lib/site";

type ReviewCardRouteProps = {
  params: Promise<{
    cardId: string;
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewCardRoute({
  params,
  searchParams
}: ReviewCardRouteProps) {
  const [{ cardId, mediaSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const detailData = await getReviewCardDetailData(mediaSlug, cardId);
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!detailData) {
    notFound();
  }

  return <ReviewCardDetailPage data={detailData} returnTo={returnTo} />;
}
