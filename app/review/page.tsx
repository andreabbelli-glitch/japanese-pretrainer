import Link from "next/link";
import { redirect } from "next/navigation";
import { startReviewSession } from "@/app/review/actions";
import {
  buildBridgeQueue,
  buildMissingOnlyQueue,
  buildSessionQueue,
  filterGoalScopedEntries,
} from "@/src/domain/review";
import { getDueQueueEntries, getMasteryMap, getNewQueueEntries, getReviewSettings, resolveReviewFilters } from "@/src/domain/review/queries";
import type { ReviewMode } from "@/src/domain/review/types";
import { getAuthenticatedUserId, listActiveUserGoals } from "@/src/features/user-data/repository";
import { createClient } from "@/src/lib/supabase/server";

type Params = { empty?: string; seeded?: string; mode?: string; goalId?: string };

function modeLabel(mode: ReviewMode) {
  if (mode === "global") return "Globale";
  if (mode === "goal") return "Per obiettivo";
  if (mode === "missing-only") return "Solo mancanti";
  return "Bridge (deboli/mancanti)";
}

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;

  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect("/login");
  }

  const mode = (params.mode ?? "global") as ReviewMode;
  const settings = await getReviewSettings(supabase, userId);
  const goals = await listActiveUserGoals(supabase, userId);

  const baseDueEntries = await getDueQueueEntries(supabase, userId, Math.max(settings.dailyReviewGoal * 3, 20));
  const baseNewEntries = await getNewQueueEntries(supabase, userId, Math.max(settings.dailyNewLimit * 3, 20));

  const resolved = await resolveReviewFilters(supabase, userId, { mode, goalId: params.goalId });

  let plan = buildSessionQueue({
    dueItems: baseDueEntries,
    newItems: baseNewEntries,
    dailyReviewGoal: settings.dailyReviewGoal,
    dailyNewLimit: settings.dailyNewLimit,
  });

  if (resolved.goal && resolved.target) {
    const scopedIds = new Set(resolved.scopedItemIds);
    const due = filterGoalScopedEntries(baseDueEntries, scopedIds);
    const fresh = filterGoalScopedEntries(baseNewEntries, scopedIds);
    const masteryMap = await getMasteryMap(supabase, userId, resolved.scopedItemIds);

    if (mode === "goal") {
      plan = buildSessionQueue({
        dueItems: due,
        newItems: fresh.filter((entry) => (masteryMap.get(entry.itemId) ?? 0) < 80),
        dailyReviewGoal: settings.dailyReviewGoal,
        dailyNewLimit: settings.dailyNewLimit,
      });
    } else if (mode === "missing-only") {
      plan = buildMissingOnlyQueue({
        target: resolved.target,
        masteryByItemId: masteryMap,
        dueItems: due,
        candidateNewItems: fresh,
        dailyReviewGoal: settings.dailyReviewGoal,
        dailyNewLimit: settings.dailyNewLimit,
      });
    } else if (mode === "bridge") {
      plan = buildBridgeQueue({
        target: resolved.target,
        masteryByItemId: masteryMap,
        dueItems: due,
        dailyReviewGoal: settings.dailyReviewGoal,
      });
    }
  } else if (mode !== "global") {
    plan = buildSessionQueue({
      dueItems: [],
      newItems: [],
      dailyReviewGoal: settings.dailyReviewGoal,
      dailyNewLimit: settings.dailyNewLimit,
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Review</h1>
        <p className="text-sm text-slate-700">Ripasso canonico globale, con filtri per obiettivo e conoscenza mancante.</p>
      </header>

      {params.seeded === "1" ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Item aggiunto alla coda review.</p> : null}
      {params.empty === "1" ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Nessun item da ripassare per questa modalità.</p> : null}

      <form action={startReviewSession} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="space-y-1">
          <label htmlFor="mode" className="text-sm font-semibold text-slate-900">
            Modalità review
          </label>
          <select id="mode" name="mode" defaultValue={mode} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="global">Globale</option>
            <option value="goal">Per obiettivo</option>
            <option value="missing-only">Solo mancanti</option>
            <option value="bridge">Bridge (deboli/mancanti)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="goalId" className="text-sm font-semibold text-slate-900">
            Obiettivo attivo (per modalità goal/missing/bridge)
          </label>
          <select id="goalId" name="goalId" defaultValue={resolved.goal?.id ?? ""} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Nessuno</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Avvia sessione review
        </button>
      </form>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Modalità selezionata</p>
          <p>{modeLabel(mode)}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">Obiettivo review giornaliero</p>
          <p>{settings.dailyReviewGoal} item</p>
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
        <p className="text-slate-600">Mastery globale su item canonici: nessun item già noto rientra come nuovo solo perché cambia prodotto.</p>
      </div>

      <Link href="/settings" className="inline-block text-sm text-slate-700 underline">
        Modifica limiti giornalieri in Impostazioni
      </Link>
    </section>
  );
}
