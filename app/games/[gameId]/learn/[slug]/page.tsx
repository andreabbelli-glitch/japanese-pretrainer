import { notFound } from 'next/navigation';
import { AttentionCallout, QuickRecognitionBox, RelatedItemsList, RelatedUnitsList } from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getLanguageItemById, getUnitById } from '@/src/domain/content';
import { loadGameLesson, parseLessonSections } from '@/src/domain/learning';

export default async function GameLessonPage({ params }: { params: Promise<{ gameId: string; slug: string }> }) {
  const { gameId, slug } = await params;
  const lesson = loadGameLesson(gameId, slug);

  if (!lesson) notFound();

  const sections = parseLessonSections(lesson.body);
  const lessonItems = lesson.itemIds
    .map((id) => getLanguageItemById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 10);

  const units = lesson.unitIds
    .map((unitId) => getUnitById(gameId, unitId.includes('.sd2.') ? 'product.dm25-sd2' : 'product.dm25-sd1', unitId))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    .slice(0, 5);

  return (
    <PageShell title={lesson.title} description={lesson.summary}>
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">Cosa impari</h2>
        <p>{sections['cosa impari']}</p>
        <h2 className="text-base font-semibold">Spiegazione ELI5</h2>
        <p>{sections['spiegazione eli5']}</p>
      </section>

      <QuickRecognitionBox
        prompt={sections['come lo riconosci sulla carta']}
        clues={sections['esempi reali'].split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 4)}
      />

      <AttentionCallout title="Falso amico frequente">
        <p>{sections['errori comuni / falsi amici']}</p>
      </AttentionCallout>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold">Micro-drill</h3>
        <p>{sections['micro-drill']}</p>
      </section>

      <RelatedItemsList items={lessonItems.map((item) => ({ id: item.id, term: item.surface, meaning: item.meaning_it }))} />
      <RelatedUnitsList units={units} title="Unità Duel Masters collegate" />
    </PageShell>
  );
}
