import Link from 'next/link';
import type { UnlockRecommendation } from '@/src/domain/learning';

export function UnlockNextList({
  recommendations,
  gameId,
  productId,
}: {
  recommendations: UnlockRecommendation[];
  gameId: string;
  productId: string;
}) {
  if (recommendations.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Cosa sblocchi studiando adesso</h3>
      <ul className="space-y-2 text-sm">
        {recommendations.map((entry) => (
          <li key={entry.item.id} className="rounded-md bg-slate-50 p-3">
            <p className="font-semibold text-slate-900">
              <Link href={`/items/${entry.item.id}`} className="hover:underline">
                {entry.item.surface}
              </Link>{' '}
              — impatto {Math.round(entry.impactScore)}
            </p>
            <p className="text-slate-700">
              Unità che avanzano: {entry.unlocks.slice(0, 3).map((unit, index) => (
                <span key={unit.id}>
                  {index > 0 ? ', ' : ''}
                  <Link href={`/games/${gameId}/products/${productId}/units/${unit.id}`} className="underline-offset-2 hover:underline">
                    {unit.name}
                  </Link>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
