import { notFound } from 'next/navigation';
import { AttentionCallout, QuickRecognitionBox, RelatedItemsList, RelatedUnitsList } from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getLanguageItemById, getUnitById } from '@/src/domain/content';
import { loadCoreLesson, parseLessonSections } from '@/src/domain/learning';

export default async function CoreLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = loadCoreLesson(slug);

  if (!lesson) notFound();

  const sections = parseLessonSections(lesson.body);
  const lessonItems = lesson.itemIds
    .map((id) => getLanguageItemById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8);

  const units = lesson.unitIds
    .map((unitId) => getUnitById('game.duel-masters', unitId.includes('.sd2.') ? 'product.dm25-sd2' : 'product.dm25-sd1', unitId))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    .slice(0, 4);

  return (
    <PageShell title={lesson.title} description={lesson.summary}>
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <h2 className="text-base font-semibold">Cosa impari</h2>
        <p>{sections['cosa impari']}</p>
        <h2 className="text-base font-semibold">Spiegazione ELI5</h2>
        <p>{sections['spiegazione eli5']}</p>
      </section>

      <QuickRecognitionBox
        prompt={sections['come lo riconosci sulla carta']}
        clues={sections['esempi reali'].split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 4)}
      />

      <AttentionCallout title="Errori comuni da evitare">
        <p>{sections['errori comuni / falsi amici']}</p>
      </AttentionCallout>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold text-slate-900">Micro-drill</h3>
        <p className="mt-1 text-slate-700">{sections['micro-drill']}</p>
      </section>

      <RelatedItemsList items={lessonItems.map((item) => ({ id: item.id, term: item.surface, meaning: item.meaning_it }))} />
      <RelatedUnitsList units={units} title="Unità reali dove applicarlo" />
    </PageShell>
  );
}
