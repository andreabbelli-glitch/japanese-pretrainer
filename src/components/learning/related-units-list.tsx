import Link from 'next/link';
import type { SourceUnit } from '@/src/domain/content';

type RelatedUnitsListProps = {
  units: SourceUnit[];
  title?: string;
};

export function RelatedUnitsList({ units, title = 'Unità collegate' }: RelatedUnitsListProps) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      <ul className="space-y-2 text-sm">
        {units.map((unit) => (
          <li key={unit.id} className="rounded-md bg-slate-50 p-3">
            <Link
              href={`/games/${unit.gameId}/products/${unit.productId}/units/${unit.id}`}
              className="font-semibold text-slate-900 hover:underline"
            >
              {unit.name}
            </Link>
            <p className="text-slate-700">{unit.paraphrase_it}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
