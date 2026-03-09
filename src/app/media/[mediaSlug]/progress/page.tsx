import { notFound } from "next/navigation";

import { MediaProgressPage } from "@/components/media/media-progress-page";
import { getMediaProgressPageData } from "@/lib/progress";

type StudyAreaRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaProgressRoute({
  params
}: StudyAreaRouteProps) {
  const { mediaSlug } = await params;
  const data = await getMediaProgressPageData(mediaSlug);

  if (!data) {
    notFound();
  }

  return <MediaProgressPage data={data} />;
}
