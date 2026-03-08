import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { loadProductPage } from '@/src/domain/learning';

export default async function ProductPage({ params }: { params: Promise<{ gameId: string; productId: string }> }) {
  const { gameId, productId } = await params;
  const data = loadProductPage(gameId, productId);

  if (!data) {
    notFound();
  }

  return (
    <PageShell title={data.product.name} description={data.product.summary_it}>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Unità</h2>
        <ul className="space-y-2">
          {data.units.map((unit) => (
            <li key={unit.id} className="rounded border border-slate-200 bg-white p-3">
              <Link href={`/games/${data.game.id}/products/${data.product.id}/units/${unit.id}`} className="font-semibold hover:underline">
                {unit.name}
              </Link>
              <p className="text-sm text-slate-700">{unit.paraphrase_it}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
