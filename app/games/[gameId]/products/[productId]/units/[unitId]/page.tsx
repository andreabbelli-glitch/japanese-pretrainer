import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FuriganaToggle,
  GoalGapSummary,
  RelatedItemsList,
  RevealTranslation,
  SentenceBreakdown,
  UnlockNextList,
} from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getLanguageItemById } from '@/src/domain/content';
import { analyzeTargetGaps, loadUnitPage, loadUserMasteryMap } from '@/src/domain/learning';

export default async function UnitPage({ params }: { params: Promise<{ gameId: string; productId: string; unitId: string }> }) {
  const { gameId, productId, unitId } = await params;
  const data = loadUnitPage(gameId, productId, unitId);

  if (!data) {
    notFound();
  }

  const masteryMap = await loadUserMasteryMap();
  const gap = analyzeTargetGaps(
    {
      id: `goal.unit.${data.unit.id}`,
      targetType: 'unit',
      gameId: data.game.id,
      productId: data.product.id,
      unitId: data.unit.id,
      title: data.unit.name,
    },
    masteryMap,
  );

  const requiredItems = data.unit.requiredItemIds
    .map((id) => getLanguageItemById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      term: item.surface,
      meaning: item.meaning_it,
    }));


  return (
    <PageShell title={data.unit.name} description={data.unit.paraphrase_it}>
      <FuriganaToggle japanese={data.unit.jpText} reading={data.unit.reading || data.unit.nameReading} className="rounded-lg border border-slate-200 bg-white p-4" />

      <SentenceBreakdown
        sentence={data.unit.jpText}
        chunks={data.unit.jpText
          .split('/')
          .map((chunk) => chunk.trim())
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .map((chunk) => ({ part: chunk, explanation: 'Blocco frase chiave da riconoscere nella carta.' }))}
      />

      <RevealTranslation label="parafrasi italiana" translation={data.unit.paraphrase_it} />
      <GoalGapSummary gap={gap} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-slate-900">ID canonici richiesti</h3>
        <p className="mt-1 text-slate-700">{data.unit.requiredItemIds.join(', ')}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-slate-900">Lezioni collegate</h3>
        <ul className="mt-2 space-y-1">
          {data.unit.recommendedLessonIds.map((lessonId) => {
            const lesson = data.lessons.find((entry) => entry.id === lessonId);
            if (!lesson) return null;
            return (
              <li key={lesson.id}>
                <Link href={`/games/${data.game.id}/products/${data.product.id}/learn/${lesson.slug}`} className="hover:underline">
                  {lesson.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <UnlockNextList recommendations={gap.unlockNextRecommendations.slice(0, 3)} gameId={data.game.id} productId={data.product.id} />
      <RelatedItemsList items={requiredItems.slice(0, 12)} />
    </PageShell>
  );
}
