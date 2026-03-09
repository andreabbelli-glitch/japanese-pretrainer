import { StudyAreaPlaceholderPage } from "@/components/media/study-area-placeholder-page";

type StudyAreaRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaReviewRoute({
  params
}: StudyAreaRouteProps) {
  const { mediaSlug } = await params;

  return <StudyAreaPlaceholderPage area="review" mediaSlug={mediaSlug} />;
}
