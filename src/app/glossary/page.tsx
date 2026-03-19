import { connection } from "next/server";

import { GlossaryPortalPage } from "@/components/glossary/glossary-portal-page";
import { getGlobalGlossaryPageData } from "@/lib/glossary";

type GlossaryRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GlossaryPage({
  searchParams
}: GlossaryRouteProps) {
  await connection();

  const resolvedSearchParams = await searchParams;
  const glossaryData = await getGlobalGlossaryPageData(resolvedSearchParams);

  return <GlossaryPortalPage data={glossaryData} />;
}
