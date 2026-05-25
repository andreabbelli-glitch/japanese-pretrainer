import { notFound } from "next/navigation";

import { PitchAccentRecapPage } from "@/components/pitch-accent/pitch-accent-recap-page";
import { getPitchAccentRecapPageData } from "@/features/pitch-accent/server";

export const dynamic = "force-dynamic";

type PitchAccentRecapRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function PitchAccentRecapRoute({
  params
}: PitchAccentRecapRouteProps) {
  const { sessionId } = await params;
  const data = await getPitchAccentRecapPageData({ sessionId });

  if (!data) {
    notFound();
  }

  return <PitchAccentRecapPage data={data} />;
}
