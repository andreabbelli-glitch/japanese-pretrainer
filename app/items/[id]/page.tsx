import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AddToReviewForm,
  AttentionCallout,
  FuriganaToggle,
  QuickRecognitionBox,
  RelatedUnitsList,
  RevealTranslation,
  SentenceBreakdown,
} from '@/src/components/learning';
import { PageShell } from '@/src/components/page-shell';
import { getCanonicalExamples, getCanonicalLessons, getLanguageItemById, getSourceUnits } from '@/src/domain/content';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getLanguageItemById(id);

  if (!item) {
    notFound();
  }

  const examples = getCanonicalExamples().filter((example) => example.itemIds.includes(item.id));
  const units = getSourceUnits().filter((unit) => unit.requiredItemIds.includes(item.id));
  const lessons = getCanonicalLessons().filter((lesson) => lesson.itemIds.includes(item.id));

  const productIds = Array.from(new Set(units.map((unit) => unit.productId)));

  return (
    <PageShell title={`${item.id} — ${item.surface}`} description="Scheda item canonico con contesti reali multi-layer.">
      <FuriganaToggle japanese={item.surface} reading={item.reading} className="rounded-lg border border-slate-200 bg-white p-4" />

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
        <p><span className="font-semibold">Tipo:</span> {item.kind}</p>
        <p><span className="font-semibold">Priorità:</span> {item.priority}</p>
        <p className="md:col-span-2"><span className="font-semibold">Significato (IT):</span> {item.meaning_it}</p>
      </section>

      <AttentionCallout title="Spiegazione ELI5">
        <p>{item.explanation_eli5}</p>
      </AttentionCallout>

      <QuickRecognitionBox
        prompt="Quando vedi questa forma, chiediti subito dove sta il trigger/bersaglio/azione."
        clues={item.senses.slice(0, 4)}
      />

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Esempi reali</h2>
        {examples.map((example) => (
          <div key={example.id} className="rounded-md bg-slate-50 p-3">
            <SentenceBreakdown
              sentence={example.jp}
              chunks={example.breakdown.map((part) => ({ part, explanation: 'Blocco utile per riconoscere la funzione nella frase.' }))}
            />
            <RevealTranslation translation={example.translation_it} />
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">Dove appare</h2>
        <p className="text-slate-700">Appare in {units.length} unità e in {lessons.length} lezioni.</p>
        <p className="text-slate-700">Prodotti collegati: {productIds.join(", ") || "nessuno"}.</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {lessons.slice(0, 6).map((lesson) => (
            <li key={lesson.id}>
              {lesson.layer === 'core' ? (
                <Link href={`/learn/core/${lesson.slug}`} className="hover:underline">{lesson.title}</Link>
              ) : lesson.layer === 'game' ? (
                <Link href={`/games/${lesson.gameId}/learn/${lesson.slug}`} className="hover:underline">{lesson.title}</Link>
              ) : (
                <Link href={`/games/${lesson.gameId}/products/${lesson.productId}/learn/${lesson.slug}`} className="hover:underline">{lesson.title}</Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <RelatedUnitsList units={units.slice(0, 8)} title="Unità/prodotti collegati" />

      <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-sm text-white">
        <p className="font-semibold">Consolida subito in review</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <AddToReviewForm itemId={item.id} />
          <Link href="/review" className="inline-block rounded-md bg-white px-3 py-2 font-medium text-slate-900">Vai alla review</Link>
        </div>
      </div>
    </PageShell>
  );
}
