import Link from 'next/link';
import { redirect } from 'next/navigation';
import { logout } from '@/app/login/actions';
import {
  ActiveGoalCard,
  DueToday,
  GlobalMasteryOverview,
  MissingItemsByGoal,
  SharedKnowledgeReused,
  StudyNext,
  UnlockNextUnits,
  WeakButKnown,
} from '@/src/components/dashboard';
import { buildGoalDashboardData } from '@/src/domain/goals/dashboard';
import { createClient } from '@/src/lib/supabase/server';
import {
  getAuthenticatedUserId,
  listUserGoals,
  listUserItemProgress,
} from '@/src/features/user-data/repository';

export default async function DashboardPage() {
  const supabase = await createClient();
  let userId: string;

  try {
    userId = await getAuthenticatedUserId(supabase);
  } catch {
    redirect('/login');
  }

  const [goals, progressRows] = await Promise.all([
    listUserGoals(supabase, userId),
    listUserItemProgress(supabase, userId),
  ]);

  const dashboard = buildGoalDashboardData({ goals, progressRows });

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
      <header className="space-y-1 rounded-lg border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard goal-centric</h1>
        <p className="text-sm text-slate-700">Sistema di studio del giapponese con giochi come contesto: coverage, gap e prossime azioni reali.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <GlobalMasteryOverview value={dashboard.globalCoverage} />
        <DueToday value={dashboard.dueToday} />
        <ActiveGoalCard activeGoal={dashboard.activeGoal} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <StudyNext entries={dashboard.studyNext} />
        <UnlockNextUnits activeGoal={dashboard.activeGoal} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MissingItemsByGoal goals={dashboard.goalOverviews} />
        <WeakButKnown entries={dashboard.weakButKnown} />
        <SharedKnowledgeReused entries={dashboard.sharedKnowledgeReused} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/goals" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          Gestisci obiettivi
        </Link>
        <Link href="/review" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Vai alla review
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            Logout
          </button>
        </form>
      </div>
    </section>
  );
}
