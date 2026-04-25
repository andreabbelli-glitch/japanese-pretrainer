import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getGrammarGlossaryDetailData } from "@/features/glossary/server";
import { readInternalHref } from "@/lib/site";

type GlossaryGrammarDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlossaryGrammarDetailRoute({
  params,
  searchParams
}: GlossaryGrammarDetailRouteProps) {
  const [{ entryId, mediaSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const detailData = await getGrammarGlossaryDetailData(mediaSlug, entryId);
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} returnTo={returnTo} />;
}
