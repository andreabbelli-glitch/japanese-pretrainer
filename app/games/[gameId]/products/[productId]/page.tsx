import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GoalGapSummary, RelatedItemsList, UnlockNextList } from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getLanguageItemById } from '@/src/domain/content';
import { analyzeTargetGaps, loadProductPage, loadUserMasteryMap } from '@/src/domain/learning';

export default async function ProductPage({ params }: { params: Promise<{ gameId: string; productId: string }> }) {
  const { gameId, productId } = await params;
  const data = loadProductPage(gameId, productId);

  if (!data) {
    notFound();
  }

  const masteryMap = await loadUserMasteryMap();
  const gap = analyzeTargetGaps(
    {
      id: `goal.product.${data.product.id}`,
      targetType: 'product',
      gameId: data.game.id,
      productId: data.product.id,
      title: data.product.name,
    },
    masteryMap,
  );

  const missingPreview = gap.missingItems.slice(0, 8).map((item) => ({
    id: item.id,
    term: item.surface,
    meaning: item.meaning_it,
  }));

  const weakPreview = gap.weakItems.slice(0, 6).map((item) => getLanguageItemById(item.id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <PageShell title={data.product.name} description={data.product.summary_it}>
      <GoalGapSummary gap={gap} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold text-slate-900">Lezioni di questo prodotto</h2>
        <ul className="mt-2 space-y-2">
          {data.lessons.map((lesson) => (
            <li key={lesson.id} className="rounded bg-slate-50 p-3">
              <Link href={`/games/${data.game.id}/products/${data.product.id}/learn/${lesson.slug}`} className="font-semibold hover:underline">
                {lesson.title}
              </Link>
              <p className="text-slate-700">{lesson.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold text-slate-900">Cosa ti manca / cosa è debole</h2>
        <p className="text-slate-700">Item mancanti principali: {gap.missingItems.slice(0, 5).map((item) => item.surface).join(', ') || 'nessuno'}.</p>
        <p className="text-slate-700">Item deboli principali: {weakPreview.slice(0, 5).map((item) => item.surface).join(', ') || 'nessuno'}.</p>
      </section>

      <UnlockNextList recommendations={gap.unlockNextRecommendations.slice(0, 5)} gameId={data.game.id} productId={data.product.id} />

      <RelatedItemsList items={missingPreview} />

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">Unità del prodotto</h2>
        <ul className="space-y-2">
          {data.units.map((unit) => (
            <li key={unit.id} className="rounded bg-slate-50 p-3 text-sm">
              <Link href={`/games/${data.game.id}/products/${data.product.id}/units/${unit.id}`} className="font-semibold hover:underline">
                {unit.name}
              </Link>
              <p className="text-slate-700">{unit.paraphrase_it}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
