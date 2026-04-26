import { notFound } from "next/navigation";

import { KatakanaSpeedSessionPage } from "@/components/katakana-speed/katakana-speed-session-page";
import { getKatakanaSpeedSessionPageData } from "@/features/katakana-speed/server";

export const dynamic = "force-dynamic";

type KatakanaSpeedSessionRouteProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function KatakanaSpeedSessionRoute({
  params
}: KatakanaSpeedSessionRouteProps) {
  const { sessionId } = await params;
  const data = await getKatakanaSpeedSessionPageData({ sessionId });

  if (!data) {
    notFound();
  }

  return <KatakanaSpeedSessionPage data={data} />;
}
