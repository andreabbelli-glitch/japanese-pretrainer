import Link from 'next/link';
import { PageShell } from '@/src/components/page-shell';
import { loadGamesIndex } from '@/src/domain/learning';

export default function GamesPage() {
  const games = loadGamesIndex();

  return (
    <PageShell title="Giochi" description="Contesti di apprendimento disponibili nel layer canonico.">
      <ul className="space-y-3">
        {games.map((game) => (
          <li key={game.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <Link href={`/games/${game.id}`} className="text-lg font-semibold text-slate-900 hover:underline">
              {game.name}
            </Link>
            <p className="text-sm text-slate-700">{game.description_it}</p>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
