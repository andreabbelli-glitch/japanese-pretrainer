import type { Route } from "next";
import Link from "next/link";
import { PageShell } from "@/src/components/page-shell";
import { getCards } from "@/src/domain/content";

export default function CardsPage() {
  const cards = getCards();

  return (
    <PageShell title="Carte studio" description="Carte SD1/SD2 con supporto didattico per lettura giapponese.">
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
