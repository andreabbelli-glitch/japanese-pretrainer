import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AddToReviewForm,
  BookmarkToggle,
  FuriganaToggle,
  RelatedItemsList,
  RevealTranslation,
  SentenceBreakdown,
} from "@/src/components/learning";
import { PageShell } from "@/src/components/page-shell";
import { getCardBySlug, getExamplesForCard, getItemById } from "@/src/domain/content";
import { buildMasteryMap, computeCardCoverage, computeDeckCoverage } from "@/src/domain/progress";
import { createClient } from "@/src/lib/supabase/server";
import { findBookmarkByCardId, getAuthenticatedUserId, listUserItemProgress } from "@/src/features/user-data/repository";

export default async function CardDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = getCardBySlug(slug);

  if (!card) {
    notFound();
  }

  const requiredItems = card.keyItemIds.map((itemId) => getItemById(itemId)).filter((item) => item !== undefined);
  const requiredPatterns = card.keyPatternIds.map((itemId) => getItemById(itemId)).filter((item) => item !== undefined);
  const examples = getExamplesForCard(card.id).slice(0, 5);

  let masteryMap = new Map<string, number>();
  let isBookmarked = false;

  try {
    const supabase = await createClient();
    const userId = await getAuthenticatedUserId(supabase);
    const progressRows = await listUserItemProgress(supabase, userId);
    masteryMap = buildMasteryMap(progressRows);
    isBookmarked = Boolean(await findBookmarkByCardId(supabase, userId, card.id));
  } catch {
    masteryMap = new Map<string, number>();
  }

  const coverage = computeCardCoverage(card, masteryMap);
  const deckCoverage = computeDeckCoverage(card.deckId === "DECK-SD1" ? "dm25-sd1" : "dm25-sd2", masteryMap);

  return (
    <PageShell title={card.nameJa} description="Scheda carta didattica: segmentazione, parafrasi, coverage e azioni di studio.">
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p>
          <span className="font-semibold">Deck:</span> {card.deckId}
        </p>
        <p>
          <span className="font-semibold">ID carta:</span> {card.id}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <BookmarkToggle cardId={card.id} slug={card.slug} isBookmarked={isBookmarked} />
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-slate-900">Coverage carta</p>
          <p>{coverage.coverage}%</p>
        </div>
        <div className="h-3 rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-emerald-600" style={{ width: `${coverage.coverage}%` }} />
        </div>
        <p className="text-xs text-slate-600">
          {coverage.coverage >= 85
            ? "Carta leggibile: hai quasi tutti i prerequisiti stabili."
            : coverage.coverage >= 70
              ? "Quasi leggibile: ti mancano pochi blocchi ad alto peso."
              : "Non ancora coperta: i gap sotto spiegano esattamente cosa studiare."}
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
        <h2 className="text-base font-semibold text-slate-900">Gap collegati (perché non è ancora coperta)</h2>
        {coverage.missingItems.length > 0 ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {coverage.missingItems.slice(0, 6).map((missing) => (
              <li key={missing.item.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {missing.item.id} — {missing.item.term}
                </p>
                <p>Mastery: {missing.mastery}% · Peso: {missing.weight}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Nessun gap critico: prerequisiti coperti.</p>
        )}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Next best study actions</h2>
        <p className="text-sm text-slate-700">Studia prima gli item qui sotto per aumentare più velocemente la coverage della carta.</p>
        <div className="flex flex-wrap gap-2">
          {coverage.missingItems.slice(0, 4).map((missing) => (
            <AddToReviewForm key={missing.item.id} itemId={missing.item.id} compact />
          ))}
          {coverage.missingItems.length === 0 ? <Link href="/review" className="rounded-md border border-slate-300 px-3 py-2 text-sm">Consolida in review</Link> : null}
        </div>
      </section>

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
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Pattern richiesti</h2>
        <RelatedItemsList items={requiredPatterns} />
      </section>

      {deckCoverage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-sm text-white">
          <p className="font-semibold">Contesto deck: {deckCoverage.deck.name}</p>
          <p className="mt-1">Coverage deck attuale: {deckCoverage.coverage}%.</p>
          <Link href={`/decks/${deckCoverage.deck.slug}` as Route} className="mt-3 inline-block rounded-md bg-white px-3 py-2 font-medium text-slate-900">
            Apri pagina deck
          </Link>
        </div>
      ) : null}
    </PageShell>
  );
}
