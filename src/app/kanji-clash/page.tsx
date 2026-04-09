import { KanjiClashPage } from "@/components/kanji-clash/kanji-clash-page";
import { getKanjiClashPageData } from "@/lib/kanji-clash";

type KanjiClashRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function KanjiClashRoute({
  searchParams
}: KanjiClashRouteProps) {
  const resolvedSearchParams = await searchParams;
  const data = await getKanjiClashPageData(resolvedSearchParams);

  return <KanjiClashPage data={data} />;
}
