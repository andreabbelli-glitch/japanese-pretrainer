import { notFound } from "next/navigation";

import { ReviewPage } from "@/components/review/review-page";
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
  const [{ mediaSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const reviewData = await getReviewPageData(mediaSlug, resolvedSearchParams);

  if (!reviewData) {
    notFound();
  }

  return <ReviewPage data={reviewData} searchParams={resolvedSearchParams} />;
}
