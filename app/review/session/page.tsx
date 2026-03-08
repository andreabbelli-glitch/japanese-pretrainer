import Link from "next/link";
import { notFound } from "next/navigation";
import { getItemById } from "@/src/domain/content";
import { getReviewTemplate } from "@/src/domain/review";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId, listReviewEventsBySession } from "@/src/features/user-data/repository";
import { ReviewCard } from "@/app/review/session/review-card";

type SearchParams = {
  sessionId?: string;
  queue?: string;
  index?: string;
  done?: string;
};

export default async function ReviewSessionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const sessionId = params.sessionId;

  if (!sessionId) {
    return (
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-slate-900">Sessione review</h1>
        <p className="text-sm text-slate-700">Nessuna sessione attiva. Avvia una nuova sessione dalla pagina review.</p>
        <Link href="/review" className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
          Torna a Review
        </Link>
      </section>
    );
  }

  const supabase = await createClient();
  const userId = await getAuthenticatedUserId(supabase);

  const { data: session } = (await supabase
    .from("review_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()) as {
    data:
      | {
          id: string;
          status: string;
          item_count: number;
        }
      | null;
  };

  if (!session) {
    notFound();
  }

  const events = await listReviewEventsBySession(supabase, userId, session.id);

  if (params.done === "1" || session.status === "completed") {
    const byRating = events.reduce(
      (acc, event) => {
        acc[event.rating] += 1;
        return acc;
      },
      { Again: 0, Hard: 0, Good: 0, Easy: 0 },
    );

    return (
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-slate-900">Sessione completata</h1>
        <p className="text-sm text-slate-700">Hai completato {events.length} review in questa sessione.</p>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li className="rounded-md bg-slate-50 p-3">Again: {byRating.Again}</li>
          <li className="rounded-md bg-slate-50 p-3">Hard: {byRating.Hard}</li>
          <li className="rounded-md bg-slate-50 p-3">Good: {byRating.Good}</li>
          <li className="rounded-md bg-slate-50 p-3">Easy: {byRating.Easy}</li>
        </ul>
        <div className="flex gap-2">
          <Link href="/review" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Torna a review
          </Link>
          <Link href="/dashboard" className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">
            Vai alla dashboard
          </Link>
        </div>
      </section>
    );
  }

  const queue = (params.queue ?? "").split(",").filter(Boolean);
  const index = Number(params.index ?? 0);

  if (queue.length === 0 || Number.isNaN(index) || index < 0 || index >= queue.length) {
    return (
      <section className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h1 className="text-xl font-semibold text-slate-900">Sessione incompleta</h1>
        <p className="text-sm text-slate-700">La coda non è valida. Torna alla pagina review e riavvia la sessione.</p>
        <Link href="/review" className="inline-block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
          Riavvia review
        </Link>
      </section>
    );
  }

  const currentItem = getItemById(queue[index]);
  if (!currentItem) {
    notFound();
  }

  const template = getReviewTemplate(currentItem);

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-slate-900">Sessione review</h1>
        <p className="text-sm text-slate-700">
          Carta {index + 1} di {queue.length}. Progress sessione: {events.length}/{session.item_count} valutate.
        </p>
        <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
          <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.round(((index + 1) / queue.length) * 100)}%` }} />
        </div>
      </header>

      <ReviewCard session={session} item={currentItem} queue={queue} index={index} template={template} />
    </section>
  );
}
