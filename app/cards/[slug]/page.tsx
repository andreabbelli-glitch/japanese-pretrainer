import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToReviewForm, FuriganaToggle, RelatedItemsList, RevealTranslation, SentenceBreakdown } from "@/src/components/learning";
import { PageShell } from "@/src/components/page-shell";
import { getCardBySlug, getExamplesForCard, getItemById } from "@/src/domain/content";

export default async function CardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  if (!card) {
    notFound();
  }

  const requiredItems = card.keyItemIds.map((itemId) => getItemById(itemId)).filter((item) => item !== undefined);
  const requiredPatterns = card.keyPatternIds.map((itemId) => getItemById(itemId)).filter((item) => item !== undefined);
  const examples = getExamplesForCard(card.id).slice(0, 5);

  return (
    <PageShell title={card.nameJa} description="Scheda carta didattica: segmentazione, parafrasi e prerequisiti linguistici.">
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>
          <span className="font-semibold">Deck:</span> {card.deckId}
        </p>
        <p>
          <span className="font-semibold">ID carta:</span> {card.id}
        </p>
      </section>

      <FuriganaToggle japanese={card.keySentenceJa} reading={card.nameReading} className="rounded-lg border border-slate-200 bg-white p-4" />

      <SentenceBreakdown
        sentence={card.keySentenceJa}
        chunks={card.keySentenceJa.split("/").map((part) => ({
          part: part.trim(),
          explanation: "Leggi questo blocco come segnale funzionale (quando/quanto/limitazione).",
        }))}
      />

      <RevealTranslation label="Parafrasi del senso" translation={card.quickSenseIt} />

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Esempi dalla carta</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {examples.map((example) => (
            <li key={example.id} className="rounded-md bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{example.textJa}</p>
              <p>{example.glossIt}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Item richiesti</h2>
        <RelatedItemsList items={requiredItems} />
        <div className="flex flex-wrap gap-2">
          {requiredItems.slice(0, 4).map((item) => (
            <AddToReviewForm key={item.id} itemId={item.id} compact />
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Pattern richiesti</h2>
        <RelatedItemsList items={requiredPatterns} />
      </section>

      <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-sm text-white">
        <p className="font-semibold">Vuoi consolidare subito i prerequisiti?</p>
        <p className="mt-1">Apri la review per ripassare gli item legati a questa carta.</p>
        <Link href="/review" className="mt-3 inline-block rounded-md bg-white px-3 py-2 font-medium text-slate-900">
          Avvia review
        </Link>
      </div>
    </PageShell>
  );
}
