import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getTermGlossaryDetailData } from "@/lib/glossary";

type GlossaryTermDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
};

export default async function GlossaryTermDetailRoute({
  params
}: GlossaryTermDetailRouteProps) {
  const { entryId, mediaSlug } = await params;
  const detailData = await getTermGlossaryDetailData(mediaSlug, entryId);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} />;
}
