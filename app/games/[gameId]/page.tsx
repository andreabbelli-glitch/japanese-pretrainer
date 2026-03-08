import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '@/src/components/page-shell';
import { loadGamePage } from '@/src/domain/learning';

export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const data = loadGamePage(gameId);

  if (!data) {
    notFound();
  }

  return (
    <PageShell title={data.game.name} description={data.game.description_it}>
      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="text-base font-semibold">Lezioni layer gioco</h2>
        <ul className="space-y-2">
          {data.lessons.map((lesson) => (
            <li key={lesson.id} className="rounded bg-slate-50 p-3">
              <Link href={`/games/${data.game.id}/learn/${lesson.slug}`} className="font-semibold hover:underline">
                {lesson.title}
              </Link>
              <p className="text-slate-700">{lesson.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Prodotti</h2>
        <ul className="space-y-2">
          {data.products.map((product) => (
            <li key={product.id} className="rounded border border-slate-200 bg-white p-3">
              <Link href={`/games/${data.game.id}/products/${product.id}`} className="font-semibold hover:underline">
                {product.name}
              </Link>
              <p className="text-sm text-slate-700">{product.summary_it}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
