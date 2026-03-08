import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/src/components/page-shell";
import { buildMasteryMap, computeDeckCoverage } from "@/src/domain/progress";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId, listUserItemProgress } from "@/src/features/user-data/repository";

export default async function DeckDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let masteryMap = new Map<string, number>();
  try {
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId(supabase);
    const progressRows = await listUserItemProgress(supabase, userId);
    masteryMap = buildMasteryMap(progressRows);
  } catch {
    masteryMap = new Map<string, number>();
  }

  const deckCoverage = computeDeckCoverage(slug, masteryMap);
  if (!deckCoverage) {
    notFound();
  }

  const closestCards = deckCoverage.cards
    .filter((card) => card.coverage < 85)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, 5);

  return (
    <PageShell title={deckCoverage.deck.name} description="Coverage deck, carte quasi sbloccate e colli di bottiglia linguistici.">
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">Totale carte nel deck:</span> {deckCoverage.deck.totalCards}
        </p>
        <p>{deckCoverage.deck.notes}</p>
        <div className="mt-3">
          <p className="font-semibold text-slate-900">Coverage complessiva: {deckCoverage.coverage}%</p>
          <div className="mt-2 h-3 rounded-full bg-slate-100">
            <div className="h-3 rounded-full bg-indigo-600" style={{ width: `${deckCoverage.coverage}%` }} />
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Carte più vicine a essere sbloccate</h2>
        {closestCards.length > 0 ? (
          <ul className="space-y-2">
            {closestCards.map((entry) => (
              <li key={entry.card.id} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                <Link href={`/cards/${entry.card.slug}` as Route} className="font-semibold text-slate-900 hover:underline">
                  {entry.card.nameJa}
                </Link>
                <p>Coverage: {entry.coverage}% · Gap critici: {entry.missingItems.slice(0, 2).map((gap) => gap.item.id).join(", ") || "nessuno"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Tutte le carte del deck sono già in fascia leggibile.</p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Colli di bottiglia linguistici</h2>
        {deckCoverage.topBottlenecks.length > 0 ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {deckCoverage.topBottlenecks.map((gap) => (
              <li key={gap.item.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {gap.item.id} — {gap.item.term}
                </p>
                <p>Gap pesato: {gap.gap} · Impatta {gap.cardCount} carte</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Nessun collo di bottiglia critico rilevato.</p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Study next (sblocchi carte reali)</h2>
        {deckCoverage.unlockSuggestions.length > 0 ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {deckCoverage.unlockSuggestions.map((suggestion) => (
              <li key={suggestion.item.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  Studia {suggestion.item.id} — {suggestion.item.term}
                </p>
                <p>
                  Sblocca più facilmente: {suggestion.unlocks.slice(0, 3).map((card) => card.nameJa).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">Nessun suggerimento prioritario: continua review regolare.</p>
        )}
      </section>
    </PageShell>
  );
}
