import { notFound } from "next/navigation";

import { GlossaryDetailPage } from "@/components/glossary/glossary-detail-page";
import { getGlobalGrammarGlossaryDetailData } from "@/features/glossary/server";
import { decodeRouteSegment, readInternalHref } from "@/features/navigation";

type GlobalGlossaryGrammarRouteProps = {
  params: Promise<{
    surface: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlobalGlossaryGrammarRoute({
  params,
  searchParams
}: GlobalGlossaryGrammarRouteProps) {
  const [{ surface }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams
  ]);
  const detailData = await getGlobalGrammarGlossaryDetailData(
    decodeRouteSegment(surface),
    resolvedSearchParams
  );
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!detailData) {
    notFound();
  }

  return <GlossaryDetailPage data={detailData} returnTo={returnTo} />;
}
