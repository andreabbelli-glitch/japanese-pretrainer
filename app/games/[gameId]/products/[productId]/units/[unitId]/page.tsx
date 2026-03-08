import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { analyzeTargetGaps } from '@/src/domain/learning';
import { loadUnitPage } from '@/src/domain/learning';

export default async function UnitPage({ params }: { params: Promise<{ gameId: string; productId: string; unitId: string }> }) {
  const { gameId, productId, unitId } = await params;
  const data = loadUnitPage(gameId, productId, unitId);

  if (!data) {
    notFound();
  }

  const gap = analyzeTargetGaps(
    {
      id: `goal.unit.${data.unit.id}`,
      targetType: 'unit',
      gameId: data.game.id,
      productId: data.product.id,
      unitId: data.unit.id,
      title: data.unit.name,
    },
    new Map(),
  );

  return (
    <PageShell title={data.unit.name} description={data.unit.paraphrase_it}>
      <section className="space-y-2 rounded border border-slate-200 bg-white p-4 text-sm">
        <p><span className="font-semibold">Coverage target:</span> {gap.coverageScore}%</p>
        <p><span className="font-semibold">Item richiesti:</span> {gap.requiredItems.length}</p>
        <p><span className="font-semibold">Item mancanti:</span> {gap.missingItems.length}</p>
      </section>
    </PageShell>
  );
}
