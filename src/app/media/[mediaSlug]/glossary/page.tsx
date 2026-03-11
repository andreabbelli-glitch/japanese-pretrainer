import { notFound } from "next/navigation";

import { GlossaryPage } from "@/components/glossary/glossary-page";
import { getGlossaryPageData } from "@/lib/glossary";
import { readInternalHref } from "@/lib/site";

type GlossaryRouteProps = {
  params: Promise<{
    mediaSlug: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MediaGlossaryRoute({
  params,
  searchParams
}: GlossaryRouteProps) {
  const { mediaSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const glossaryData = await getGlossaryPageData(
    mediaSlug,
    resolvedSearchParams
  );
  const returnTo = readInternalHref(resolvedSearchParams.returnTo);

  if (!glossaryData) {
    notFound();
  }

  return <GlossaryPage data={glossaryData} returnTo={returnTo} />;
}
