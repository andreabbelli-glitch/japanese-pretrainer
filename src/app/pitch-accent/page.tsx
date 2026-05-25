import { PitchAccentPage } from "@/components/pitch-accent/pitch-accent-page";
import { getPitchAccentPageData } from "@/features/pitch-accent/server";

export const dynamic = "force-dynamic";

export default async function PitchAccentRoute() {
  const data = await getPitchAccentPageData();

  return <PitchAccentPage data={data} />;
}
