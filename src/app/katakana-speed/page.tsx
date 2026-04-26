import { KatakanaSpeedPage } from "@/components/katakana-speed/katakana-speed-page";
import { getKatakanaSpeedPageData } from "@/features/katakana-speed/server";

export const dynamic = "force-dynamic";

export default async function KatakanaSpeedRoute() {
  const data = await getKatakanaSpeedPageData();

  return <KatakanaSpeedPage data={data} />;
}
