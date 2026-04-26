import { notFound } from "next/navigation";

import { KatakanaSpeedRecapPage } from "@/components/katakana-speed/katakana-speed-recap-page";
import { getKatakanaSpeedRecapPageData } from "@/features/katakana-speed/server";

export const dynamic = "force-dynamic";

type KatakanaSpeedRecapRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function KatakanaSpeedRecapRoute({
  params
}: KatakanaSpeedRecapRouteProps) {
  const { sessionId } = await params;
  const data = await getKatakanaSpeedRecapPageData({ sessionId });

  if (!data) {
    notFound();
  }

  return <KatakanaSpeedRecapPage data={data} />;
}
