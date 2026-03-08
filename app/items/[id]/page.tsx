import Link from "next/link";
import { notFound } from "next/navigation";
import { FuriganaToggle, RelatedCardsList, RelatedItemsList } from "@/src/components/learning";
import { PageShell } from "@/src/components/page-shell";
import { getCardById, getExamplesForItem, getItemById, getItems } from "@/src/domain/content";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getItemById(id);

  if (!item) {
    notFound();
  }

  const examples = getExamplesForItem(item.id);
  const cards = item.relatedCardIds.map((cardId) => getCardById(cardId)).filter((card) => card !== undefined);
  const relatedPatterns = getItems().filter((candidate) => candidate.type === "pattern" && candidate.relatedCardIds.some((cardId) => item.relatedCardIds.includes(cardId)));

  return (
    <PageShell title={`${item.id} — ${item.term}`} description="Scheda item completa per studio + collegamenti diretti a carte e review.">
      <FuriganaToggle japanese={item.term} reading={item.reading} className="rounded-lg border border-slate-200 bg-white p-4" />

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
        <p>
          <span className="font-semibold">Categoria:</span> {item.type}
        </p>
        <p>
          <span className="font-semibold">Priorità:</span> {item.priority}
        </p>
        <p className="md:col-span-2">
          <span className="font-semibold">Spiegazione italiana:</span> {item.meaning}
        </p>
        <p className="md:col-span-2">
          <span className="font-semibold">Uso nel gioco:</span> compare in {item.relatedCardIds.length} carte del corpus.
        </p>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Esempi reali</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {examples.map((example) => (
            <li key={example.id} className="rounded-md bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{example.textJa}</p>
              <p>{example.glossIt}</p>
            </li>
          ))}
        </ul>
      </section>

      <RelatedItemsList items={relatedPatterns.slice(0, 6)} />
      <RelatedCardsList cards={cards} />

      <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-sm text-white">
        <p className="font-semibold">Pronto per ripasso?</p>
        <p className="mt-1">Aggiungi questo item alla routine review per consolidare memoria e lettura reale.</p>
        <Link href="/review" className="mt-3 inline-block rounded-md bg-white px-3 py-2 font-medium text-slate-900">
          Vai alla review
        </Link>
      </div>
    </PageShell>
  );
}
