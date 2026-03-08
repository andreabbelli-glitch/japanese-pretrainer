import { PageShell } from '@/src/components/page-shell';

export default function GoalsPage() {
  return (
    <PageShell
      title="Obiettivi"
      description="Spazio obiettivi (goal target) pronto per attivazione target di studio e gap analysis."
    >
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        La gestione obiettivi verrà estesa nei prossimi step UI. Il dominio goal-aware è già disponibile lato servizi.
      </div>
    </PageShell>
  );
}
