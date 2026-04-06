import { notFound } from "next/navigation";

import { MediaDetailPage } from "@/components/media/media-detail-page";
import { getMediaProgressPageData } from "@/lib/progress";

type MediaDetailRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaDetailRoute({
  params
}: MediaDetailRouteProps) {
  const { mediaSlug } = await params;
  const data = await getMediaProgressPageData(mediaSlug);

  if (!data) {
    notFound();
  }

  return <MediaDetailPage data={data} />;
}
