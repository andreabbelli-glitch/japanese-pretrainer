import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/src/components/page-shell";
import { getCardById, getDeckBySlug } from "@/src/domain/content";

export default async function DeckDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const deck = getDeckBySlug(slug);

  if (!deck) {
    notFound();
  }

  const cards = deck.uniqueCards.map((cardId) => getCardById(cardId)).filter((card) => card !== undefined);

  return (
    <PageShell title={deck.name} description="Deck page base: lista carte uniche e accesso diretto alle card pages.">
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">Totale carte nel deck:</span> {deck.totalCards}
        </p>
        <p>{deck.notes}</p>
      </section>

      <ul className="space-y-2">
        {cards.map((card) => (
          <li key={card.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <Link href={`/cards/${card.slug}` as Route} className="font-semibold text-slate-900 hover:underline">
              {card.nameJa}
            </Link>
            <p className="text-sm text-slate-700">{card.quickSenseIt}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
