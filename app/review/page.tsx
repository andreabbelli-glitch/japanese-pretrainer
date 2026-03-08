import Link from "next/link";
import { redirect } from "next/navigation";
import { startReviewSession } from "@/app/review/actions";
import { buildSessionQueue, getDueQueueEntries, getNewQueueEntries, getReviewSettings } from "@/src/domain/review";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUserId } from "@/src/features/user-data/repository";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ empty?: string; seeded?: string }> }) {
  const params = await searchParams;

  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect("/login");
  }

  const settings = await getReviewSettings(supabase, userId);
  const dueEntries = await getDueQueueEntries(supabase, userId, Math.max(settings.dailyReviewGoal, 1));
  const newEntries = await getNewQueueEntries(supabase, userId, Math.max(settings.dailyNewLimit, 1));

  const plan = buildSessionQueue({
    dueItems: dueEntries,
    newItems: newEntries,
    dailyReviewGoal: settings.dailyReviewGoal,
    dailyNewLimit: settings.dailyNewLimit,
  });

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Review</h1>
        <p className="text-sm text-slate-700">Ripasso in stile flashcard con tracking reale su stato, intervalli e memoria.</p>
      </header>

      {params.seeded === "1" ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Item aggiunto alla coda review.</p> : null}
      {params.empty === "1" ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Nessun item da ripassare ora.</p> : null}

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Obiettivo review giornaliero</p>
          <p>{settings.dailyReviewGoal} item</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Limite nuovi item</p>
          <p>{settings.dailyNewLimit} item</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Dovuti ora</p>
          <p>{plan.due.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Nuovi in coda</p>
          <p>{plan.newItems.length}</p>
        </div>
      </section>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        <p>
          Sessione proposta: <span className="font-semibold">{plan.totalPlanned}</span> item.
        </p>
        <p className="text-slate-600">Priorità ai dovuti; nuovi item aggiunti nel rispetto dei tuoi limiti giornalieri.</p>
      </div>

      <form action={startReviewSession}>
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Avvia sessione review
        </button>
      </form>

      <Link href="/settings" className="inline-block text-sm text-slate-700 underline">
        Modifica limiti giornalieri in Impostazioni
      </Link>
    </section>
  );
}
