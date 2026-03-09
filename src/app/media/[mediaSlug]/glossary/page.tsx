import { notFound } from "next/navigation";

import { GlossaryPage } from "@/components/glossary/glossary-page";
import { getGlossaryPageData } from "@/lib/glossary";

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
  const glossaryData = await getGlossaryPageData(mediaSlug, await searchParams);

  if (!glossaryData) {
    notFound();
  }

  return <GlossaryPage data={glossaryData} />;
}
