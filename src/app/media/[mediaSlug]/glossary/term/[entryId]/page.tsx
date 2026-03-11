import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getTermGlossaryDetailData } from "@/lib/glossary";
import { readInternalHref } from "@/lib/site";

type GlossaryTermDetailRouteProps = {
  params: Promise<{
    entryId: string;
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlossaryTermDetailRoute({
  params,
  searchParams
}: GlossaryTermDetailRouteProps) {
  const [{ entryId, mediaSlug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const detailData = await getTermGlossaryDetailData(mediaSlug, entryId);
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} returnTo={returnTo} />;
}
