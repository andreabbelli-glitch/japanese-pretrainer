import { notFound } from "next/navigation";

import { PitchAccentSessionPage } from "@/components/pitch-accent/pitch-accent-session-page";
import { getPitchAccentSessionPageData } from "@/features/pitch-accent/server";

export const dynamic = "force-dynamic";

type PitchAccentSessionRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function PitchAccentSessionRoute({
  params
}: PitchAccentSessionRouteProps) {
  const { sessionId } = await params;
  const data = await getPitchAccentSessionPageData({ sessionId });

  if (!data) {
    notFound();
  }

  return <PitchAccentSessionPage data={data} />;
}
