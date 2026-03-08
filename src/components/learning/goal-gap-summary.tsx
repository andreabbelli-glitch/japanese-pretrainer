import type { GapAnalysisResult } from '@/src/domain/learning';

export function GoalGapSummary({ gap }: { gap: GapAnalysisResult }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Stato obiettivo</h3>
      <p className="mt-2 text-2xl font-bold text-slate-900">Coverage {gap.coverageScore}%</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded bg-emerald-50 p-2 text-emerald-900">
          <p className="font-semibold">Sai già</p>
          <p>{gap.knownItems.length}</p>
        </div>
        <div className="rounded bg-amber-50 p-2 text-amber-900">
          <p className="font-semibold">Deboli</p>
          <p>{gap.weakItems.length}</p>
        </div>
        <div className="rounded bg-rose-50 p-2 text-rose-900">
          <p className="font-semibold">Mancanti</p>
          <p>{gap.missingItems.length}</p>
        </div>
        <div className="rounded bg-slate-100 p-2 text-slate-900">
          <p className="font-semibold">Richiesti</p>
          <p>{gap.requiredItems.length}</p>
        </div>
      </div>
    </section>
  );
}
