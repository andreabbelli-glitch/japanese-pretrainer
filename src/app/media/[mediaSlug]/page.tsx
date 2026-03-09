import { MediaDetailPage } from "@/components/media/media-detail-page";

export const dynamic = "force-dynamic";

type MediaDetailRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
};

export default async function MediaDetailRoute({
  params
}: MediaDetailRouteProps) {
  const { mediaSlug } = await params;

  return <MediaDetailPage mediaSlug={mediaSlug} />;
}
