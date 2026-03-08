import Link from "next/link";
import type { StudyCard } from "@/src/domain/content";

export function RelatedCardsList({ cards }: { cards: StudyCard[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Carte collegate</h3>
      <ul className="space-y-2 text-sm">
        {cards.map((card) => (
          <li key={card.id} className="rounded-md bg-slate-50 p-3">
            <Link href={`/cards/${card.slug}`} className="font-semibold text-slate-900 hover:underline">
              {card.nameJa}
            </Link>
            <p className="text-slate-700">{card.quickSenseIt}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
