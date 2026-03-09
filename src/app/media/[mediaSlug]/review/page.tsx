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
  const { mediaSlug } = await params;
  const reviewData = await getReviewPageData(mediaSlug, await searchParams);

  if (!reviewData) {
    notFound();
  }

  return <ReviewPage data={reviewData} />;
}
