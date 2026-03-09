import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getGrammarGlossaryDetailData } from "@/lib/glossary";

type GlossaryGrammarDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
};

export default async function GlossaryGrammarDetailRoute({
  params
}: GlossaryGrammarDetailRouteProps) {
  const { entryId, mediaSlug } = await params;
  const detailData = await getGrammarGlossaryDetailData(mediaSlug, entryId);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} />;
}
