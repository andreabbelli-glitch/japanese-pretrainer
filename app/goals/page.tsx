import { redirect } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { buildGoalDashboardData } from '@/src/domain/goals/dashboard';
import { createClient } from '@/src/lib/supabase/server';
import { getAuthenticatedUserId, listUserGoals, listUserItemProgress } from '@/src/features/user-data/repository';
import { archiveGoalFormAction, completeGoalFormAction, pauseGoalFormAction, setActiveGoalFormAction } from './actions';

export default async function GoalsPage() {
  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect('/login');
  }

  const [goals, progressRows] = await Promise.all([listUserGoals(supabase, userId), listUserItemProgress(supabase, userId)]);
  const dashboard = buildGoalDashboardData({ goals, progressRows });

  return (
    <PageShell title="Obiettivi" description="Gestione goal: attiva un solo obiettivo, metti in pausa, completa o archivia.">
      {goals.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          Nessun goal trovato. Crea goal via seed o SQL iniziale: il dashboard è già pronto a usarli.
        </div>
      ) : (
        <ul className="space-y-3">
          {dashboard.goalOverviews.map((entry) => (
            <li key={entry.goal.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p className="font-semibold text-slate-900">{entry.goal.title}</p>
              <p className="text-slate-700">Target: {entry.targetLabel}</p>
              <p className="text-slate-700">
                Stato: {entry.goal.status} · coverage {entry.gap.coverageScore}% · missing {entry.gap.missingItems.length}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setActiveGoalFormAction}>
                  <input type="hidden" name="goalId" value={entry.goal.id} />
                  <button className="rounded border border-slate-300 px-2 py-1">Imposta attivo</button>
                </form>
                <form action={pauseGoalFormAction}>
                  <input type="hidden" name="goalId" value={entry.goal.id} />
                  <button className="rounded border border-slate-300 px-2 py-1">Pausa</button>
                </form>
                <form action={completeGoalFormAction}>
                  <input type="hidden" name="goalId" value={entry.goal.id} />
                  <button className="rounded border border-slate-300 px-2 py-1">Completa</button>
                </form>
                <form action={archiveGoalFormAction}>
                  <input type="hidden" name="goalId" value={entry.goal.id} />
                  <button className="rounded border border-slate-300 px-2 py-1">Archivia</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
