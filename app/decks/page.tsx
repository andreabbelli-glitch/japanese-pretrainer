import type { Route } from "next";
import Link from "next/link";
import { PageShell } from "@/src/components/page-shell";
import { getDecks } from "@/src/domain/content";

export default function DecksPage() {
  const decks = getDecks();

  return (
    <PageShell title="Mazzi" description="Accesso rapido ai deck SD1 e SD2 con lista carte uniche.">
      <ul className="space-y-3">
        {decks.map((deck) => (
          <li key={deck.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <Link href={`/decks/${deck.slug}` as Route} className="text-lg font-semibold text-slate-900 hover:underline">
              {deck.name}
            </Link>
            <p className="text-sm text-slate-700">Carte uniche nel corpus: {deck.uniqueCards.length}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
