import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getGlobalTermGlossaryDetailData } from "@/features/glossary/server";
import { readInternalHref } from "@/lib/site";

type GlobalGlossaryTermRouteProps = {
  params: Promise<{
    surface: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlobalGlossaryTermRoute({
  params,
  searchParams
}: GlobalGlossaryTermRouteProps) {
  const [{ surface }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const detailData = await getGlobalTermGlossaryDetailData(
    decodeURIComponent(surface),
    resolvedSearchParams
  );
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} returnTo={returnTo} />;
}
