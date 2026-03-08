import { notFound } from 'next/navigation';
import { AttentionCallout, QuickRecognitionBox, RelatedItemsList, RelatedUnitsList } from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getLanguageItemById, getUnitById } from '@/src/domain/content';
import { loadProductLesson, parseLessonSections } from '@/src/domain/learning';

export default async function ProductLessonPage({ params }: { params: Promise<{ gameId: string; productId: string; slug: string }> }) {
  const { gameId, productId, slug } = await params;
  const lesson = loadProductLesson(gameId, productId, slug);

  if (!lesson) notFound();

  const sections = parseLessonSections(lesson.body);
  const lessonItems = lesson.itemIds
    .map((id) => getLanguageItemById(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 10);

  const units = lesson.unitIds
    .map((unitId) => getUnitById(gameId, productId, unitId))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
    .slice(0, 6);

  return (
    <PageShell title={lesson.title} description={lesson.summary}>
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">Cosa impari</h2>
        <p>{sections['cosa impari']}</p>
        <h2 className="text-base font-semibold">Spiegazione ELI5</h2>
        <p>{sections['spiegazione eli5']}</p>
        <h2 className="text-base font-semibold">Come lo riconosci</h2>
        <p>{sections['come lo riconosci sulla carta']}</p>
      </section>

      <QuickRecognitionBox
        prompt="Riconosci subito questi marker nel prodotto"
        clues={sections['esempi reali'].split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 5)}
      />

      <AttentionCallout title="Errore frequente nel deck">
        <p>{sections['errori comuni / falsi amici']}</p>
      </AttentionCallout>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="font-semibold">Micro-drill guidato</h3>
        <p>{sections['micro-drill']}</p>
      </section>

      <RelatedItemsList items={lessonItems.map((item) => ({ id: item.id, term: item.surface, meaning: item.meaning_it }))} />
      <RelatedUnitsList units={units} title="Unità del prodotto collegate" />
    </PageShell>
  );
}
