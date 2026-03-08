import Link from 'next/link';
import type { GoalOverview } from '@/src/domain/goals/dashboard';

export function ActiveGoalCard({ activeGoal }: { activeGoal: GoalOverview | null }) {
  if (!activeGoal) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">ActiveGoalCard</h2>
        <p className="mt-2 text-slate-700">Nessun obiettivo attivo. Impostane uno dalla pagina Obiettivi.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">ActiveGoalCard</h2>
      <p className="mt-2 font-medium text-slate-900">{activeGoal.goal.title}</p>
      <p className="text-slate-700">Target: {activeGoal.targetLabel}</p>
      <p className="text-slate-700">
        Coverage {activeGoal.gap.coverageScore}% · missing {activeGoal.gap.missingItems.length} · weak {activeGoal.gap.weakItems.length}
      </p>
      <Link href="/goals" className="mt-3 inline-block underline">
        Gestisci obiettivo
      </Link>
    </section>
  );
}

export function GlobalMasteryOverview({ value }: { value: number }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">GlobalMasteryOverview</h2>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}%</p>
      <p className="text-slate-700">Media coverage dei goal in corso/attivi.</p>
    </section>
  );
}

export function DueToday({ value }: { value: number }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">DueToday</h2>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <Link href="/review" className="underline">
        Apri review
      </Link>
    </section>
  );
}

export function StudyNext({ entries }: { entries: Array<{ itemId: string; surface: string; impact: number; unlockUnits: number }> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">StudyNext</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-slate-700">Nessuna priorità netta.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.slice(0, 5).map((entry) => (
            <li key={entry.itemId} className="rounded bg-slate-50 p-2">
              <p className="font-medium">{entry.itemId} — {entry.surface}</p>
              <p className="text-slate-700">Impatto {entry.impact} · sblocca {entry.unlockUnits} unità</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MissingItemsByGoal({ goals }: { goals: GoalOverview[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">MissingItemsByGoal</h2>
      <ul className="mt-2 space-y-2">
        {goals.slice(0, 4).map((goal) => (
          <li key={goal.goal.id} className="rounded bg-slate-50 p-2">
            <p className="font-medium">{goal.goal.title}</p>
            <p className="text-slate-700">{goal.gap.missingItems.length} item mancanti</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UnlockNextUnits({ activeGoal }: { activeGoal: GoalOverview | null }) {
  const recommendations = activeGoal?.gap.unlockNextRecommendations ?? [];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">UnlockNextUnits</h2>
      {recommendations.length === 0 ? (
        <p className="mt-2 text-slate-700">Nessuna unità prossima allo sblocco.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {recommendations.slice(0, 4).map((entry) => (
            <li key={entry.item.id}>
              <p className="font-medium">{entry.item.surface}</p>
              <p className="text-slate-700">Sblocca {entry.unlocks.length} unità</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SharedKnowledgeReused({ entries }: { entries: Array<{ itemId: string; surface: string; usedByProducts: number }> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">SharedKnowledgeReused</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-slate-700">Ancora nessun item condiviso tra più prodotti.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {entries.slice(0, 6).map((entry) => (
            <li key={entry.itemId}>{entry.surface} · riusato in {entry.usedByProducts} prodotti</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WeakButKnown({ entries }: { entries: Array<{ id: string; surface: string; mastery: number }> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="text-base font-semibold">WeakButKnown</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-slate-700">Nessun item in fascia debole.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {entries.slice(0, 6).map((entry) => (
            <li key={entry.id}>{entry.surface} · mastery {entry.mastery}%</li>
          ))}
        </ul>
      )}
    </section>
  );
}
